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

const BATCH_SIZE = 1000;
const MAX_ACTIONS = 50000;

const WAX_RPC_ENDPOINTS = [
  'https://wax.eosusa.io/v1/chain/get_table_rows',
  'https://api.waxsweden.org/v1/chain/get_table_rows',
  'https://wax.greymass.com/v1/chain/get_table_rows',
];

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
  for (const endpoint of WAX_RPC_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: 'cheesepowerz',
          scope: 'cheesepowerz',
          table: 'stats',
          json: true,
          limit: 1,
        }),
      });
      if (!response.ok) continue;
      const data = await response.json();
      if (data.rows && data.rows.length > 0) {
        return parseAsset(data.rows[0].total_cheese_received);
      }
      return 0;
    } catch {
      continue;
    }
  }
  return null;
}

function timestampMs(action: { '@timestamp'?: string; timestamp?: string }): number {
  const value = action['@timestamp'] || action.timestamp;
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

const NULL_CONTRACTS = [
  { account: 'cheeseburner', displayName: 'cheeseburner' },
  { account: 'cheesefeefee', displayName: 'cheesefeefee' },
  { account: 'cheesepowerz', displayName: 'cheesepowerz' },
  { account: 'ram.chz', displayName: 'ram.chz' },
  { account: 'cheesebannad', displayName: 'cheesebannad' },
  { account: 'cheesenftwax', displayName: 'cheesenftwax' },
  { account: 'liquidcheese', displayName: 'Liquidity Fees' },
] as const;

function getAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export async function fetchNullBreakdown(): Promise<NullBreakdownResult> {
  const coverage: CoverageTracker = { succeeded: 0, reads: 0 };
  const contractAccounts = new Set(NULL_CONTRACTS.map(({ account }) => account));

  const [nullHistory, powerHistory, burnerStats, powerTotal] = await Promise.all([
    fetchActionsUnion(
      'act.account=cheeseburger&act.name=transfer&transfer.to=eosio.null',
      { batchSize: BATCH_SIZE, maxActions: MAX_ACTIONS, timeoutMs: 10000 },
    ),
    fetchActionsUnion(
      'act.account=cheeseburger&act.name=transfer&transfer.to=cheesepowerz',
      { batchSize: BATCH_SIZE, maxActions: MAX_ACTIONS, timeoutMs: 10000 },
    ),
    fetchContractStats('cheeseburner').catch(() => null),
    fetchCheesepowerzNulled(),
  ]);

  for (const read of [nullHistory, powerHistory]) {
    coverage.reads += 1;
    coverage.succeeded += read.endpointsSucceeded;
  }

  const now = Date.now();
  const cutoffs = {
    day: now - 24 * 60 * 60 * 1000,
    week: now - 7 * 24 * 60 * 60 * 1000,
    month: now - 30 * 24 * 60 * 60 * 1000,
  };
  const totals = new Map<string, { all: number; day: number; week: number; month: number }>();
  for (const account of contractAccounts) totals.set(account, { all: 0, day: 0, week: 0, month: 0 });

  const addActions = (actions: typeof nullHistory.actions, accountFor: (data: Record<string, unknown>) => string | null) => {
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
      if (time >= cutoffs.month) row.month += quantity;
      if (time >= cutoffs.week) row.week += quantity;
      if (time >= cutoffs.day) row.day += quantity;
    }
  };

  addActions(nullHistory.actions, (data) => data.to === 'eosio.null' && typeof data.from === 'string' ? data.from : null);
  // cheesepowerz retires what it receives, so its incoming transfers are the
  // consistent source for its period totals and history fallback.
  addActions(powerHistory.actions, (data) => data.to === 'cheesepowerz' ? 'cheesepowerz' : null);

  const burnerAuthoritative = burnerStats?.total_cheese_burned
    ? parseAssetAmount(burnerStats.total_cheese_burned)
    : null;
  const results = NULL_CONTRACTS.map(({ account, displayName }) => {
    const values = totals.get(account) ?? { all: 0, day: 0, week: 0, month: 0 };
    const amount = account === 'cheeseburner' && burnerAuthoritative !== null
      ? burnerAuthoritative
      : account === 'cheesepowerz' && powerTotal !== null
        ? powerTotal
        : values.all;
    return {
      contract: account,
      displayName,
      amount,
      amount24h: values.day,
      amount7d: values.week,
      amount30d: values.month,
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
  return { entries, isPartial: avgSucceeded < 2 };
}
