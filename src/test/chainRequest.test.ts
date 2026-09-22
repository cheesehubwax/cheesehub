import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  hedgedJson,
  chainPost,
  mapLimit,
  resetChainCursor,
} from '@/lib/chainRequest';
import {
  benchEndpoint,
  benchedEndpoints,
  isBenched,
  clearBench,
  resetEndpointHealthCache,
  BENCH_MS,
} from '@/lib/endpointHealth';
import { readStatCache, writeStatCache, cached, clearStatCache } from '@/lib/statCache';

const HOSTS = ['https://a.example', 'https://b.example', 'https://c.example'];

/** First recorded call to a chain host, skipping the health-service probe. */
function chainCall(impl: { mock: { calls: unknown[][] } }): unknown[] {
  return impl.mock.calls.find((call) => HOSTS.some((h) => String(call[0]).startsWith(h)))!;
}

/** A fetch stub driven by per-host behaviour. */
function stubFetch(
  behaviour: Record<string, { status?: number; delayMs?: number; throws?: boolean; body?: unknown }>,
) {
  const calls: string[] = [];
  const impl = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    // The health service is unreachable in tests: callers fall back to the
    // static/fallback order, which is what we want to exercise.
    if (url.includes('herdcheck')) throw new Error('offline');
    const host = HOSTS.find((h) => url.startsWith(h));
    calls.push(url);
    const rule = (host && behaviour[host]) || {};
    if (rule.delayMs) await new Promise((r) => setTimeout(r, rule.delayMs));
    if (rule.throws) throw new TypeError('Failed to fetch');
    const status = rule.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => rule.body ?? { host },
    } as unknown as Response;
  });
  vi.stubGlobal('fetch', impl);
  return { calls, impl };
}

describe('hedgedJson', () => {
  beforeEach(() => {
    resetEndpointHealthCache();
    resetChainCursor();
    for (const h of HOSTS) clearBench(h);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the first host that answers', async () => {
    stubFetch({});
    const { data, host } = await hedgedJson<{ host: string }>('/v1/chain/get_info', {
      fallback: HOSTS,
    });
    expect(host).toBe(HOSTS[0]);
    expect(data.host).toBe(HOSTS[0]);
  });

  it('falls through to a working host and benches the one that failed', async () => {
    stubFetch({ [HOSTS[0]]: { throws: true } });
    const { host } = await hedgedJson<{ host: string }>('/v1/chain/get_info', {
      fallback: HOSTS,
      hedgeMs: 10_000,
    });
    expect(host).toBe(HOSTS[1]);
    expect(isBenched(HOSTS[0])).toBe(true);
    expect(isBenched(HOSTS[1])).toBe(false);
  });

  it('hedges onto a second host when the first goes quiet', async () => {
    stubFetch({ [HOSTS[0]]: { delayMs: 500 } });
    const started = Date.now();
    const { host } = await hedgedJson<{ host: string }>('/v1/chain/get_info', {
      fallback: HOSTS,
      hedgeMs: 20,
    });
    // The silent host is never waited out — the hedge wins.
    expect(host).toBe(HOSTS[1]);
    expect(Date.now() - started).toBeLessThan(400);
  });

  it('sends chain reads as text/plain so no CORS preflight is triggered', async () => {
    const { impl } = stubFetch({});
    await chainPost('/v1/chain/get_table_rows', { table: 'stat' }, { fallback: HOSTS });
    const init = chainCall(impl)[1] as RequestInit;
    expect((init.headers as Record<string, string>)['Content-Type']).toBe(
      'text/plain;charset=UTF-8',
    );
    expect(init.body).toBe(JSON.stringify({ table: 'stat' }));
  });

  it('sends no body or content type on a GET', async () => {
    const { impl } = stubFetch({});
    await hedgedJson('/v2/state/get_tokens?account=bob', { fallback: HOSTS, method: 'GET' });
    const init = chainCall(impl)[1] as RequestInit;
    expect(init.body).toBeUndefined();
    expect(init.headers).toBeUndefined();
  });

  it('treats a mapped status as a valid answer without benching the host', async () => {
    stubFetch({ [HOSTS[0]]: { status: 400 } });
    const { data, host } = await hedgedJson<string[]>('/v1/chain/get_currency_balance', {
      fallback: HOSTS,
      onStatus: (status) => (status === 400 ? { value: [] } : undefined),
    });
    expect(data).toEqual([]);
    expect(host).toBe(HOSTS[0]);
    expect(isBenched(HOSTS[0])).toBe(false);
  });

  it('benches a rate-limited host for longer than an ordinary error', async () => {
    stubFetch({ [HOSTS[0]]: { status: 429 }, [HOSTS[1]]: { status: 500 } });
    await hedgedJson('/v1/chain/get_info', { fallback: HOSTS, hedgeMs: 10_000 });
    const entries = benchedEndpoints();
    const rateLimited = entries.find((e) => e.url === HOSTS[0])!;
    const errored = entries.find((e) => e.url === HOSTS[1])!;
    expect(rateLimited.until).toBeGreaterThan(errored.until);
    expect(BENCH_MS.rateLimited).toBeGreaterThan(BENCH_MS.error);
  });

  it('rejects only after every host has failed', async () => {
    stubFetch(Object.fromEntries(HOSTS.map((h) => [h, { throws: true }])));
    await expect(
      hedgedJson('/v1/chain/get_info', { fallback: HOSTS, hedgeMs: 5 }),
    ).rejects.toThrow();
    for (const host of HOSTS) expect(isBenched(host)).toBe(true);
  });
});

describe('mapLimit', () => {
  it('never runs more than the limit at once and keeps input order', async () => {
    let inFlight = 0;
    let peak = 0;
    const out = await mapLimit([1, 2, 3, 4, 5, 6, 7, 8], 3, async (n) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight -= 1;
      return n * 2;
    });
    expect(peak).toBeLessThanOrEqual(3);
    expect(out).toEqual([2, 4, 6, 8, 10, 12, 14, 16]);
  });
});

describe('statCache', () => {
  beforeEach(() => clearStatCache('t'));

  it('round-trips a value', () => {
    writeStatCache('t', { price: 1.5 });
    expect(readStatCache<{ price: number }>('t')).toEqual({ price: 1.5 });
  });

  it('ignores a value older than the max age', () => {
    writeStatCache('t', { price: 1.5 });
    expect(readStatCache('t', -1)).toBeUndefined();
  });

  it('returns undefined when nothing is stored', () => {
    expect(readStatCache('missing-key')).toBeUndefined();
  });

  it('caches the result of a wrapped query', async () => {
    const fn = cached('t', async () => ({ price: 2 }));
    await fn();
    expect(readStatCache<{ price: number }>('t')).toEqual({ price: 2 });
  });
});
