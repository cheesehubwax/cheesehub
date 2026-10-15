// Combines the history ledger with LIVE balances and prices. Live balances
// are the truth for "what you hold"; history only supplies the cost.
import type { TokenKey, TokenPosition } from './types';
import { WAX_KEY } from './types';

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
  balance: number;
  priceWax: number | null;
  valueWax: number | null;
  /** Average WAX paid per token; null when history can't support it. */
  avgCostWax: number | null;
  unrealizedWax: number | null;
  unrealizedPct: number | null;
  realizedWax: number;
  /** False when history and the live balance disagree. */
  complete: boolean;
  position: TokenPosition | null;
}

/** History matches the live balance within 2 smallest units or 1%. */
export function balancesAgree(historyQty: number, live: number, precision: number): boolean {
  const tolerance = Math.max(2 * 10 ** -precision, Math.abs(live) * 0.01);
  return Math.abs(historyQty - live) <= tolerance;
}

export function buildHoldings(
  positions: Map<TokenKey, TokenPosition>,
  live: LiveBalance[],
  priceWax: (key: TokenKey) => number | null,
): HoldingRow[] {
  const rows: HoldingRow[] = [];
  for (const b of live) {
    if (!(b.balance > 0)) continue;
    const p = positions.get(b.key) ?? null;
    const price = b.key === WAX_KEY ? 1 : priceWax(b.key);
    const value = price != null ? b.balance * price : null;
    const complete = !!p && !p.historyGap && balancesAgree(p.qty, b.balance, b.precision);
    const avg = complete && p && p.qty > 0 ? p.costWax / p.qty : null;
    const isWax = b.key === WAX_KEY;
    const unrealized = !isWax && avg != null && price != null ? b.balance * (price - avg) : null;
    const costNow = avg != null ? avg * b.balance : null;
    rows.push({
      key: b.key, contract: b.contract, symbol: b.symbol, precision: b.precision, balance: b.balance,
      priceWax: price, valueWax: value, avgCostWax: isWax ? 1 : avg,
      unrealizedWax: unrealized,
      unrealizedPct: unrealized != null && costNow && costNow > 0 ? (unrealized / costNow) * 100 : null,
      realizedWax: p?.realizedWax ?? 0,
      complete: isWax ? true : complete,
      position: p,
    });
  }
  return rows.sort((a, b) => (b.valueWax ?? 0) - (a.valueWax ?? 0));
}
