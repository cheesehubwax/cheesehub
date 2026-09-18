// CHEESEAnal — snapshot-to-snapshot account diffs used by the overview tooltip.
import { poolsForVenue, type LpDayFile, type LpIndexPool, type LpVenue } from '@/lib/lpPools';

const WAX_PAIR_KEY = 'wax-eosio.token';

/**
 * USD price of 1 WAX at snapshot time, derived from the CHEESE/WAX pair:
 * CHEESE price in USD divided by CHEESE price in WAX. Snapshot-only — never live.
 */
export function waxUsdFromPools(pools: Pick<LpIndexPool, 'pairKey' | 'priceUsd' | 'priceInPaired'>[]): number | null {
  for (const pool of pools) {
    if (pool.pairKey !== WAX_PAIR_KEY) continue;
    const usd = pool.priceUsd;
    const inWax = pool.priceInPaired;
    if (usd && inWax && usd > 0 && inWax > 0) return usd / inWax;
  }
  return null;
}

/** Positions per account in a snapshot, limited to one venue when filtered. */
function positionsByAccount(day: LpDayFile, venue: LpVenue | 'all'): Map<string, number> {
  const out = new Map<string, number>();
  for (const pool of poolsForVenue(day.pools ?? [], venue)) {
    for (const row of pool.providers ?? []) {
      out.set(row.a, (out.get(row.a) ?? 0) + (row.pos ?? 0));
    }
  }
  return out;
}

export interface AccountChange {
  account: string;
  delta: number;
}

export interface SnapshotDiff {
  /** Accounts present now but not in the previous snapshot. */
  joined: string[];
  /** Accounts present previously but gone now. */
  left: string[];
  /** Accounts whose open position count changed, biggest movement first. */
  positionChanges: AccountChange[];
}

/** Diff two recorded snapshots by provider account. */
export function diffSnapshots(
  current: LpDayFile | null,
  previous: LpDayFile | null,
  venue: LpVenue | 'all',
): SnapshotDiff | null {
  if (!current || !previous) return null;
  const now = positionsByAccount(current, venue);
  const before = positionsByAccount(previous, venue);

  const joined: string[] = [];
  const left: string[] = [];
  const positionChanges: AccountChange[] = [];

  for (const [account, pos] of now) {
    if (!before.has(account)) joined.push(account);
    const delta = pos - (before.get(account) ?? 0);
    if (delta !== 0) positionChanges.push({ account, delta });
  }
  for (const [account, pos] of before) {
    if (now.has(account)) continue;
    left.push(account);
    if (pos !== 0) positionChanges.push({ account, delta: -pos });
  }

  joined.sort();
  left.sort();
  positionChanges.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.account.localeCompare(b.account));

  return { joined, left, positionChanges };
}
