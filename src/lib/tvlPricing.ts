/** Pure live reserve valuation; shared identity keys match CHEESEAnal. */
export interface TvlToken {
  symbol?: string;
  contract?: string;
  system_price?: number | string;
}

export interface ReserveLeg {
  symbol: string;
  contract: string;
  quantity: number;
}

export function reservePriceKey(symbol: string, contract: string): string {
  return `${symbol.split(',').at(-1)?.trim().toUpperCase()}-${contract}`;
}

/** Bridge WAX prices through WAXUSDC, just as the analytics sampler does. */
export function buildReservePrices(tokens: TvlToken[]): Map<string, number> {
  const bridge = Number(tokens.find(t => reservePriceKey(t.symbol ?? '', t.contract ?? '') === 'WAXUSDC-eth.token')?.system_price);
  const prices = new Map<string, number>();
  if (!Number.isFinite(bridge) || bridge <= 0) return prices;
  for (const token of tokens) {
    const price = Number(token.system_price) / bridge;
    if (token.symbol && token.contract && Number.isFinite(price) && price > 0) {
      prices.set(reservePriceKey(token.symbol, token.contract), price);
    }
  }
  return prices;
}

export function isCheeseLeg(leg: ReserveLeg): boolean {
  return reservePriceKey(leg.symbol, leg.contract) === 'CHEESE-cheeseburger';
}

/** Never double a single priced leg: concentrated reserves need not be balanced. */
export function valueReserves(legs: ReserveLeg[], prices: ReadonlyMap<string, number>): {
  usd: number;
  complete: boolean;
} {
  let usd = 0;
  let complete = true;
  for (const leg of legs) {
    if (!Number.isFinite(leg.quantity) || leg.quantity < 0) { complete = false; continue; }
    if (leg.quantity === 0) continue;
    const price = prices.get(reservePriceKey(leg.symbol, leg.contract));
    if (price === undefined || !Number.isFinite(price) || price <= 0) { complete = false; continue; }
    usd += leg.quantity * price;
  }
  return { usd, complete };
}