import { describe, expect, it, vi, afterEach } from 'vitest';
import { fetchDefiboxPairVolume, fetchTacoPairVolume, sumPairVolume } from '@/lib/lpVenues';

const prices = new Map<string, number>([
  ['CHEESE@cheeserules1', 0.008],
  ['WAX@eosio.token', 0.005],
]);

function mockFetch(handler: (url: string) => unknown) {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => ({
    ok: true,
    status: 200,
    json: async () => handler(String(input)),
  })) as unknown as typeof fetch);
}

afterEach(() => vi.unstubAllGlobals());

describe('sumPairVolume', () => {
  it('adds the tiers of a pair and ignores missing parts', () => {
    expect(
      sumPairVolume([{ volumeUsd24: 10, volumeCheese24: 100 }, undefined, { volumeUsd24: 5 }]),
    ).toEqual({ volumeUsd24: 15, volumeCheese24: 100 });
  });

  it('returns nothing when no pool published a figure', () => {
    expect(sumPairVolume([undefined, {}])).toEqual({});
  });
});

describe('fetchDefiboxPairVolume', () => {
  it('uses the CHEESE leg directly and values it through WAX', async () => {
    mockFetch(() => ({
      waxUsdtPrice: '0.00536',
      data: [
        {
          id: 1305,
          symbol0: 'CHEESE',
          contract0: 'cheeserules1',
          symbol1: 'WAXUSDC',
          contract1: 'eth.token',
          reserve0: '1000.0000 CHEESE',
          reserve1: '8.000000 WAXUSDC',
          volume: 350.3749,
          volume_symbol: 'CHEESE',
          volume_wax: 537.0567,
        },
        // Volume published in the paired token: converted via the reserve ratio.
        {
          id: 1310,
          symbol0: 'WAX',
          contract0: 'eosio.token',
          symbol1: 'CHEESE',
          contract1: 'cheeserules1',
          reserve0: '13214.51816951 WAX',
          reserve1: '8621.1289 CHEESE',
          volume: 1202.43,
          volume_symbol: 'WAX',
          volume_wax: 1202.43,
        },
        // Not a CHEESE pair.
        { id: 9, symbol0: 'WAX', symbol1: 'TLM', volume: 1, volume_symbol: 'WAX', volume_wax: 1 },
      ],
    }));

    const volumes = await fetchDefiboxPairVolume(prices);
    expect(volumes.get('1305')).toEqual({ volumeUsd24: 2.6853, volumeCheese24: 350.3749 });
    const wax = volumes.get('1310');
    expect(wax?.volumeUsd24).toBeCloseTo(6.0122, 3);
    expect(wax?.volumeCheese24).toBeCloseTo(784.5, 0);
    expect(volumes.has('9')).toBe(false);
  });
});

describe('fetchTacoPairVolume', () => {
  it('sums the CHEESE leg per pair over the sweep', async () => {
    const now = Date.UTC(2026, 8, 15, 12, 0, 0);
    mockFetch(() => ({
      actions: [
        {
          global_sequence: 1,
          timestamp: '2026-09-15T11:00:00.000',
          act: { data: { id: 'CHEWAXB', quantity_in: '10.0000 CHEESE', quantity_out: '0.08 WAXUSDC' } },
        },
        {
          global_sequence: 2,
          timestamp: '2026-09-15T10:00:00.000',
          act: { data: { id: 'CHEWAXB', quantity_in: '0.04 WAXUSDC', quantity_out: '5.0000 CHEESE' } },
        },
        // Duplicate of the first record across page boundaries.
        {
          global_sequence: 1,
          timestamp: '2026-09-15T11:00:00.000',
          act: { data: { id: 'CHEWAXB', quantity_in: '10.0000 CHEESE', quantity_out: '0.08 WAXUSDC' } },
        },
        {
          global_sequence: 3,
          timestamp: '2026-09-15T09:00:00.000',
          act: { data: { id: 'CHEHOL', quantity_in: '2.0000 CHEESE', quantity_out: '1.0000 HOLE' } },
        },
        // No CHEESE leg — ignored.
        {
          global_sequence: 4,
          timestamp: '2026-09-15T08:00:00.000',
          act: { data: { id: 'WAXHOL', quantity_in: '1.00000000 WAX', quantity_out: '1.0000 HOLE' } },
        },
      ],
    }));

    const volumes = await fetchTacoPairVolume(prices, now);
    expect(volumes.get('CHEWAXB')).toEqual({ volumeUsd24: 0.12, volumeCheese24: 15 });
    expect(volumes.get('CHEHOL')).toEqual({ volumeUsd24: 0.016, volumeCheese24: 2 });
    expect(volumes.has('WAXHOL')).toBe(false);
  });

  it('refuses a partial total when the sweep cannot finish', async () => {
    const page = Array.from({ length: 1000 }, (_, i) => ({
      global_sequence: i,
      timestamp: '2026-09-15T11:00:00.000',
      act: { data: { id: 'CHEWAXB', quantity_in: '1.0000 CHEESE', quantity_out: '0.01 WAXUSDC' } },
    }));
    mockFetch(() => ({ actions: page }));
    await expect(fetchTacoPairVolume(prices, Date.UTC(2026, 8, 15, 12, 0, 0))).rejects.toThrow(
      /page limit/,
    );
  });
});
