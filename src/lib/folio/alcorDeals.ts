// Alcor's own record of every order-book deal an account took part in. One
// request returns what a fill gave, so most fills need no per-transaction
// history lookup (the slow part of a first scan).
import type { RawTransfer } from './types';

const ALCOR_API = 'https://wax.alcor.exchange/api';
const PAGE = 1000;
const TIMEOUT_MS = 20_000;

export interface AlcorDeal {
  market: number;
  trx_id: string;
  ask: number;
  bid: number;
  asker?: string;
  bidder?: string;
}

interface MarketToken { contract: string; symbol: { name: string; precision: number } }
export interface AlcorMarket { id: number; base_token: MarketToken; quote_token: MarketToken }

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/** All deals of `account`, or null when Alcor could not be read completely. */
export async function fetchAlcorDeals(account: string, signal?: AbortSignal): Promise<AlcorDeal[] | null> {
  const all: AlcorDeal[] = [];
  for (let skip = 0; skip < 200_000; skip += PAGE) {
    const page = await getJson<AlcorDeal[]>(`${ALCOR_API}/v2/account/${account}/deals?limit=${PAGE}&skip=${skip}`, signal);
    if (!Array.isArray(page)) return null;
    all.push(...page);
    if (page.length < PAGE) return all;
  }
  return all;
}

let marketsPromise: Promise<Map<number, AlcorMarket> | null> | null = null;
export function fetchAlcorMarkets(signal?: AbortSignal): Promise<Map<number, AlcorMarket> | null> {
  if (!marketsPromise) {
    marketsPromise = getJson<AlcorMarket[]>(`${ALCOR_API}/markets`, signal).then((list) =>
      Array.isArray(list) ? new Map(list.map((m) => [m.id, m])) : null,
    );
    void marketsPromise.then((m) => { if (!m) marketsPromise = null; });
  }
  return marketsPromise;
}

const symOf = (asset: string) => asset.trim().split(/\s+/)[1];
const amountOf = (asset: string) => parseFloat(asset.trim().split(/\s+/)[0]);

/**
 * What the account gave for one fill, from the deal in the same transaction
 * whose one side equals what was received. The other side, in the market's
 * other token, is what was given. Null when no deal matches exactly.
 */
export function fillGaveFromDeals(
  deals: AlcorDeal[],
  markets: Map<number, AlcorMarket>,
  account: string,
  t: RawTransfer,
): RawTransfer['fillGave'] {
  const gotSym = symOf(t.quantity);
  const gotAmt = amountOf(t.quantity);
  const precision = t.quantity.trim().split(/\s+/)[0].split('.')[1]?.length ?? 0;
  const tol = 0.5 * 10 ** -precision;
  for (const d of deals) {
    if (d.trx_id !== t.trx || (d.asker !== account && d.bidder !== account)) continue;
    const m = markets.get(d.market);
    if (!m) continue;
    const tokens = [m.base_token, m.quote_token];
    const got = tokens.find((x) => x.contract === t.contract && x.symbol.name === gotSym);
    const other = tokens.find((x) => x !== got);
    if (!got || !other) continue;
    for (const [g, gave] of [[d.ask, d.bid], [d.bid, d.ask]] as const) {
      if (Math.abs(g - gotAmt) > tol || !(gave > 0)) continue;
      return { contract: other.contract, quantity: `${gave.toFixed(other.symbol.precision)} ${other.symbol.name}` };
    }
  }
  return null;
}

/** Fills every unchecked order-book fill that Alcor's deal list explains. Returns how many. */
export function applyAlcorDeals(
  transfers: RawTransfer[],
  deals: AlcorDeal[],
  markets: Map<number, AlcorMarket>,
  account: string,
  isFill: (t: RawTransfer) => boolean,
): number {
  const byTrx = new Map<string, AlcorDeal[]>();
  for (const d of deals) byTrx.set(d.trx_id, [...(byTrx.get(d.trx_id) ?? []), d]);
  let n = 0;
  for (const t of transfers) {
    if (!isFill(t) || t.fillChecked) continue;
    const list = byTrx.get(t.trx);
    if (!list) continue;
    const gave = fillGaveFromDeals(list, markets, account, t);
    if (!gave) continue;
    t.fillGave = gave;
    t.fillChecked = true;
    n++;
  }
  return n;
}
