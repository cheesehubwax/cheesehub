import { fetchPoolSlot } from '@/lib/alcorFarms';
import type { PoolSlot } from '@/lib/alcorV3Amounts';
import { waxRpcCall } from '@/lib/waxRpcFallback';
import { AvailableBalance, balanceKey } from '@/lib/alcorCompound';

/** Balance reads, pool-price reads and the short-lived claim memory used by Compound All. */
export const POLL_ATTEMPTS = 12;
export const POLL_DELAY_MS = 2000;
/**
 * How long a successful claim stays usable. Reopening the dialog inside this
 * window reuses that claim instead of claiming again — a repeat claim only pays
 * a few seconds' worth of dust and costs another signature.
 */
const CLAIM_REUSE_WINDOW_MS = 15 * 60 * 1000;

interface RecentClaim {
  account: string;
  txId: string | null;
  at: number;
  before: Map<string, AvailableBalance>;
}

let recentClaim: RecentClaim | null = null;

export function recordClaim(account: string, txId: string | null, before: Map<string, AvailableBalance>) {
  recentClaim = { account, txId, at: Date.now(), before };
}

export function recentClaimFor(account: string): RecentClaim | null {
  if (!recentClaim || recentClaim.account !== account) return null;
  if (Date.now() - recentClaim.at > CLAIM_REUSE_WINDOW_MS) return null;
  return recentClaim;
}

/** Forget the stored claim once its rewards have been compounded. */
export function clearRecentClaim() {
  recentClaim = null;
}


export function parseBalance(raw: string | undefined): AvailableBalance {
  if (!raw) return { balance: 0, precision: 8, known: true };
  const [amountStr] = raw.split(' ');
  const decimals = amountStr.split('.')[1]?.length ?? 0;
  return { balance: parseFloat(amountStr) || 0, precision: decimals, known: true };
}

export async function readBalance(
  account: string,
  contract: string | undefined,
  symbol: string,
): Promise<AvailableBalance> {
  // Without an issuing contract the chain cannot answer — report it as unknown
  // rather than pretending the wallet holds nothing.
  if (!contract) return { balance: 0, precision: 8, known: false };
  try {
    const rows = await waxRpcCall<string[] | undefined>(
      '/v1/chain/get_currency_balance',
      { code: contract, account, symbol },
      6000,
    );
    if (!Array.isArray(rows)) return { balance: 0, precision: 8, known: false };
    return parseBalance(rows[0]);
  } catch {
    return { balance: 0, precision: 8, known: false };
  }
}

export async function readBalances(
  account: string,
  tokens: Array<{ contract?: string; symbol: string }>,
): Promise<Map<string, AvailableBalance>> {
  const map = new Map<string, AvailableBalance>();
  const results = await Promise.all(tokens.map(t => readBalance(account, t.contract, t.symbol)));
  tokens.forEach((t, i) => {
    const key = balanceKey(t.contract ?? '', t.symbol);
    const existing = map.get(key);
    const value = results[i];
    // Keep the largest reported precision if the same token appears twice.
    if (!existing || value.precision > existing.precision) {
      map.set(key, value);
    }
  });
  return map;
}

/**
 * Read the live price slot of each pool. The deposit must be sized at the exact
 * ratio the pool accepts, otherwise Alcor rejects it with "Price slippage check".
 */
export async function readPoolSlots(poolIds: number[]): Promise<Map<number, PoolSlot | null>> {
  const unique = Array.from(new Set(poolIds));
  const slots = await Promise.all(
    unique.map(async id => {
      try {
        return await fetchPoolSlot(id);
      } catch {
        return null;
      }
    }),
  );
  const map = new Map<number, PoolSlot | null>();
  unique.forEach((id, i) => map.set(id, slots[i]));
  return map;
}
