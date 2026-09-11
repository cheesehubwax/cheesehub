// Per-contract null breakdown.
//
// Coverage note: single Hyperion providers regularly hold only a fraction of a
// contract's transfer history (measured: 3 vs 52 records for the same query on
// two providers), and a freshness probe cannot detect that — a provider can be
// fully caught up on new blocks and still be missing the past. Every history
// read here is therefore a UNION across providers, de-duplicated by action
// identity, via `fetchActionsUnion`.

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

async function unionSum(
  query: string,
  coverage: CoverageTracker,
  filter?: (data: Record<string, unknown>) => boolean,
): Promise<number> {
  const result = await fetchActionsUnion(query, {
    batchSize: BATCH_SIZE,
    maxActions: MAX_ACTIONS,
  });
  coverage.reads += 1;
  coverage.succeeded += result.endpointsSucceeded;
  if (result.endpointsSucceeded === 0) {
    throw new Error(`All Hyperion providers failed for: ${query}`);
  }
  return sumAssetField(result.actions, 'quantity', filter);
}

async function fetchContractNulledFromHyperion(
  account: string,
  coverage: CoverageTracker,
  after?: string,
): Promise<number> {
  const query =
    `act.account=cheeseburger&act.name=transfer` +
    `&transfer.from=${account}&transfer.to=eosio.null` +
    (after ? `&after=${after}` : '');
  return unionSum(query, coverage, (d) => d.from === account && d.to === 'eosio.null');
}

// cheesepowerz nulls 100% of CHEESE it receives. Its outgoing null may be
// performed via `cheeseburger::retire` (not a transfer to eosio.null), so
// windowed totals are derived from inflows to stay consistent with the
// lifetime counter (`stats.total_cheese_received`).
async function fetchCheesepowerzReceivedWindow(
  after: string,
  coverage: CoverageTracker,
): Promise<number> {
  const query =
    `act.account=cheeseburger&act.name=transfer` +
    `&transfer.to=cheesepowerz&after=${after}`;
  return unionSum(query, coverage, (d) => d.to === 'cheesepowerz');
}

// cheesepowerz stores its own stats on-chain (authoritative)
async function fetchCheesepowerzNulled(coverage: CoverageTracker): Promise<number> {
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
  // Fallback to history if all RPC endpoints fail
  return fetchContractNulledFromHyperion('cheesepowerz', coverage);
}

async function fetchContractNulled(account: string, coverage: CoverageTracker): Promise<number> {
  if (account === 'cheesepowerz') {
    return fetchCheesepowerzNulled(coverage);
  }
  if (account === 'cheeseburner') {
    // Authoritative on-chain counter incremented by the burn action itself.
    try {
      const stats = await fetchContractStats(account);
      if (stats && stats.total_cheese_burned) {
        return parseAssetAmount(stats.total_cheese_burned);
      }
    } catch {
      // fall through to history
    }
  }
  return fetchContractNulledFromHyperion(account, coverage);
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
  const after24h = getAgo(1);
  const after7d = getAgo(7);
  const after30d = getAgo(30);
  const coverage: CoverageTracker = { succeeded: 0, reads: 0 };

  const results = await Promise.all(
    NULL_CONTRACTS.map(async ({ account, displayName }) => {
      const windowFetch = account === 'cheesepowerz'
        ? (after: string) => fetchCheesepowerzReceivedWindow(after, coverage)
        : (after: string) => fetchContractNulledFromHyperion(account, coverage, after);
      return {
        contract: account,
        displayName,
        amount: await fetchContractNulled(account, coverage),
        amount24h: await windowFetch(after24h),
        amount7d: await windowFetch(after7d),
        amount30d: await windowFetch(after30d),
      };
    })
  );

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
