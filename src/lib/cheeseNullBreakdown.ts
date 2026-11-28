// Per-contract null breakdown.
//
// Coverage note: single Hyperion providers regularly hold only a fraction of a
// contract's transfer history (measured: 3 vs 52 records for the same query on
// two providers), and a freshness probe cannot detect that — a provider can be
// fully caught up on new blocks and still be missing the past. Every history
// read here is therefore a UNION across providers, de-duplicated by action
// identity, via `fetchActionsUnion`. The complete breakdown is derived from
// two broad reads so opening the table cannot trigger dozens of scans.

import { fetchContractStats, parseAssetAmount } from './cheeseNullApi';
import { fetchActionsUnion, sumAssetField } from './hyperionHistory';
import { STATIC_ENDPOINTS } from './endpointHealth';
import { chainPost } from './chainRequest';
import { FEE_MEMO, KEY_CREATION_MEMO, KEY_PREFIX, LEGACY_KEY_PREFIX, CRYPT_ROUTER_ACCOUNT } from './cheeseCrypt';
import { ROOM_PREFIX } from './cryptRooms';
import { HIDE_PREFIX } from './cryptRoomDenylist';
import { REPORT_PREFIX } from './cryptRoomReports';

/** Legacy direct messaging fee label used before the CHEESECrypt rename. */
const LEGACY_FEE_MEMO = 'GPK messaging fee';
const CRYPT_MEMO_EXACT = new Set([FEE_MEMO, KEY_CREATION_MEMO, LEGACY_FEE_MEMO]);
const CRYPT_MEMO_PREFIXES = [KEY_PREFIX, LEGACY_KEY_PREFIX, ROOM_PREFIX, HIDE_PREFIX, REPORT_PREFIX];

/** True when a user's direct eosio.null transfer is a CHEESECrypt fee leg (pre-contract or non-routed). */
export function isCryptNullMemo(memo: unknown): boolean {
  if (typeof memo !== 'string' || !memo) return false;
  return CRYPT_MEMO_EXACT.has(memo) || CRYPT_MEMO_PREFIXES.some((p) => memo.startsWith(p));
}

const BATCH_SIZE = 1000;
const MAX_ACTIONS = 50000;

const WAX_RPC_FALLBACK = STATIC_ENDPOINTS['chain-api'];

export interface NullBreakdownEntry {
  contract: string;
  displayName: string;
  amount: number;
  percent: number;
  amount24h: number;
  percent24h: number;
  amount7d: number;
  percent7d: number;
  amount30d: number;
  percent30d: number;
  /** Days between the contract's earliest recorded null and now (min 1). Null when no history was observed. */
  trackedDays: number | null;
  /** Lifetime total ÷ tracked days. Null when no history was observed. */
  avg24h: number | null;
  /** Lifetime total ÷ tracked weeks (trackedDays / 7). */
  avg7d: number | null;
  /** Lifetime total ÷ tracked months (trackedDays / 30). */
  avg30d: number | null;
}

export interface NullBreakdownResult {
  entries: NullBreakdownEntry[];
  /** True when provider coverage was thin, so totals may understate reality. */
  isPartial: boolean;
}

function parseAsset(str: string): number {
  if (!str) return 0;
  return parseFloat(str.split(' ')[0]) || 0;
}

// Tracks whether any history read this run had weak provider coverage.
interface CoverageTracker {
  succeeded: number;
  reads: number;
}

// cheesepowerz stores its own stats on-chain (authoritative)
async function fetchCheesepowerzNulled(): Promise<number | null> {
  try {
    const data = await chainPost<{ rows: { total_cheese_received: string }[] }>(
      '/v1/chain/get_table_rows',
      { code: 'cheesepowerz', scope: 'cheesepowerz', table: 'stats', json: true, limit: 1 },
      { feature: 'chain-api', fallback: WAX_RPC_FALLBACK },
    );
    if (data.rows && data.rows.length > 0) {
      return parseAsset(data.rows[0].total_cheese_received);
    }
    return 0;
  } catch {
    return null;
  }
}

// Hyperion returns timestamps like `2026-09-11T21:44:52.000` with no timezone
// marker. Date.parse treats those as LOCAL time, which shifts every event by the
// viewer's UTC offset and corrupts the 24h/7d/30d windows. Force UTC.
function timestampMs(action: { '@timestamp'?: string; timestamp?: string }): number {
  const value = action['@timestamp'] || action.timestamp;
  if (!value) return 0;
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

const NULL_CONTRACTS = [
  { account: 'cheeseburner', displayName: 'cheeseburner' },
  { account: 'cheesefeefee', displayName: 'cheesefeefee' },
  { account: 'cheesepowerz', displayName: 'cheesepowerz' },
  { account: 'ram.chz', displayName: 'ram.chz' },
  { account: 'cheesebannad', displayName: 'cheesebannad' },
  { account: 'cheesenftwax', displayName: 'cheesenftwax' },
  { account: 'crypt.cheese', displayName: 'CHEESECrypt' },
  { account: 'liquidcheese', displayName: 'Liquidity Fees' },
] as const;

const FIRST_SEEN_KEY = 'cheesenull-first-seen-v1';
const READ_TIMEOUT_MS = 20000;
const BROAD_QUERY = 'act.account=cheeseburger&act.name=transfer&transfer.to=eosio.null';
const contractQuery = (account: string) =>
  `act.account=cheeseburger&act.name=transfer&transfer.from=${account}&transfer.to=eosio.null`;
/** Exact memos for CHEESECrypt legs paid directly by users; their earliest record starts the Crypt span. */
const CRYPT_DIRECT_START_MEMOS = [LEGACY_FEE_MEMO, FEE_MEMO, KEY_CREATION_MEMO];

/** Earliest null per contract, confirmed by oldest-first reads. Contract starts never move later, so the cache only ever shrinks a value. */
function readFirstSeenCache(): Record<string, number> {
  try {
    const parsed = JSON.parse(localStorage.getItem(FIRST_SEEN_KEY) || '{}');
    const out: Record<string, number> = {};
    if (parsed && typeof parsed === 'object') {
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'number' && Number.isFinite(v) && v > 0) out[k] = v;
      }
    }
    return out;
  } catch {
    return {};
  }
}

function writeFirstSeenCache(value: Record<string, number>): void {
  try {
    localStorage.setItem(FIRST_SEEN_KEY, JSON.stringify(value));
  } catch {
    // Cache is an optimisation; a full or blocked store just means re-reading next time.
  }
}

/** Oldest matching action's time across providers (sort=asc, one row each), or null when unknown. */
async function fetchEarliest(query: string): Promise<number | null> {
  try {
    const read = await fetchActionsUnion(`${query}&sort=asc`, {
      batchSize: 1, maxActions: 1, paginate: false, timeoutMs: READ_TIMEOUT_MS,
    });
    let earliest: number | null = null;
    for (const action of read.actions) {
      const t = timestampMs(action);
      if (t && (earliest === null || t < earliest)) earliest = t;
    }
    return earliest;
  } catch {
    return null;
  }
}

export async function fetchNullBreakdown(): Promise<NullBreakdownResult> {
  const coverage: CoverageTracker = { succeeded: 0, reads: 0 };
  const contractAccounts = new Set<string>(NULL_CONTRACTS.map(({ account }) => account));
  const historyOptions = { batchSize: BATCH_SIZE, maxActions: MAX_ACTIONS, timeoutMs: READ_TIMEOUT_MS };
  const cachedStarts = readFirstSeenCache();

  // Each contract is read on its own filtered query, so one busy sender (e.g.
  // cheesepowerz or tiny Crypt copies) can never push another contract's older
  // history past a read deadline. The broad sweep only attributes direct user
  // CHEESECrypt fee legs, whose senders are not contracts.
  const contractReads = Promise.all(
    NULL_CONTRACTS.map(({ account }) =>
      Promise.resolve().then(() => fetchActionsUnion(contractQuery(account), historyOptions)).catch(() => null),
    ),
  );
  // Starts already confirmed are never re-queried.
  const startReads = Promise.all([
    ...NULL_CONTRACTS.map(({ account }) =>
      cachedStarts[account] !== undefined ? Promise.resolve(null) : fetchEarliest(contractQuery(account)),
    ),
    ...CRYPT_DIRECT_START_MEMOS.map((memo) =>
      cachedStarts[`memo:${memo}`] !== undefined
        ? Promise.resolve(null)
        : fetchEarliest(`${BROAD_QUERY}&transfer.memo=${encodeURIComponent(memo)}`),
    ),
  ]);

  const [perContract, broadResult, powerHistoryResult, burnerStats, powerTotal, starts] = await Promise.all([
    contractReads,
    Promise.resolve().then(() => fetchActionsUnion(BROAD_QUERY, historyOptions)).catch(() => null),
    Promise.resolve().then(() =>
    fetchActionsUnion(
      'act.account=cheeseburger&act.name=transfer&transfer.to=cheesepowerz',
      historyOptions,
    )).catch(() => null),
    fetchContractStats('cheeseburner').catch(() => null),
    fetchCheesepowerzNulled(),
    startReads,
  ]);

  // Merge newly confirmed starts into the cache (keeping the earlier of each).
  const startKeys = [
    ...NULL_CONTRACTS.map(({ account }) => account),
    ...CRYPT_DIRECT_START_MEMOS.map((memo) => `memo:${memo}`),
  ];
  let cacheChanged = false;
  startKeys.forEach((key, i) => {
    const t = starts[i];
    if (t !== null && (cachedStarts[key] === undefined || t < cachedStarts[key])) {
      cachedStarts[key] = t;
      cacheChanged = true;
    }
  });
  if (cacheChanged) writeFirstSeenCache(cachedStarts);

  const historyReads = [...perContract, broadResult, powerHistoryResult];
  const successfulReads = historyReads.filter(
    (read): read is NonNullable<typeof read> => read !== null,
  );
  if (successfulReads.length === 0 && !burnerStats && powerTotal === null) {
    throw new Error('All null-breakdown data sources failed');
  }
  for (const read of successfulReads) {
    coverage.reads += 1;
    coverage.succeeded += read.endpointsSucceeded;
  }
  const powerActions = powerHistoryResult?.actions ?? [];
  type Actions = NonNullable<typeof broadResult>['actions'];

  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;
  const cutoffs = {
    day: now - DAY_MS,
    week: now - 7 * DAY_MS,
    month: now - 30 * DAY_MS,
  };
  interface ContractTotals {
    all: number;
    day: number;
    week: number;
    month: number;
  }
  const totals = new Map<string, ContractTotals>();
  for (const account of contractAccounts) {
    totals.set(account, { all: 0, day: 0, week: 0, month: 0 });
  }
  // Earliest transfer timestamp per contract — the start of its tracked span.
  // Confirmed oldest-first starts (cached) win over whatever a read returned.
  const firstSeen = new Map<string, number>();
  const noteSeen = (account: string, time: number) => {
    if (!time) return;
    const prev = firstSeen.get(account);
    if (prev === undefined || time < prev) firstSeen.set(account, time);
  };
  for (const { account } of NULL_CONTRACTS) {
    if (cachedStarts[account] !== undefined) noteSeen(account, cachedStarts[account]);
  }
  for (const memo of CRYPT_DIRECT_START_MEMOS) {
    const t = cachedStarts[`memo:${memo}`];
    if (t !== undefined) noteSeen(CRYPT_ROUTER_ACCOUNT, t);
  }

  const addActions = (actions: Actions, accountFor: (data: Record<string, unknown>) => string | null) => {
    for (const action of actions) {
      const data = action.act?.data;
      if (!data) continue;
      const account = accountFor(data);
      if (!account || !contractAccounts.has(account)) continue;
      const quantity = sumAssetField([action]);
      const row = totals.get(account);
      if (!row) continue;
      row.all += quantity;
      const time = timestampMs(action);
      noteSeen(account, time);
      if (time >= cutoffs.month) row.month += quantity;
      if (time >= cutoffs.week) row.week += quantity;
      if (time >= cutoffs.day) row.day += quantity;
    }
  };

  // Period figures come ONLY from what each contract actually sent to
  // eosio.null. Deposits into cheesepowerz are not nulls yet, and counting them
  // here double-counted cheesepowerz in the 24h/7d/30d columns.
  NULL_CONTRACTS.forEach(({ account }, i) => {
    const read = perContract[i];
    if (!read) return;
    addActions(read.actions, (data) =>
      data.to === 'eosio.null' && data.from === account ? account : null);
  });
  // Direct user CHEESECrypt fee legs (pre-contract or non-routed). Contract
  // senders are skipped here because their own reads above already count them.
  addActions(broadResult?.actions ?? [], (data) => {
    if (data.to !== 'eosio.null' || typeof data.from !== 'string') return null;
    if (contractAccounts.has(data.from)) return null;
    return isCryptNullMemo(data.memo) ? CRYPT_ROUTER_ACCOUNT : null;
  });

  // Incoming cheesepowerz transfers are kept as a lifetime-only fallback for
  // when the contract's authoritative counter is unavailable. They also mark
  // the earliest activity we can see for cheesepowerz, whose nulls go through
  // the contract itself and may not appear in the eosio.null sweep.
  const powerInflowLifetime = sumAssetField(powerActions, 'quantity', (data) => data.to === 'cheesepowerz');
  for (const action of powerActions) {
    const data = action.act?.data;
    if (data && data.to === 'cheesepowerz') noteSeen('cheesepowerz', timestampMs(action));
  }

  const burnerAuthoritative = burnerStats?.total_cheese_burned
    ? parseAssetAmount(burnerStats.total_cheese_burned)
    : null;
  // Averages divide the contract's LIFETIME total by how long it has been
  // tracked: days since its earliest recorded null for the daily average,
  // those days / 7 for the weekly average, / 30 for the monthly average.
  const results = NULL_CONTRACTS.map(({ account, displayName }) => {
    const values = totals.get(account) ?? { all: 0, day: 0, week: 0, month: 0 };
    const amount = account === 'cheeseburner' && burnerAuthoritative !== null
      ? burnerAuthoritative
      : account === 'cheesepowerz'
        ? (powerTotal !== null ? powerTotal : Math.max(values.all, powerInflowLifetime))
        : values.all;
    const first = firstSeen.get(account);
    const trackedDays = first !== undefined ? Math.max(1, (now - first) / DAY_MS) : null;
    const avg24h = trackedDays !== null ? amount / trackedDays : null;
    const avg7d = trackedDays !== null ? amount / (trackedDays / 7) : null;
    const avg30d = trackedDays !== null ? amount / (trackedDays / 30) : null;
    return {
      contract: account,
      displayName,
      amount,
      amount24h: values.day,
      amount7d: values.week,
      amount30d: values.month,
      trackedDays,
      avg24h,
      avg7d,
      avg30d,
    };
  });

  const grandTotal = results.reduce((sum, r) => sum + r.amount, 0);
  const grandTotal24h = results.reduce((sum, r) => sum + r.amount24h, 0);
  const grandTotal7d = results.reduce((sum, r) => sum + r.amount7d, 0);
  const grandTotal30d = results.reduce((sum, r) => sum + r.amount30d, 0);

  const entries = results.map((r) => ({
    ...r,
    percent: grandTotal > 0 ? (r.amount / grandTotal) * 100 : 0,
    percent24h: grandTotal24h > 0 ? (r.amount24h / grandTotal24h) * 100 : 0,
    percent7d: grandTotal7d > 0 ? (r.amount7d / grandTotal7d) * 100 : 0,
    percent30d: grandTotal30d > 0 ? (r.amount30d / grandTotal30d) * 100 : 0,
  }));

  // Fewer than two providers answering on average means the union is thin.
  const avgSucceeded = coverage.reads > 0 ? coverage.succeeded / coverage.reads : 0;
  return {
    entries,
    isPartial: successfulReads.length < historyReads.length || avgSucceeded < 2,
  };
}
