// Tokens the account has sitting in liquidity pools right now, so they count
// toward its holdings. Read live from the chain, like wallet balances:
//  - Alcor: the account's concentrated-liquidity positions, sized from each
//    pool's current price (uncollected fees are not included).
//  - Taco / Defibox: the account's pool-share tokens × the pool's reserves.
// A venue that can't be read is reported in `failed`, never treated as zero.
import { fetchTableRows } from '@/lib/waxRpcFallback';
import { fetchAllAmmPools, type AnyAmmPool } from '@/lib/lpVenues';
import { positionRawAmounts } from '@/lib/alcorV3Amounts';

export { positionRawAmounts };
import type { TokenKey } from './types';

export type PoolVenue = 'alcor' | 'taco' | 'defibox';

export interface PooledPart {
  venue: PoolVenue;
  /** e.g. "CHEESE / WAX". */
  pair: string;
  qty: number;
}

export interface PooledToken {
  key: TokenKey;
  contract: string;
  symbol: string;
  precision: number;
  qty: number;
  parts: PooledPart[];
}

export interface PooledResult {
  tokens: Map<TokenKey, PooledToken>;
  failed: PoolVenue[];
}

/** A pool-share token the wallet holds (Taco `swap.taco`, Defibox `lptoken.box`). */
export interface ShareBalance {
  contract: string;
  symbol: string;
  balance: number;
}

export const TACO_SHARE_CONTRACT = 'swap.taco';
export const DEFIBOX_SHARE_CONTRACT = 'lptoken.box';

interface ChainPosition {
  id: number;
  owner: string;
  pool: number;
  liquidity: string | number;
  tickLower: number;
  tickUpper: number;
}

interface ChainPool {
  id: number;
  tokenA: { contract: string; quantity: string };
  tokenB: { contract: string; quantity: string };
  currSlot: { sqrtPriceX64: string; tick: number };
}

function parseQty(asset: string): { symbol: string; precision: number } {
  const [amount = '', symbol = ''] = String(asset ?? '').trim().split(' ');
  return { symbol: symbol.toUpperCase(), precision: amount.split('.')[1]?.length ?? 0 };
}

/** Round down to the token's precision, as the chain pays out. */
function floorTo(value: number, precision: number): number {
  const f = 10 ** precision;
  return Math.floor(value * f + 1e-9) / f;
}

function add(out: Map<TokenKey, PooledToken>, contract: string, symbol: string, precision: number, qty: number, part: Omit<PooledPart, 'qty'>) {
  if (!(qty > 0)) return;
  const key = `${contract}:${symbol}`;
  const t = out.get(key) ?? { key, contract, symbol, precision, qty: 0, parts: [] };
  t.qty += qty;
  t.precision = Math.max(t.precision, precision);
  const same = t.parts.find((x) => x.venue === part.venue && x.pair === part.pair);
  if (same) same.qty += qty;
  else t.parts.push({ ...part, qty });
  out.set(key, t);
}

const ALCOR_API = 'https://wax.alcor.exchange/api/v2';

async function alcorPoolIds(account: string): Promise<number[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(`${ALCOR_API}/account/${encodeURIComponent(account)}/positions`, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`Alcor positions ${res.status}`);
    const data = (await res.json()) as { pool?: number; closed?: boolean }[];
    if (!Array.isArray(data)) throw new Error('Unexpected Alcor positions');
    return [...new Set(data.filter((p) => !p.closed && Number.isFinite(Number(p.pool))).map((p) => Number(p.pool)))];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Alcor's API says which pools the account is in; the amounts come from the
 * chain itself (positions are stored per pool, indexed by owner).
 */
async function readAlcor(account: string, out: Map<TokenKey, PooledToken>): Promise<void> {
  const poolIds = await alcorPoolIds(account);
  await Promise.all(poolIds.map(async (id) => {
    const [posRes, poolRes] = await Promise.all([
      fetchTableRows<ChainPosition>({
        code: 'swap.alcor', scope: String(id), table: 'positions',
        index_position: 3, key_type: 'name', lower_bound: account, upper_bound: account, limit: 100,
      }),
      fetchTableRows<ChainPool>({
        code: 'swap.alcor', scope: 'swap.alcor', table: 'pools', lower_bound: String(id), upper_bound: String(id), limit: 1,
      }),
    ]);
    const pool = poolRes?.rows?.[0];
    if (!pool || pool.id !== id) throw new Error(`Alcor pool ${id} not found`);
    const a = parseQty(pool.tokenA.quantity);
    const b = parseQty(pool.tokenB.quantity);
    const pair = `${a.symbol} / ${b.symbol}`;
    for (const pos of posRes?.rows ?? []) {
      if (pos.owner !== account || !(Number(pos.liquidity) > 0)) continue;
      const raw = positionRawAmounts(Number(pos.liquidity), pos.tickLower, pos.tickUpper, pool.currSlot?.sqrtPriceX64);
      if (!raw) throw new Error(`Alcor pool ${id} has no usable price`);
      add(out, pool.tokenA.contract, a.symbol, a.precision, floorTo(raw.rawA / 10 ** a.precision, a.precision), { venue: 'alcor', pair });
      add(out, pool.tokenB.contract, b.symbol, b.precision, floorTo(raw.rawB / 10 ** b.precision, b.precision), { venue: 'alcor', pair });
    }
  }));
}

/** Underlying amounts for share tokens of one Taco/Defibox venue. */
export function shareAmounts(shares: ShareBalance[], pools: AnyAmmPool[], venue: 'taco' | 'defibox', out: Map<TokenKey, PooledToken>): void {
  const bySymbol = new Map(pools.map((p) => [p.shareSymbol.toUpperCase(), p]));
  for (const s of shares) {
    const pool = bySymbol.get(s.symbol.toUpperCase());
    if (!pool || !(s.balance > 0) || !(pool.totalShares > 0)) continue;
    const frac = s.balance / pool.totalShares;
    const pa = pool.precisionA ?? 8;
    const pb = pool.precisionB ?? 8;
    const pair = `${pool.symbolA} / ${pool.symbolB}`;
    add(out, pool.contractA, pool.symbolA.toUpperCase(), pa, floorTo(frac * pool.reserveA, pa), { venue, pair });
    add(out, pool.contractB, pool.symbolB.toUpperCase(), pb, floorTo(frac * pool.reserveB, pb), { venue, pair });
  }
}

export async function fetchPooledTokens(account: string, shares: ShareBalance[]): Promise<PooledResult> {
  const tokens = new Map<TokenKey, PooledToken>();
  const failed: PoolVenue[] = [];
  const taco = shares.filter((s) => s.contract === TACO_SHARE_CONTRACT && s.balance > 0);
  const box = shares.filter((s) => s.contract === DEFIBOX_SHARE_CONTRACT && s.balance > 0);

  const alcorMap = new Map<TokenKey, PooledToken>();
  const [alcor, tacoPools, boxPools] = await Promise.allSettled([
    readAlcor(account, alcorMap),
    taco.length ? fetchAllAmmPools('taco') : Promise.resolve([] as AnyAmmPool[]),
    box.length ? fetchAllAmmPools('defibox') : Promise.resolve([] as AnyAmmPool[]),
  ]);

  const merge = (src: Map<TokenKey, PooledToken>) => {
    for (const t of src.values()) for (const part of t.parts) add(tokens, t.contract, t.symbol, t.precision, part.qty, part);
  };
  if (alcor.status === 'fulfilled') merge(alcorMap);
  else failed.push('alcor');
  if (tacoPools.status === 'fulfilled') shareAmounts(taco, tacoPools.value, 'taco', tokens);
  else failed.push('taco');
  if (boxPools.status === 'fulfilled') shareAmounts(box, boxPools.value, 'defibox', tokens);
  else failed.push('defibox');
  return { tokens, failed };
}
