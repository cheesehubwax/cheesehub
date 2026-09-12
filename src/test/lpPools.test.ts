import { describe, expect, it } from 'vitest';
import {
  TRACKED_LP_PAIRS,
  venuePair,
  assetAmount,
  assetSymbol,
  buildPoolSnapshot,
  cheeseIsTokenA,
  indexEntryForDay,
  mergeIndexDay,
  poolsForPair,
  utcDay,
  type RawPool,
  type RawPosition,
} from '@/lib/lpPools';

const cheese = { symbol: 'CHEESE', contract: 'cheeseburger' };
const wax = { symbol: 'WAX', contract: 'eosio.token' };
const hole = { symbol: 'HOLE', contract: 'hole.cheese' };

const waxPair = TRACKED_LP_PAIRS.find((p) => p.symbol === 'WAX')!;
const holePair = TRACKED_LP_PAIRS.find((p) => p.symbol === 'HOLE')!;

describe('asset parsing', () => {
  it('reads amount and symbol from an asset string', () => {
    expect(assetAmount('32061.4566 CHEESE')).toBeCloseTo(32061.4566, 4);
    expect(assetSymbol('1498.27295449 WAX')).toBe('WAX');
    expect(assetAmount(undefined)).toBe(0);
    expect(assetSymbol(undefined)).toBe('');
  });
});

describe('poolsForPair', () => {
  const pools: RawPool[] = [
    { id: 1252, fee: 3000, active: true, tokenA: cheese, tokenB: wax },
    { id: 10585, fee: 500, active: true, tokenA: cheese, tokenB: wax },
    { id: 10594, fee: 10000, active: false, tokenA: cheese, tokenB: wax },
    { id: 11051, fee: 3000, active: true, tokenA: cheese, tokenB: hole },
    { id: 8205, fee: 3000, active: true, tokenA: wax, tokenB: { symbol: 'CHEESE', contract: 'waxlord.gm' } },
  ];

  it('collects every active fee tier of the pair, sorted by id', () => {
    expect(poolsForPair(pools, waxPair).map((p) => p.id)).toEqual([1252, 10585]);
  });

  it('ignores look-alike pairs on another CHEESE contract', () => {
    const ids = poolsForPair(pools, waxPair).map((p) => p.id);
    expect(ids).not.toContain(8205);
  });

  it('matches the paired token by symbol and contract', () => {
    expect(poolsForPair(pools, holePair).map((p) => p.id)).toEqual([11051]);
  });

  it('knows which side CHEESE sits on', () => {
    expect(cheeseIsTokenA({ id: 1, tokenA: cheese, tokenB: wax })).toBe(true);
    expect(cheeseIsTokenA({ id: 2, tokenA: wax, tokenB: cheese })).toBe(false);
  });
});

describe('buildPoolSnapshot', () => {
  const pool: RawPool = { id: 1252, fee: 3000, active: true, tokenA: cheese, tokenB: wax };
  const flipped: RawPool = { id: 10585, fee: 500, active: true, tokenA: wax, tokenB: cheese };

  const positions: RawPosition[] = [
    {
      owner: 'illustration',
      liquidity: '40447860465',
      closed: false,
      inRange: true,
      totalValue: 489.5,
      amountA: '32061.4566 CHEESE',
      amountB: '51027.91765505 WAX',
    },
    {
      owner: 'illustration',
      liquidity: '10',
      closed: false,
      inRange: false,
      totalValue: 10.5,
      amountA: '100.0000 CHEESE',
      amountB: '200.00000000 WAX',
    },
    // closed and zero-liquidity rows are ignored
    { owner: 'ghost', liquidity: '0', closed: false, totalValue: 99, amountA: '1.0000 CHEESE' },
    { owner: 'ghost', liquidity: '5', closed: true, totalValue: 99, amountA: '1.0000 CHEESE' },
    { owner: '', liquidity: '5', totalValue: 5, amountA: '1.0000 CHEESE' },
  ];

  const flippedPositions: RawPosition[] = [
    {
      owner: 'liquidcheese',
      liquidity: '99',
      inRange: true,
      // Deposited value is only used when totalValue is absent.
      depositedUSDTotal: 42,
      amountA: '500.00000000 WAX',
      amountB: '250.0000 CHEESE',
    },
  ];

  it('aggregates per account and per pool across fee tiers', () => {
    const snapshot = buildPoolSnapshot(venuePair('alcor', waxPair), [
      { pool, positions },
      { pool: flipped, positions: flippedPositions },
    ]);

    expect(snapshot.poolIds).toEqual([1252, 10585]);
    expect(snapshot.positions).toBe(3);
    expect(snapshot.accounts).toBe(2);
    expect(snapshot.usd).toBeCloseTo(542, 2);
    expect(snapshot.cheese).toBeCloseTo(32411.4566, 4);
    expect(snapshot.paired).toBeCloseTo(51727.91765505, 6);

    const top = snapshot.providers[0];
    expect(top.a).toBe('illustration');
    expect(top.usd).toBeCloseTo(500, 2);
    expect(top.cheese).toBeCloseTo(32161.4566, 4);
    expect(top.paired).toBeCloseTo(51227.91765505, 6);
    expect(top.pos).toBe(2);
    expect(top.inRange).toBe(1);

    // The flipped pool's CHEESE leg is read from token B.
    const second = snapshot.providers[1];
    expect(second.a).toBe('liquidcheese');
    expect(second.cheese).toBeCloseTo(250, 4);
    expect(second.paired).toBeCloseTo(500, 6);
    expect(second.usd).toBeCloseTo(42, 2);
  });

  it('ranks providers by USD value, highest first', () => {
    const snapshot = buildPoolSnapshot(venuePair('alcor', waxPair), [{ pool, positions }, { pool: flipped, positions: flippedPositions }]);
    const values = snapshot.providers.map((p) => p.usd);
    expect(values).toEqual([...values].sort((a, b) => b - a));
  });
});

describe('index bookkeeping', () => {
  const day = {
    date: '2026-09-12',
    t: Date.UTC(2026, 8, 12, 1, 41),
    cheeseUsd: 0.0123,
    pools: [
      {
        key: `alcor:${waxPair.key}`,
        venue: 'alcor' as const,
        pairKey: waxPair.key,
        symbol: 'WAX',
        contract: 'eosio.token',
        label: waxPair.label,
        poolIds: [1252],
        usd: 100,
        cheese: 50,
        paired: 25,
        accounts: 2,
        positions: 3,
        providers: [{ a: 'alice', usd: 100, cheese: 50, paired: 25, pos: 3, inRange: 1 }],
      },
    ],
  };

  it('strips provider rows from the index entry', () => {
    const entry = indexEntryForDay(day);
    expect(entry.pools[0]).toEqual({
      key: `alcor:${waxPair.key}`,
      venue: 'alcor',
      pairKey: waxPair.key,
      symbol: 'WAX',
      usd: 100,
      cheese: 50,
      paired: 25,
      accounts: 2,
      positions: 3,
    });
    expect(entry.cheeseUsd).toBe(0.0123);
    expect(entry.uniqueByVenue).toEqual({ alcor: 1 });
  });

  it('replaces an existing day and keeps the series sorted', () => {
    const first = indexEntryForDay(day);
    const rewritten = { ...first, pools: [{ ...first.pools[0], usd: 200 }] };
    const older = { ...first, date: '2026-09-11' };
    const merged = mergeIndexDay([older, first], rewritten);
    expect(merged.map((d) => d.date)).toEqual(['2026-09-11', '2026-09-12']);
    expect(merged[1].pools[0].usd).toBe(200);
  });

  it('caps the stored series', () => {
    const days = Array.from({ length: 5 }, (_, i) => ({
      date: `2026-09-0${i + 1}`,
      t: 0,
      pools: [],
    }));
    const merged = mergeIndexDay(days, { date: '2026-09-10', t: 0, pools: [] }, 3);
    expect(merged.map((d) => d.date)).toEqual(['2026-09-04', '2026-09-05', '2026-09-10']);
  });

  it('uses UTC calendar days', () => {
    expect(utcDay(Date.UTC(2026, 8, 12, 23, 59))).toBe('2026-09-12');
  });
});
