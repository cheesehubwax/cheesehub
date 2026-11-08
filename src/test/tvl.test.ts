import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildReservePrices, valueReserves, isCheeseLeg } from '@/lib/tvlPricing';
import { fetchAlcorSwapCheeseTVL, fetchCheeseTotalTVL, fetchDefiboxCheeseTVL, fetchTacoCheeseTVL } from '@/lib/tvl';

vi.mock('@/lib/chainRequest', () => ({ chainPost: vi.fn() }));
import { chainPost } from '@/lib/chainRequest';

const prices = new Map([
  ['CHEESE-cheeseburger', 0.006], ['HOLE-hole.cheese', 0.016],
  ['WAX-eosio.token', 0.004], ['WAXUSDC-eth.token', 1],
  ['LSWAX-token.fusion', 0.005],
]);
const cheese = { symbol: 'CHEESE', contract: 'cheeseburger', quantity: 100000 };
const hole = { symbol: 'HOLE', contract: 'hole.cheese', quantity: 50000 };

afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks(); });

describe('live reserve pricing', () => {
  it('bridges token prices through WAXUSDC, not Alcor raw USD prices', () => {
    expect(buildReservePrices([
      { symbol: 'WAXUSDC', contract: 'eth.token', system_price: 250 },
      { symbol: 'HOLE', contract: 'hole.cheese', system_price: 4 },
    ]).get('HOLE-hole.cheese')).toBe(0.016);
  });
  it('keeps missing and non-finite prices unavailable', () => {
    expect(buildReservePrices([{ symbol: 'HOLE', contract: 'hole.cheese', system_price: 4 }]).size).toBe(0);
    expect(valueReserves([cheese, hole], new Map([['CHEESE-cheeseburger', 0.006]]))).toEqual({ usd: 600, complete: false });
    expect(valueReserves([hole], new Map([['HOLE-hole.cheese', Infinity]]))).toEqual({ usd: 0, complete: false });
  });
  it('matches identity by exact symbol and contract', () => {
    expect(isCheeseLeg({ ...cheese, symbol: '4,CHEESE' })).toBe(true);
    expect(isCheeseLeg({ ...cheese, symbol: 'NOTCHEESE' })).toBe(false);
    expect(isCheeseLeg({ ...cheese, contract: 'fake.token' })).toBe(false);
  });
  it('does not double a one-sided concentrated reserve or mark empty legs unknown', () => {
    expect(valueReserves([cheese, { ...hole, quantity: 0 }], new Map([['CHEESE-cheeseburger', 0.006]]))).toEqual({ usd: 600, complete: true });
  });
  it('values HOLE pool 11051 despite tvlUSD zero, deduplicating both query sides and fee tiers', async () => {
    const pool = { id: 11051, active: true, tokenA: cheese, tokenB: hole, tvlUSD: 0 };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([
      pool, { ...pool, id: 11052 }, { ...pool, id: 11053, active: false },
      { ...pool, id: 11054, tokenA: { ...cheese, contract: 'fake.token' } },
    ]))));
    expect(await fetchAlcorSwapCheeseTVL(prices)).toEqual({ usd: 2800, complete: true });
  });
  it('includes reversed non-WAX Taco reserves from every page', async () => {
    vi.mocked(chainPost).mockResolvedValueOnce({ rows: [
      { pool1: { contract: 'eth.token', quantity: '100.000000 WAXUSDC' }, pool2: { contract: 'cheeseburger', quantity: '10000.0000 CHEESE' } },
    ], more: true, next_key: 'BBB' }).mockResolvedValueOnce({ rows: [
      { pool1: { contract: 'cheeseburger', quantity: '10000.0000 CHEESE' }, pool2: { contract: 'token.fusion', quantity: '10000.00000000 LSWAX' } },
    ], more: false });
    expect(await fetchTacoCheeseTVL(prices)).toEqual({ usd: 270, complete: true });
    expect(vi.mocked(chainPost).mock.calls[1][1]).toMatchObject({ lower_bound: 'BBB' });
  });
  it('includes non-WAX Defibox reserves with precision-prefixed symbols', async () => {
    vi.mocked(chainPost).mockResolvedValue({ rows: [{
      token0: { contract: 'hole.cheese', symbol: '8,HOLE' }, reserve0: '50000.00000000',
      token1: { contract: 'cheeseburger', symbol: '4,CHEESE' }, reserve1: '100000.0000',
    }], more: false });
    expect(await fetchDefiboxCheeseTVL(prices)).toEqual({ usd: 1400, complete: true });
  });
  it('rejects incomplete table reads rather than silently returning the first page', async () => {
    vi.mocked(chainPost).mockResolvedValue({ rows: [], more: true });
    await expect(fetchTacoCheeseTVL(prices)).rejects.toThrow('cursor stalled');
  });
  it('marks unavailable venues partial and unknown instead of reporting zero', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/tokens')) return new Response(JSON.stringify([
        { symbol: 'WAXUSDC', contract: 'eth.token', system_price: 250 },
        { symbol: 'WAX', contract: 'eosio.token', system_price: 1 },
        { symbol: 'CHEESE', contract: 'cheeseburger', system_price: 1.5 },
      ]));
      if (url.includes('/tickers/')) return new Response(JSON.stringify({ target_volume: 0 }));
      return new Response('[]');
    }));
    vi.mocked(chainPost).mockImplementation(async (path, body) => {
      if (body.code === 'swap.taco') throw new Error('Unavailable');
      return path.endsWith('get_currency_balance') ? [] : { rows: [], more: false };
    });
    const result = await fetchCheeseTotalTVL(0.004, 0.006);
    expect(result.taco).toBeNull();
    expect(result.partial).toBe(true);
    expect(result.totalUSD).toBe(0);
  });
});