import { describe, it, expect, vi, afterEach } from 'vitest';
import { getSuffixHolders, normaliseSuffix, suffixAccountsFromActions } from '@/lib/airdropSuffix';
import { resolveEndpoints, benchEndpoint } from '@/lib/endpointHealth';

vi.mock('@/lib/endpointHealth', () => ({
  resolveEndpoints: vi.fn(async () => ['https://first.test', 'https://second.test']),
  benchEndpoint: vi.fn(), clearBench: vi.fn(),
  BENCH_MS: { network: 25000, error: 15000, rateLimited: 30000 },
}));

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); vi.clearAllMocks(); });

const na = (creator: string, newact: string) => ({
  act: { account: 'eosio', name: 'newaccount', data: { creator, newact } },
});

describe('suffix snapshot', () => {
  it('normalises input', () => {
    expect(normaliseSuffix(' .GM ')).toBe('gm');
    expect(normaliseSuffix('c.wam')).toBe('c.wam');
    expect(normaliseSuffix('bad!')).toBeNull();
    expect(normaliseSuffix('')).toBeNull();
  });

  it('keeps only names ending in .suffix created by the suffix owner', () => {
    const accounts = suffixAccountsFromActions(
      [na('gm', 'loop.gm'), na('gm', 'loop.gm'), na('gm', 'other'), na('x', 'fake.gm'), na('gm', 'a.gm')],
      'gm',
    );
    expect(accounts).toEqual(['a.gm', 'loop.gm']);
  });

  it('unions different provider slices for .cheese instead of accepting the first answer', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify({
      actions: url.startsWith('https://first') ? [na('cheese', 'a.cheese')] : [na('cheese', 'b.cheese')],
    }))));
    const snapshot = await getSuffixHolders('.cheese');
    expect(snapshot.holders.map((h) => h.account)).toEqual(['a.cheese', 'b.cheese']);
    expect(snapshot.truncated).toBe(false);
  });

  it('shares simultaneous requests and caches complete lists for 60 seconds without exposing mutable cache data', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ actions: [na('cache', 'a.cache')] })));
    vi.stubGlobal('fetch', fetcher);
    const [first, second] = await Promise.all([getSuffixHolders('cache'), getSuffixHolders('.CACHE')]);
    expect(fetcher).toHaveBeenCalledTimes(2);
    first.holders.length = 0;
    expect(second.holders).toHaveLength(1);
    expect((await getSuffixHolders('cache')).holders).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(60001);
    await getSuffixHolders('cache');
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it('stops a hanging provider after 2500ms, retains good names and does not cache partial results', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn((url: string, init: RequestInit) => url.startsWith('https://first')
      ? Promise.resolve(new Response(JSON.stringify({ actions: [na('slow', 'a.slow')] })))
      : new Promise<Response>((_, reject) => init.signal?.addEventListener('abort', () => reject(new Error('aborted')))));
    vi.stubGlobal('fetch', fetcher);
    const result = getSuffixHolders('slow');
    await vi.advanceTimersByTimeAsync(2500);
    const snapshot = await result;
    expect(snapshot.holders.map((h) => h.account)).toEqual(['a.slow']);
    expect(snapshot.truncated).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(benchEndpoint).toHaveBeenCalledWith('https://second.test', 25000);
    fetcher.mockImplementation(async () => new Response(JSON.stringify({ actions: [na('slow', 'b.slow')] })));
    expect((await getSuffixHolders('slow')).holders[0]?.account).toBe('b.slow');
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it('benches fatal errors without retries and flags incomplete coverage', async () => {
    const fetcher = vi.fn(async (url: string) => url.startsWith('https://first')
      ? new Response(JSON.stringify({ actions: [na('fail', 'a.fail')] }))
      : new Response('', { status: 429 }));
    vi.stubGlobal('fetch', fetcher);
    expect((await getSuffixHolders('fail')).truncated).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(benchEndpoint).toHaveBeenCalledWith('https://second.test', 30000);
  });

  it('pages beyond 10000 rows using descending timestamp cursors even when a page adds no suffix names', async () => {
    vi.mocked(resolveEndpoints).mockResolvedValueOnce(['https://first.test']);
    let pages = 0;
    const fetcher = vi.fn(async (url: string) => {
      expect(url).not.toContain('skip=');
      expect(url).toContain('sort=desc');
      const page = pages++;
      const timestamp = new Date(Date.UTC(2026, 0, 20 - page)).toISOString();
      if (page > 0) expect(new URL(url).searchParams.get('before')).toBe(new Date(Date.UTC(2026, 0, 21 - page) + 1).toISOString());
      return new Response(JSON.stringify({ actions: page < 11
        ? Array.from({ length: 1000 }, () => ({ ...na('deep', 'other'), '@timestamp': timestamp }))
        : [na('deep', 'a.deep')] }));
    });
    vi.stubGlobal('fetch', fetcher);
    const snapshot = await getSuffixHolders('deep');
    expect(snapshot.holders.map((h) => h.account)).toEqual(['a.deep']);
    expect(snapshot.truncated).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(12);
  });

  it('does not mark a stuck full-page cursor as complete', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ actions:
      Array.from({ length: 1000 }, () => ({ ...na('stuck', 'a.stuck'), '@timestamp': '2026-01-01T00:00:00Z' })),
    }))));
    expect((await getSuffixHolders('stuck')).truncated).toBe(true);
  });
});
