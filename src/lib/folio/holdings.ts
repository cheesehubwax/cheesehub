// Combines the history ledger with LIVE balances and prices. Live balances
// are the truth for "what you hold"; history only supplies the cost.
import type { TokenKey, TokenPosition } from './types';
import { WAX_KEY } from './types';
import type { PooledPart, PooledToken } from './pooled';

export interface LiveBalance {
  key: TokenKey;
  contract: string;
  symbol: string;
  precision: number;
  balance: number;
}

export interface HoldingRow {
  key: TokenKey;
  contract: string;
  symbol: string;
  precision: number;
  /** Wallet plus liquidity pools. */
  balance: number;
  walletBalance: number;
  pooledBalance: number;
  pooledParts: PooledPart[];
  /** True when a pool venue couldn't be read and this token may be in it. */
  pooledUnknown: boolean;
  priceWax: number | null;
  valueWax: number | null;
  /** Average WAX paid per token; null when history can't support it. */
  avgCostWax: number | null;
  unrealizedWax: number | null;
  unrealizedPct: number | null;
  realizedWax: number;
  /** USD figures: value at today's WAX/USD rate, cost at each purchase day's rate. */
  valueUsd: number | null;
  avgCostUsd: number | null;
  unrealizedUsd: number | null;
  unrealizedPctUsd: number | null;
  realizedUsd: number;
  /** False when some of this token's history had no known WAX/USD rate. */
  usdComplete: boolean;
  /** False when history and the live balance disagree. */
  complete: boolean;
  position: TokenPosition | null;
}

/** History matches the live balance within 2 smallest units or 1%. */
export function balancesAgree(historyQty: number, live: number, precision: number): boolean {
  const tolerance = Math.max(2 * 10 ** -precision, Math.abs(live) * 0.01);
  return Math.abs(historyQty - live) <= tolerance;
}

/**
 * One row per token, wallet and pools rolled together. History splits a
 * token's cost between the wallet and what it deposited into pools; the
 * wallet half must still match the live wallet balance, and pool amounts are
 * costed with what history says went in (so pool price drift shows as P/L).
 */
export function buildHoldings(
  positions: Map<TokenKey, TokenPosition>,
  live: LiveBalance[],
  priceWax: (key: TokenKey) => number | null,
  waxUsdNow = 0,
  pooled: { tokens: Map<TokenKey, PooledToken>; failed: string[] } | null = null,
): HoldingRow[] {
  const rows: HoldingRow[] = [];
  const keys = new Map<TokenKey, { contract: string; symbol: string; precision: number }>();
  for (const b of live) if (b.balance > 0) keys.set(b.key, b);
  for (const t of pooled?.tokens.values() ?? []) if (t.qty > 0 && !keys.has(t.key)) keys.set(t.key, t);
  const walletOf = new Map(live.map((b) => [b.key, b.balance]));
  const poolsFailed = !!pooled && pooled.failed.length > 0;

  for (const [key, meta] of keys) {
    const wallet = Math.max(0, walletOf.get(key) ?? 0);
    const pt = pooled?.tokens.get(key);
    const pool = pt?.qty ?? 0;
    const balance = wallet + pool;
    if (!(balance > 0)) continue;
    const precision = Math.max(meta.precision, pt?.precision ?? 0);
    const p = positions.get(key) ?? null;
    const isWax = key === WAX_KEY;
    const price = isWax ? 1 : priceWax(key);
    const value = price != null ? balance * price : null;

    // Pools not read yet, or a venue failed while history says tokens are in pools.
    const pooledUnknown = !pooled || (poolsFailed && !!p && p.inLiquidityQty > 0);
    const walletOk = !!p && !p.historyGap && balancesAgree(p.qty, wallet, precision);
    // Pool amounts need deposits in history to be costed.
    const poolOk = pool > 0 ? !!p && p.inLiquidityQty > 0 : true;
    const complete = walletOk && poolOk && !pooledUnknown;

    const walletAvg = p && p.qty > 0 ? p.costWax / p.qty : 0;
    const cost = complete && p ? walletAvg * wallet + (pool > 0 ? p.inLiquidityCostWax : 0) : null;
    const avg = cost != null ? cost / balance : null;
    const unrealized = !isWax && cost != null && value != null ? value - cost : null;

    const rate = waxUsdNow > 0 ? waxUsdNow : null;
    const usdOk = !!p && !p.usdGap;
    const valueUsd = value != null && rate != null ? value * rate : null;
    const walletAvgUsd = p && p.qty > 0 ? p.costUsd / p.qty : 0;
    const costUsd = complete && usdOk && p ? walletAvgUsd * wallet + (pool > 0 ? p.inLiquidityCostUsd : 0) : null;
    const avgUsd = costUsd != null ? costUsd / balance : null;
    const unrealizedUsd = costUsd != null && valueUsd != null ? valueUsd - costUsd : null;

    rows.push({
      key, contract: meta.contract, symbol: meta.symbol, precision, balance,
      walletBalance: wallet, pooledBalance: pool, pooledParts: pt?.parts ?? [], pooledUnknown,
      priceWax: price, valueWax: value, avgCostWax: isWax ? 1 : avg,
      unrealizedWax: unrealized,
      unrealizedPct: unrealized != null && cost && cost > 0 ? (unrealized / cost) * 100 : null,
      realizedWax: p?.realizedWax ?? 0,
      valueUsd, avgCostUsd: avgUsd, unrealizedUsd,
      unrealizedPctUsd: unrealizedUsd != null && costUsd && costUsd > 0 ? (unrealizedUsd / costUsd) * 100 : null,
      realizedUsd: p?.realizedUsd ?? 0,
      usdComplete: usdOk,
      complete: isWax ? true : complete,
      position: p,
    });
  }
  return rows.sort((a, b) => (b.valueWax ?? 0) - (a.valueWax ?? 0));
}

/** Realisable vs paper value in %, null when either side is unknown. */
export function realisableGapPct(realisableWax: number | null, paperWax: number | null): number | null {
  if (realisableWax == null || paperWax == null || !(paperWax > 0)) return null;
  return ((realisableWax - paperWax) / paperWax) * 100;
}
