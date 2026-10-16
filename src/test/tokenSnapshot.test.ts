import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseTokenMetadata, parseTokenSnapshot, type TokenSnapshot } from '@/lib/tokenSnapshotSchema';
import { snapshotSwapTokens, fetchSwapTokenList } from '@/lib/swapApi';
import { readTokenSnapshot, fetchTokenSnapshot } from '@/lib/tokenSnapshot';
import { clearStatCache } from '@/lib/statCache';
import { precisionFromStats } from '../../scripts/token-price-history/registry';

const snapshot: TokenSnapshot = {
  version: 1, updatedAt: '2026-10-16T00:17:00Z', verification: 'eosio.get_currency_stats',
  tokens: parseTokenMetadata([
    { contract: 'eosio.token', symbol: 'WAX', decimals: 8 },
    { contract: 'cheeseburger', symbol: 'CHEESE', decimals: 4 },
    { contract: 'eth.token', symbol: 'WAXWBTC', decimals: 8 },
  ]),
};

describe('public token metadata snapshot', () => {
  beforeEach(() => { vi.restoreAllMocks(); clearStatCache('token-metadata-v1'); });

  it('filters scam, malformed precision and duplicate identities, keeping contracts distinct', () => {
    const tokens = parseTokenMetadata([
      { contract: 'cheeseburger', symbol: 'CHEESE', decimals: 4 },
      { contract: 'cheeseburger', symbol: 'CHEESE', decimals: 8 },
      { contract: 'other.token', symbol: 'CHEESE', decimals: 0 },
      { contract: 'scam.token', symbol: 'BAD', decimals: 4, is_scam: true },
      { contract: 'eth.token', symbol: 'WAXWBTC', decimals: -1 },
    ]);
    expect(tokens.map(t => [t.contract, t.precision])).toEqual([['cheeseburger', 4], ['other.token', 0]]);
  });

  it('uses on-chain symbol precision, not a mismatched Alcor precision', () => {
    expect(precisionFromStats({ WAXWBTC: { supply: '1.00000000 WAXWBTC' } }, 'WAXWBTC')).toBe(8);
    expect(precisionFromStats({ WAXWBTC: { supply: '1.0000 OTHER' } }, 'WAXWBTC')).toBeNull();
  });

  it('rejects unverified snapshots', () => {
    expect(parseTokenSnapshot({ ...snapshot, verification: 'alcor' })).toBeNull();
  });

  it('keeps offline metadata separate from current prices', () => {
    const tokens = snapshotSwapTokens(snapshot);
    expect(tokens.find(t => t.ticker === 'WAXWBTC')?.precision).toBe(8);
    expect(tokens.find(t => t.ticker === 'CHEESE')?.system_price).toBeUndefined();
    expect(tokens.every(t => t.usd_price === undefined)).toBe(true);
  });

  it('loads and caches the snapshot when live Alcor returns 503, and works offline thereafter', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      return String(input).includes('tokens.json')
        ? new Response(JSON.stringify(snapshot), { status: 200 }) : new Response('', { status: 503 });
    });
    const tokens = await fetchSwapTokenList();
    expect(tokens.map(t => t.ticker)).toEqual(['WAX', 'CHEESE', 'WAXWBTC']);
    expect(readTokenSnapshot()?.tokens.length).toBe(3);
    fetchMock.mockRejectedValue(new TypeError('Offline'));
    expect((await fetchSwapTokenList()).length).toBe(3);
    expect((await fetchTokenSnapshot())?.tokens[2].precision).toBe(8);
  });
});