import { describe, expect, it } from 'vitest';
import {
  TRACKED_LP_PAIRS,
  departedProviders,
  venuePair,
  assetAmount,
  assetSymbol,
  alcorCheesePairs,
  buildPoolSnapshot,
  balanceInRange,
  resolveInRange,
  tickInRange,
  alcorPairVolume,
  cheeseIsTokenA,
  dayAbout24hBefore,
  indexEntryForDay,
  mergeIndexDay,
  poolsForPair,
  selectVenuePairs,
  utcDay,
  utcSlot,
  lpTokenConfig,
  pairFor,
  HOLE_TOKEN,
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

describe('alcorCheesePairs', () => {
  const prices = new Map([
    ['CHEESE-cheeseburger', 0.025],
    ['HOLE-hole.cheese', 0.058],
    ['WAX-eosio.token', 0.04],
  ]);

  it('derives TVL from reserves when Alcor reports tvlUSD 0 (HOLE/CHEESE pool 11051)', () => {
    const pools: RawPool[] = [
      // Real shape of Alcor pool 11051: tvlUSD 0 despite thousands in reserves.
      {
        id: 11051, active: true, tvlUSD: 0,
        tokenA: { ...cheese, quantity: 125144.4886 },
        tokenB: { ...hole, quantity: 68460.92018773 },
      },
      { id: 11055, active: true, tvlUSD: 13.4, tokenA: { ...wax, quantity: 335 }, tokenB: { ...hole, quantity: 0 } },
    ];
    const pairs = alcorCheesePairs(pools, HOLE_TOKEN, prices);
    const holeCheese = pairs.find((p) => p.pair.key === 'cheese-cheeseburger')!;
    // 125144.4886 * 0.025 + 68460.92018773 * 0.058 ≈ 7099 — Alcor's 0 is ignored.
    expect(holeCheese.tvlUsd).toBeGreaterThan(7000);
    const selected = selectVenuePairs(pairs, 100, 12, () => false);
    expect(selected.map((s) => s.pair.key)).toEqual(['cheese-cheeseburger']);
  });

  it('falls back to Alcor tvlUSD when a token has no known USD price', () => {
    const pools: RawPool[] = [
      { id: 1, active: true, tvlUSD: 250, tokenA: cheese, tokenB: { symbol: 'MYSTERY', contract: 'x.token', quantity: 5 } },
    ];
    // CHEESE has a price but zero reserves here; MYSTERY has neither.
    const pairs = alcorCheesePairs(pools, HOLE_TOKEN, new Map());
    expect(pairs).toHaveLength(0); // no HOLE pools in this fixture
    const asCheese = alcorCheesePairs(pools, undefined, new Map());
    expect(asCheese[0].tvlUsd).toBe(250);
  });
});

describe('alcorPairVolume', () => {
  it('sums USD volume and the CHEESE leg across fee tiers, either side', () => {
    const tiers: RawPool[] = [
      { id: 1, tokenA: cheese, tokenB: wax, volumeUSD24: 68.5, volumeA24: 9421.25, volumeB24: 15011.06 },
      { id: 2, tokenA: wax, tokenB: cheese, volumeUSD24: 10, volumeA24: 100, volumeB24: 500 },
    ];
    expect(alcorPairVolume(tiers)).toEqual({ volumeUsd24: 78.5, volumeCheese24: 9921.25 });
  });

  it('omits fields entirely when the payload carries no volume', () => {
    expect(alcorPairVolume([{ id: 1, tokenA: cheese, tokenB: wax }])).toEqual({});
  });
});

describe('buildPoolSnapshot', () => {
  const pool: RawPool = { id: 1252, fee: 3000, active: true, tokenA: cheese, tokenB: wax, tick: 96500, priceA: 1.6 };
  const flipped: RawPool = { id: 10585, fee: 500, active: true, tokenA: wax, tokenB: cheese };

  const positions: RawPosition[] = [
    {
      owner: 'illustration',
      liquidity: '40447860465',
      closed: false,
      inRange: true,
      tickLower: -443580,
      tickUpper: 443580,
      totalValue: 489.5,
      amountA: '32061.4566 CHEESE',
      amountB: '51027.91765505 WAX',
    },
    {
      owner: 'illustration',
      liquidity: '10',
      closed: false,
      inRange: false,
      // The pool sits at 96500, below this range.
      tickLower: 100000,
      tickUpper: 101000,
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

  it('records each position range and counts in-range from the ticks', () => {
    const snapshot = buildPoolSnapshot(venuePair('alcor', waxPair), [{ pool, positions }]);
    const top = snapshot.providers[0];
    expect(snapshot.tick).toBe(96500);
    expect(top.inRange).toBe(1);
    expect(top.ranges).toHaveLength(2);
    expect(top.ranges?.[0]).toEqual({ in: 1, full: 1 });
    const narrow = top.ranges?.[1];
    expect(narrow?.in).toBe(0);
    expect(narrow?.lo).toBeGreaterThan(0);
    expect(narrow?.hi).toBeGreaterThan(narrow?.lo ?? 0);
    expect(snapshot.rangeMismatch).toBeUndefined();
  });

  it('ignores the exchange flag when the ticks contradict it, and counts the disagreement', () => {
    const lying: RawPosition[] = [
      {
        owner: 'liar',
        liquidity: '10',
        // Alcor claims in range while the pool sits well below the range.
        inRange: true,
        tickLower: 120000,
        tickUpper: 121000,
        totalValue: 5,
        amountA: '100.0000 CHEESE',
        amountB: '0.00000000 WAX',
      },
    ];
    const snapshot = buildPoolSnapshot(venuePair('alcor', waxPair), [{ pool, positions: lying }]);
    expect(snapshot.providers[0].inRange).toBe(0);
    expect(snapshot.rangeMismatch).toBe(1);
  });

  it('falls back to token balances when a snapshot has no ticks', () => {
    const noTicks: RawPool = { id: 1252, tokenA: cheese, tokenB: wax };
    const rows: RawPosition[] = [
      { owner: 'both', liquidity: '10', totalValue: 9, amountA: '10.0000 CHEESE', amountB: '5.00000000 WAX' },
      { owner: 'onesided', liquidity: '10', totalValue: 8, amountA: '10.0000 CHEESE' },
    ];
    const snapshot = buildPoolSnapshot(venuePair('alcor', waxPair), [{ pool: noTicks, positions: rows }]);
    const byName = new Map(snapshot.providers.map((p) => [p.a, p]));
    expect(byName.get('both')?.inRange).toBe(1);
    expect(byName.get('onesided')?.inRange).toBe(0);
  });
});

describe('in-range resolution', () => {
  it('reads the pool tick against the position range', () => {
    expect(tickInRange(100, 0, 200)).toBe(true);
    expect(tickInRange(200, 0, 200)).toBe(false);
    expect(tickInRange(-1, 0, 200)).toBe(false);
    expect(tickInRange(undefined, 0, 200)).toBeNull();
    expect(tickInRange(100, 200, 200)).toBeNull();
  });

  it('treats both tokens as proof of being in range and one token as proof against', () => {
    expect(balanceInRange(10, 5)).toBe(true);
    expect(balanceInRange(10, 0)).toBe(false);
    expect(balanceInRange(0, 5)).toBe(false);
    expect(balanceInRange(0, 0)).toBeNull();
  });

  it('prefers ticks, then balances, then the exchange flag', () => {
    expect(resolveInRange({ poolTick: 10, tickLower: 0, tickUpper: 100, cheese: 1, paired: 0, flag: false }))
      .toEqual({ inRange: true, mismatch: true });
    expect(resolveInRange({ cheese: 1, paired: 0, flag: true })).toEqual({ inRange: false, mismatch: true });
    expect(resolveInRange({ cheese: 0, paired: 0, flag: true })).toEqual({ inRange: true, mismatch: false });
    expect(resolveInRange({ cheese: 0, paired: 0 })).toEqual({ inRange: false, mismatch: false });
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

  it('keys snapshots by 12h UTC slot', () => {
    expect(utcSlot(Date.UTC(2026, 8, 12, 0, 0))).toBe('2026-09-12T00');
    expect(utcSlot(Date.UTC(2026, 8, 12, 11, 59))).toBe('2026-09-12T00');
    expect(utcSlot(Date.UTC(2026, 8, 12, 12, 0))).toBe('2026-09-12T12');
    expect(utcSlot(Date.UTC(2026, 8, 12, 23, 59))).toBe('2026-09-12T12');
  });

  it('sorts legacy day keys before the slots of the same day', () => {
    const days = [
      { date: '2026-09-12T12', t: 0, pools: [] },
      { date: '2026-09-12', t: 0, pools: [] },
    ];
    const merged = mergeIndexDay(days, { date: '2026-09-12T00', t: 0, pools: [] });
    expect(merged.map((d) => d.date)).toEqual(['2026-09-12', '2026-09-12T00', '2026-09-12T12']);
  });
});

describe('dayAbout24hBefore', () => {
  const HOUR = 60 * 60_000;
  const day = (t: number, date: string) => ({ date, t, pools: [] });
  const base = Date.UTC(2026, 8, 13, 12, 41); // current snapshot time

  it('picks the snapshot closest to 24h before the current one', () => {
    const days = [
      day(base - 36 * HOUR, '2026-09-12T00'),
      day(base - 25 * HOUR, '2026-09-12T12'),
      day(base - 12 * HOUR, '2026-09-13T00'),
      day(base, '2026-09-13T12'),
    ];
    expect(dayAbout24hBefore(days, base)?.date).toBe('2026-09-12T12');
  });

  it('returns null when all history is less than 12h older', () => {
    const days = [day(base - 6 * HOUR, '2026-09-13T00')];
    expect(dayAbout24hBefore(days, base)).toBeNull();
    expect(dayAbout24hBefore([], base)).toBeNull();
  });

  it('ignores entries at or after the current snapshot', () => {
    const days = [day(base + HOUR, '2026-09-13T13'), day(base, '2026-09-13T12')];
    expect(dayAbout24hBefore(days, base)).toBeNull();
  });
});

describe('HOLE as the base token', () => {
  const holeCheesePair = venuePair('alcor', pairFor('CHEESE', 'cheeseburger'));
  const pools: RawPool[] = [
    { id: 11051, fee: 3000, active: true, tokenA: cheese, tokenB: hole },
    { id: 11055, fee: 3000, active: true, tokenA: wax, tokenB: hole },
  ];

  it('matches the CHEESE pair from the HOLE side', () => {
    expect(poolsForPair(pools, holeCheesePair, HOLE_TOKEN).map((p) => p.id)).toEqual([11051]);
    expect(cheeseIsTokenA({ id: 11051, tokenA: cheese, tokenB: hole }, HOLE_TOKEN)).toBe(false);
    expect(cheeseIsTokenA({ id: 11055, tokenA: wax, tokenB: hole }, HOLE_TOKEN)).toBe(false);
  });

  it('measures HOLE on its own side of the pool', () => {
    const positions: RawPosition[] = [
      {
        owner: 'hole.cheese',
        liquidity: '1000',
        closed: false,
        inRange: true,
        totalValue: 12.5,
        amountA: '100.0000 CHEESE',
        amountB: '50.0000 HOLE',
      },
    ];
    const snap = buildPoolSnapshot(
      holeCheesePair,
      [{ pool: pools[0], positions }],
      { cheeseUsd: 0.019, pairedUsd: 0.016 },
      HOLE_TOKEN,
    );
    expect(snap.symbol).toBe('CHEESE');
    // HOLE is tokenB here, so the base amount comes from amountB.
    expect(snap.cheese).toBeCloseTo(50, 4);
    expect(snap.paired).toBeCloseTo(100, 4);
    expect(snap.accounts).toBe(1);
  });


  it('keeps token data paths separate', () => {
    expect(lpTokenConfig('cheese').dataPath).toBe('');
    expect(lpTokenConfig('hole').dataPath).toBe('hole');
    expect(lpTokenConfig('hole').contract).toBe('hole.cheese');
  });
});

describe('departedProviders (tombstone)', () => {
  const pool = (key: string, venue: 'alcor' | 'taco', providers: { a: string; usd: number }[]) => ({
    key,
    venue,
    pairKey: key.split(':')[1],
    symbol: 'WAX',
    contract: 'eosio.token',
    label: 'CHEESE / WAX',
    poolIds: [1],
    usd: providers.reduce((s, p) => s + p.usd, 0),
    cheese: 0,
    paired: 0,
    accounts: providers.length,
    positions: providers.length,
    providers: providers.map((p) => ({ a: p.a, usd: p.usd, cheese: 0, paired: 0, pos: 1, inRange: 1 })),
  });

  const snapshots = [
    {
      date: '2026-09-01T00',
      t: 1,
      pools: [
        pool('alcor:wax-eosio.token', 'alcor', [
          { a: 'leaver', usd: 500 },
          { a: 'tiny', usd: 4 },
          { a: 'stayer', usd: 300 },
          { a: 'dusty', usd: 80 },
        ]),
        pool('taco:wax-eosio.token', 'taco', [{ a: 'tacoleaver', usd: 60 }]),
      ],
    },
    {
      date: '2026-09-02T00',
      t: 2,
      pools: [
        pool('alcor:wax-eosio.token', 'alcor', [
          { a: 'stayer', usd: 310 },
          { a: 'dusty', usd: 0.4 },
          { a: 'tiny', usd: 2 },
        ]),
        pool('taco:wax-eosio.token', 'taco', []),
      ],
    },
  ];

  it('lists an account that pulled its liquidity, with peak and last-seen dates', () => {
    const rows = departedProviders(snapshots);
    const leaver = rows.find((r) => r.account === 'leaver');
    expect(leaver).toBeDefined();
    expect(leaver?.peakUsd).toBeCloseTo(500, 4);
    expect(leaver?.peakDate).toBe('2026-09-01T00');
    expect(leaver?.lastActiveDate).toBe('2026-09-01T00');
    expect(leaver?.currentUsd).toBe(0);
    expect(leaver?.pools.map((p) => p.key)).toEqual(['alcor:wax-eosio.token']);
  });

  it('excludes accounts that never passed $10 and accounts still holding value', () => {
    const accounts = departedProviders(snapshots).map((r) => r.account);
    expect(accounts).not.toContain('tiny');
    expect(accounts).not.toContain('stayer');
  });

  it('includes dust-only leftovers and sorts by peak value', () => {
    const rows = departedProviders(snapshots);
    const dusty = rows.find((r) => r.account === 'dusty');
    expect(dusty?.currentUsd).toBeCloseTo(0.4, 4);
    expect(rows.map((r) => r.account)).toEqual(['leaver', 'dusty', 'tacoleaver']);
  });

  it('narrows peaks and current values to one venue', () => {
    expect(departedProviders(snapshots, 'taco').map((r) => r.account)).toEqual(['tacoleaver']);
    expect(departedProviders(snapshots, 'alcor').map((r) => r.account)).toEqual(['leaver', 'dusty']);
  });
});
