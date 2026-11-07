import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchWithFallback } from '@/lib/fetchWithFallback';
import { isBenched, resetEndpointHealthCache } from '@/lib/endpointHealth';

const hosts = ['https://a.example', 'https://b.example'];
beforeEach(() => resetEndpointHealthCache());
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); resetEndpointHealthCache(); });

describe('bounded fallback reads', () => {
  it('switches after a network failure, benches the failed host, and preserves readable JSON', async () => {
    const requests = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).includes('herdcheck') || String(url).startsWith(hosts[0])) throw new TypeError('Failed to fetch');
      return new Response('{"rows":[{"owner":"alice"}]}');
    });
    vi.stubGlobal('fetch', requests);
    const response = await fetchWithFallback(hosts, '/v1/chain/get_table_rows', { method: 'POST', body: '{"table":"voters"}', headers: { 'Content-Type': 'application/json' } }, 3500);
    expect(await response.json()).toEqual({ rows: [{ owner: 'alice' }] });
    expect(isBenched(hosts[0])).toBe(true);
    const request = requests.mock.calls.find(([url]) => String(url).startsWith(hosts[1]));
    expect(request).toBeDefined();
    const options = (request as unknown as [string, RequestInit])[1];
    expect(new Headers(options.headers).get('Content-Type')).toBe('text/plain;charset=UTF-8');
    expect(options.body).toBe('{"table":"voters"}');
  });

  it('times out a stalled body, not just stalled headers', async () => {
    vi.useFakeTimers();
    let chainCalls = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: RequestInfo | URL, options?: RequestInit) => {
      if (String(url).includes('herdcheck')) throw new Error('offline');
      chainCalls += 1;
      if (chainCalls === 1) return { ok: true, text: () => new Promise<string>((_, reject) => options?.signal?.addEventListener('abort', () => reject(new Error('timeout')))) };
      return new Response('{"rows":[]}');
    }));
    const pending = fetchWithFallback(hosts, '/v1/chain/get_table_rows', undefined, 3500);
    await vi.advanceTimersByTimeAsync(3499);
    expect(chainCalls).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(await (await pending).json()).toEqual({ rows: [] });
    expect(chainCalls).toBe(2);
  });

  it('does not retry when the caller aborts an in-flight read', async () => {
    const controller = new AbortController();
    let chainCalls = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: RequestInfo | URL, options?: RequestInit) => {
      if (String(url).includes('herdcheck')) throw new Error('offline');
      chainCalls += 1;
      return new Promise<Response>((_, reject) => options?.signal?.addEventListener('abort', () => reject(new Error('cancelled'))));
    }));
    const pending = fetchWithFallback(hosts, '/v1/chain/get_info', { signal: controller.signal });
    const assertion = expect(pending).rejects.toThrow('cancelled');
    await vi.waitFor(() => expect(chainCalls).toBe(1));
    controller.abort();
    await assertion;
    expect(chainCalls).toBe(1);
  });
});