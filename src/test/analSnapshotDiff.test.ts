import { describe, expect, it } from 'vitest';
import { diffPoolSnapshots, waxUsdFromPools } from '@/components/anal/snapshotDiff';
import type { LpDayFile, LpPoolSnapshot } from '@/lib/lpPools';

function pool(providers: LpPoolSnapshot['providers']): LpPoolSnapshot {
  return {
    key: 'alcor:wax-eosio.token', venue: 'alcor', pairKey: 'wax-eosio.token', symbol: 'WAX',
    contract: 'eosio.token', label: 'CHEESE / WAX', poolIds: [1], usd: 10, cheese: 5,
    paired: 8, accounts: providers.length, positions: providers.reduce((sum, row) => sum + row.pos, 0), providers,
  };
}

function day(date: string, providers: LpPoolSnapshot['providers'], partial?: LpDayFile['partial']): LpDayFile {
  return { date, t: 0, pools: [pool(providers)], partial };
}

describe('CHEESEAnal snapshot tooltip helpers', () => {
  it('derives snapshot WAX/USD from the CHEESE/WAX pair', () => {
    expect(waxUsdFromPools([{ pairKey: 'wax-eosio.token', priceUsd: 0.01, priceInPaired: 2 }])).toBe(0.005);
  });

  it('attributes joins, departures and position changes within one pool', () => {
    const previous = day('old', [
      { a: 'alice', usd: 1, cheese: 1, paired: 1, pos: 1, inRange: 1 },
      { a: 'carol', usd: 1, cheese: 1, paired: 1, pos: 2, inRange: 1 },
    ]);
    const current = day('new', [
      { a: 'alice', usd: 2, cheese: 2, paired: 2, pos: 3, inRange: 2 },
      { a: 'bob', usd: 1, cheese: 1, paired: 1, pos: 1, inRange: 1 },
    ]);
    expect(diffPoolSnapshots(current, previous, 'alcor:wax-eosio.token')).toEqual({
      joined: ['bob'],
      left: ['carol'],
      positionChanges: [
        { account: 'alice', delta: 2 },
        { account: 'carol', delta: -2 },
        { account: 'bob', delta: 1 },
      ],
    });
  });

  it('does not invent account changes from a partial venue snapshot', () => {
    const previous = day('old', [{ a: 'alice', usd: 1, cheese: 1, paired: 1, pos: 1, inRange: 1 }]);
    expect(diffPoolSnapshots(day('new', [], ['alcor']), previous, 'alcor:wax-eosio.token')).toBeNull();
  });
});