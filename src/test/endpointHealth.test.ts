import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DEAD_ENDPOINTS,
  STATIC_ENDPOINTS,
  mergeEndpoints,
  resolveEndpoints,
  cachedEndpoints,
  resetEndpointHealthCache,
  type HealthEntry,
} from '@/lib/endpointHealth';

const entry = (url: string, status: HealthEntry['status'] = 'healthy', uptime = 100): HealthEntry => ({
  url,
  status,
  uptimePercent: uptime,
  producer: 'test',
});

const healthResponse = (urls: { url: string; status?: string; uptimePercent?: number }[]) => ({
  ok: true,
  status: 200,
  json: async () => ({
    endpoints: urls.map((u) => ({
      url: u.url,
      status: u.status ?? 'healthy',
      uptimePercent: u.uptimePercent ?? 100,
      producer: { owner: 'bp', name: 'bp' },
    })),
  }),
});

describe('mergeEndpoints', () => {
  it('puts healthy hosts first and keeps unlisted fallbacks last', () => {
    const merged = mergeEndpoints(
      [entry('https://healthy-a.io'), entry('https://healthy-b.io', 'degraded', 80)],
      ['https://mine.io', 'https://healthy-a.io'],
    );
    expect(merged).toEqual(['https://healthy-a.io', 'https://healthy-b.io', 'https://mine.io']);
  });

  it('never queues a known-dead host, from either list', () => {
    const dead = DEAD_ENDPOINTS[0];
    const merged = mergeEndpoints([entry(dead)], [dead, 'https://alive.io']);
    expect(merged).toEqual(['https://alive.io']);
  });

  it('drops hosts reported as down and normalises trailing slashes', () => {
    const merged = mergeEndpoints(
      [entry('https://down.io', 'down', 0), entry('https://up.io/')],
      [],
    );
    expect(merged).toEqual(['https://up.io']);
  });

  it('respects the limit', () => {
    const merged = mergeEndpoints([], ['https://a.io', 'https://b.io', 'https://c.io'], 2);
    expect(merged).toHaveLength(2);
  });
});

describe('resolveEndpoints', () => {
  beforeEach(() => {
    resetEndpointHealthCache();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    resetEndpointHealthCache();
  });

  it('orders reads by live health', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => healthResponse([{ url: 'https://fast.io' }, { url: 'https://ok.io' }])),
    );
    const order = await resolveEndpoints('chain-api', ['https://mine.io']);
    expect(order[0]).toBe('https://fast.io');
    expect(order).toContain('https://mine.io');
  });

  it('falls back to the static list when the health read fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const order = await resolveEndpoints('hyperion-v2');
    expect(order).toEqual(STATIC_ENDPOINTS['hyperion-v2'].slice(0, order.length));
  });

  it('falls back when the health API answers with an error status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })));
    const order = await resolveEndpoints('chain-api', ['https://mine.io']);
    expect(order).toEqual(['https://mine.io']);
  });

  it('reads health once and reuses the cache, even for concurrent callers', async () => {
    const fetchMock = vi.fn(async () => healthResponse([{ url: 'https://fast.io' }]));
    vi.stubGlobal('fetch', fetchMock);

    await Promise.all([
      resolveEndpoints('chain-api', []),
      resolveEndpoints('chain-api', []),
    ]);
    await resolveEndpoints('chain-api', []);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('cachedEndpoints returns the static order before any health read lands', () => {
    vi.stubGlobal('fetch', vi.fn(async () => healthResponse([{ url: 'https://fast.io' }])));
    const order = cachedEndpoints('chain-api', ['https://mine.io']);
    expect(order).toEqual(['https://mine.io']);
  });
});
