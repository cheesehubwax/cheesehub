import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCachedTrustSignals, loadTrustSignals, useCryptTrust } from '@/hooks/useCryptTrust';
import { scoreTrust } from '@/lib/cryptTrust';
import { saveCustomEndpoint } from '@/lib/cryptNetworkPrivacy';
import { __resetMediaRouteCache } from '@/lib/cryptMediaProxy';

const reads = vi.hoisted(() => ({ rpc: vi.fn(), table: vi.fn(), pool: vi.fn(), currentKey: vi.fn(), firstKey: vi.fn() }));
vi.mock('@/lib/waxRpcFallback', () => ({ waxRpcCall: reads.rpc, fetchTableRows: reads.table }));
vi.mock('@/lib/endpointHealth', () => ({ resolveEndpoints: async () => ['https://nft.test'], normalizeEndpoint: (url: string) => url, benchEndpoint: vi.fn() }));
vi.mock('@/services/atomicApi', () => ({ fetchAssetById: vi.fn() }));
vi.mock('@/lib/folio/pooled', () => ({ fetchAlcorCheese: reads.pool }));
vi.mock('@/lib/cheeseCrypt', () => ({ lookupPublishedKey: reads.currentKey, lookupFirstKeyTime: reads.firstKey }));

let now = Date.UTC(2026, 10, 14);
let sequence = 0;
const account = () => `cachetest${++sequence}`;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  reads.rpc.mockImplementation(async (path: string) => path.endsWith('get_account') ? { created: '2020-01-01T00:00:00' } : ['10000.0000 CHEESE']);
  reads.table.mockResolvedValue({ rows: [] });
  reads.pool.mockResolvedValue({ cheese: 1000, pools: 1 });
  reads.currentKey.mockResolvedValue('public-key');
  reads.firstKey.mockResolvedValue(Date.UTC(2024, 0, 1));
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: { collections: [] } }) }));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); saveCustomEndpoint(null, false); __resetMediaRouteCache(); });

describe('Respect signal caching', () => {
  it('renders a cached account immediately on remount without more network reads', async () => {
    const name = account();
    const signals = await loadTrustSignals(name);
    reads.rpc.mockClear();
    const first = renderHook(() => useCryptTrust(name, true));
    expect(first.result.current).toEqual(signals);
    first.unmount();
    const second = renderHook(() => useCryptTrust(name, true));
    expect(second.result.current).toEqual(signals);
    expect(reads.rpc).not.toHaveBeenCalled();
    expect(reads.pool).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('keeps a failed signal unknown and retries only after the two-minute cooldown', async () => {
    const name = account();
    reads.pool.mockRejectedValueOnce(new Error('offline'));
    const first = await loadTrustSignals(name);
    expect(first.pooled).toBeNull();
    expect(scoreTrust(first).partial).toBe(true);
    now += 119999;
    expect(getCachedTrustSignals(name)?.pooled).toBeNull();
    await loadTrustSignals(name);
    expect(reads.pool).toHaveBeenCalledTimes(1);
    now += 1;
    expect(getCachedTrustSignals(name)).toBeNull();
    expect((await loadTrustSignals(name)).pooled).toEqual({ cheese: 1000, pools: 1 });
    expect(reads.pool).toHaveBeenCalledTimes(2);
    expect(reads.rpc).toHaveBeenCalledTimes(2);
  });

  it('shares concurrent reads for every account signal', async () => {
    const name = account();
    const [a, b] = await Promise.all([loadTrustSignals(name), loadTrustSignals(name)]);
    expect(a).toEqual(b);
    expect(reads.rpc).toHaveBeenCalledTimes(2);
    expect(reads.table).toHaveBeenCalledTimes(1);
    expect(reads.pool).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(reads.currentKey).toHaveBeenCalledTimes(1);
  });

  it('refreshes hourly signals without discarding the displayed score or rereading daily signals', async () => {
    const name = account();
    const old = await loadTrustSignals(name);
    now += 3600000;
    expect(getCachedTrustSignals(name)).toBeNull();
    const hook = renderHook(({ enabled }) => useCryptTrust(name, enabled), { initialProps: { enabled: false } });
    // Hydrate a fresh snapshot, then expire it while this badge is still mounted.
    await act(async () => { hook.rerender({ enabled: true }); });
    await waitFor(() => expect(hook.result.current).toEqual(old));
    hook.rerender({ enabled: false });
    now += 3600000;
    reads.rpc.mockImplementation(async (path: string) => path.endsWith('get_account') ? { created: '2020-01-01T00:00:00' } : ['50000.0000 CHEESE']);
    hook.rerender({ enabled: true });
    expect(hook.result.current?.cheese).toBe(10000);
    await waitFor(() => expect(hook.result.current?.cheese).toBe(50000));
    expect(reads.currentKey).toHaveBeenCalledTimes(1);
    expect(reads.rpc.mock.calls.filter(([path]) => path.endsWith('get_account'))).toHaveLength(1);
  });

  it('never exposes the previous account score when switching to an uncached disabled account', async () => {
    const a = account(), b = account();
    await loadTrustSignals(a);
    const hook = renderHook(({ name }) => useCryptTrust(name, false), { initialProps: { name: a } });
    expect(hook.result.current?.account).toBe(a);
    hook.rerender({ name: b });
    expect(hook.result.current).toBeNull();
    expect(reads.rpc).toHaveBeenCalledTimes(2);
  });
});
describe('Respect lookups through the Tor helper', () => {
  const H = 'http://localhost:8088';
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

  it('sends every non-history lookup only to a v1.4 helper', async () => {
    saveCustomEndpoint(H, true);
    const urls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      urls.push(url);
      if (url.endsWith('/v2/helper')) return reply({ features: ['history', 'broadcast', 'atomic', 'ipfs', 'chain', 'respect'] });
      if (url.endsWith('/v1/chain/get_account')) return reply({ created: '2020-01-01T00:00:00' });
      if (url.endsWith('/v1/chain/get_currency_balance')) return reply({ error: 'no balance' }, 500);
      if (url.endsWith('/v1/chain/get_table_rows')) return reply({ rows: [{ staker: JSON.parse(String(init?.body)).lower_bound, cheesestaked: '7.0000 CHEESE' }] });
      if (url.includes('/atomic/v1/accounts/')) return reply({ success: true, data: { collections: [{ assets: '3', collection: { collection_name: 'cheesenftwax' } }] } });
      if (url.includes('/alcor/v2/account/')) return reply([]);
      return reply({}, 404);
    }));
    reads.pool.mockImplementation(async (name: string, io: { positions: (a: string) => Promise<unknown> }) => { await io.positions(name); return { cheese: 0, pools: 0 }; });
    const name = account();
    const s = await loadTrustSignals(name);
    expect(s).toMatchObject({ createdAt: Date.UTC(2020, 0, 1), cheese: 0, staked: 7, nfts: 3, pooled: { cheese: 0, pools: 0 } });
    expect(reads.rpc).not.toHaveBeenCalled();
    expect(reads.table).not.toHaveBeenCalled();
    expect(urls.length).toBe(6);
    expect(urls.every(u => u.startsWith(H))).toBe(true);
    expect(urls).toContain(`${H}/alcor/v2/account/${name}/positions`);
  });

  it('keeps lookups unknown, never public, while the saved helper is down', async () => {
    saveCustomEndpoint(H, true);
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('connection refused'); }));
    const name = account();
    const s = await loadTrustSignals(name);
    expect(s).toMatchObject({ createdAt: null, cheese: null, staked: null, pooled: null, nfts: null });
    expect(reads.rpc).not.toHaveBeenCalled();
    expect(reads.table).not.toHaveBeenCalled();
    expect(reads.pool).not.toHaveBeenCalled();
    expect(vi.mocked(fetch).mock.calls.every(([u]) => String(u).startsWith(H))).toBe(true);
    expect(getCachedTrustSignals(name)).toBeNull();
  });

  it('keeps the public path for a v1.3 helper that cannot carry Respect lookups', async () => {
    saveCustomEndpoint(H, true);
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('/v2/helper')
      ? reply({ features: ['history', 'broadcast', 'atomic', 'ipfs'] })
      : reply({ success: true, data: { collections: [] } })));
    await loadTrustSignals(account());
    expect(reads.rpc).toHaveBeenCalledTimes(2);
    expect(reads.pool).toHaveBeenCalledWith(expect.any(String), undefined);
  });
});
