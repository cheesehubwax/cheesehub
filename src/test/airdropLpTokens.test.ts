import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAlcorLpHolders, type AlcorPair } from '@/lib/airdropAlcorLp';
import { getVenueLpHolders, type VenueLpPair } from '@/lib/airdropVenueLp';

vi.mock('@/lib/alcorRouter', () => ({ markAlcorRateLimited: vi.fn() }));
vi.mock('@/lib/lpVenues', () => ({
  fetchAllAmmPools: vi.fn(async (venue: string) => venue === 'taco' ? [
    { venue: 'taco', shareContract: 'swap.taco', shareSymbol: 'LP1', totalShares: 100,
      symbolA: 'WAX', contractA: 'eosio.token', reserveA: 200,
      symbolB: 'CHEESE', contractB: 'cheeseburger', reserveB: 400 },
    { venue: 'taco', shareContract: 'swap.taco', shareSymbol: 'LP2', totalShares: 100,
      symbolA: 'CHEESE', contractA: 'cheeseburger', reserveA: 600,
      symbolB: 'WAX', contractB: 'eosio.token', reserveB: 300 },
  ] : []),
  fetchShareHolders: vi.fn(async () => [{ account: 'alice', shares: 25 }]),
  fetchUsdPrices: vi.fn(async () => new Map([['CHEESE-cheeseburger', 1], ['WAX-eosio.token', 2]])),
  priceKey: (symbol: string, contract: string) => `${symbol}-${contract}`,
}));

afterEach(() => vi.unstubAllGlobals());
const pair: AlcorPair = {
  key: 'CHEESE-cheeseburger|WAX-eosio.token', symbolA: 'CHEESE', contractA: 'cheeseburger',
  symbolB: 'WAX', contractB: 'eosio.token', poolIds: [1, 2], fees: [3000, 10000], tvlUSD: 100,
};

function respond(handler: (url: string) => unknown) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, json: async () => handler(url) })));
}

describe('LP underlying token quantities', () => {
  it('adds current amounts across fee tiers in pair order without changing USD weights', async () => {
    respond((url) => url.endsWith('/1/positions') ? [
      { owner: 'alice', liquidity: 1, totalValue: 10, amountA: '2.5000 CHEESE', amountB: '3.00000000 WAX' },
      { owner: 'alice', liquidity: 1, totalValue: 5, inRange: false, amountA: '1.5000 CHEESE', amountB: '0.00000000 WAX' },
      { owner: 'alice', liquidity: 0, totalValue: 100, amountA: '100 CHEESE', amountB: '100 WAX' },
    ] : [
      { owner: 'alice', liquidity: 1, totalValue: 20, amountA: '4.00000000 WAX', amountB: '5.0000 CHEESE' },
    ]);
    const snapshot = await getAlcorLpHolders(pair);
    expect(snapshot.holders[0]).toEqual({ account: 'alice', weight: 35, raw: '$35.00',
      lpTokens: { tokenA: { symbol: 'CHEESE', amount: 9 }, tokenB: { symbol: 'WAX', amount: 7 } } });
    expect(snapshot.positions).toBe(3);
  });

  it('uses original pool direction for numeric amounts and retains tiny token quantities', async () => {
    respond(() => [{ owner: 'alice', liquidity: 1, totalValue: 0.06, amountA: 0.00000068, amountB: 2 }]);
    const snapshot = await getAlcorLpHolders({ ...pair, poolIds: [1], poolTokenA: { 1: 'WAX-eosio.token' } });
    expect(snapshot.holders[0].lpTokens?.tokenA.amount).toBe(2);
    expect(snapshot.holders[0].lpTokens?.tokenB.amount).toBe(0.00000068);
  });

  it('keeps unavailable token amounts unknown rather than reporting zero or a partial sum', async () => {
    respond(() => [
      { owner: 'alice', liquidity: 1, totalValue: 1, amountA: '2 CHEESE', amountB: '3 WAX' },
      { owner: 'alice', liquidity: 1, totalValue: 1, amountA: '4 CHEESE' },
    ]);
    const snapshot = await getAlcorLpHolders({ ...pair, poolIds: [1] });
    expect(snapshot.holders[0].lpTokens?.tokenA.amount).toBe(6);
    expect(snapshot.holders[0].lpTokens?.tokenB.amount).toBeNull();
    expect(snapshot.holders[0].weight).toBe(2);
  });

  it('converts AMM shares into both reserve quantities and normalizes reversed pools', async () => {
    respond(() => []);
    const picked: VenueLpPair = { ...pair, venue: 'taco', key: `taco:${pair.key}` };
    const snapshot = await getVenueLpHolders(picked);
    expect(snapshot.holders[0].lpTokens).toEqual({
      tokenA: { symbol: 'CHEESE', amount: 250 }, tokenB: { symbol: 'WAX', amount: 125 },
    });
    expect(snapshot.holders[0].weight).toBe(500);
  });
});