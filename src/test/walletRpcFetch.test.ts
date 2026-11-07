import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChainDefinition, Session, SessionKit } from '@wharfkit/session';
import { createWalletRpcFetch } from '@/lib/walletRpcFetch';
import { isBenched, resetEndpointHealthCache } from '@/lib/endpointHealth';

const first = 'https://wax.greymass.com';
const second = 'https://api.waxsweden.org';
const chainId = '1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4';
const oldUrl = 'https://wax.eosusa.io';

beforeEach(() => {
  resetEndpointHealthCache();
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('health offline'); }));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); resetEndpointHealthCache(); });

describe('wallet RPC resilience', () => {
  it('moves a restored dead-node read to the health-ordered nodes and benches network failures', async () => {
    const native = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).startsWith(first)) throw new TypeError('Failed to fetch');
      return new Response('{"ok":true}');
    });
    const transport = createWalletRpcFetch(native);
    const session = new Session({ chain: ChainDefinition.from({ id: chainId, url: oldUrl }), actor: 'alice', permission: 'active', walletPlugin: { id: 'anchor' } as any }, { fetch: transport });
    const response = await session.fetch(`${session.chain.url}/v1/chain/get_raw_abi`, { method: 'POST', body: '{"account_name":"eosio"}' });
    expect(await response.json()).toEqual({ ok: true });
    expect(native.mock.calls.map(([url]) => String(url))).toEqual([`${first}/v1/chain/get_raw_abi`, `${second}/v1/chain/get_raw_abi`]);
    expect(isBenched(first)).toBe(true);
  });

  it('passes the same transport into SessionKit login and restoration options', () => {
    const transport = createWalletRpcFetch(vi.fn());
    const kit = new SessionKit({ appName: 'test', chains: [{ id: chainId, url: oldUrl }], walletPlugins: [], ui: {} as any }, { fetch: transport });
    expect(kit.getSessionOptions().fetch).toBe(transport);
  });

  it('retries 522 read failures but not deterministic chain errors', async () => {
    const native = vi.fn().mockResolvedValueOnce(new Response('down', { status: 522 })).mockResolvedValueOnce(new Response('{"rows":[]}'));
    expect(await (await createWalletRpcFetch(native)(`${oldUrl}/v1/chain/get_table_rows`)).json()).toEqual({ rows: [] });
    expect(native).toHaveBeenCalledTimes(2);
    native.mockClear().mockResolvedValue(new Response('{"error":"bad account"}', { status: 400 }));
    expect((await createWalletRpcFetch(native)(`${oldUrl}/v1/chain/get_account`)).status).toBe(400);
    expect(native).toHaveBeenCalledTimes(1);
  });

  it.each(['send_transaction', 'push_transaction', 'push_transactions', 'send_transaction2'])('never retries %s on a lost reply', async (method) => {
    const native = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    await expect(createWalletRpcFetch(native)(`${oldUrl}/v1/chain/${method}`, { method: 'POST', body: 'signed bytes' })).rejects.toThrow('Failed to fetch');
    expect(native).toHaveBeenCalledTimes(1);
  });

  it('preserves signed broadcast bytes and returns HTTP failures without claiming success', async () => {
    const native = vi.fn().mockResolvedValue(new Response('{"error":"unavailable"}', { status: 503 }));
    const body = '{"signatures":["sig"],"packed_trx":"deadbeef"}';
    const response = await createWalletRpcFetch(native)(`${oldUrl}/v1/chain/send_transaction`, { method: 'POST', body });
    expect(response.status).toBe(503);
    expect(native).toHaveBeenCalledTimes(1);
    expect(native.mock.calls[0][1].body).toBe(body);
    expect(native.mock.calls[0][1].headers.get('Content-Type')).toBe('text/plain;charset=UTF-8');
  });

  it('leaves Fuel and wallet callback requests untouched', async () => {
    const native = vi.fn().mockResolvedValue(new Response('{}'));
    const options = { method: 'POST', body: 'fuel payload' };
    await createWalletRpcFetch(native)(`${first}/v1/resource_provider/request_transaction`, options);
    expect(native).toHaveBeenCalledExactlyOnceWith(`${first}/v1/resource_provider/request_transaction`, options);
  });

  it('bounds stalled response bodies to 3500ms before switching nodes', async () => {
    vi.useFakeTimers();
    const native = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      if (native.mock.calls.length === 1) return { ok: true, status: 200, text: () => new Promise<string>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('timeout')))) } as Response;
      return new Response('{"ok":true}');
    });
    const pending = createWalletRpcFetch(native)(`${oldUrl}/v1/chain/get_info`);
    await vi.advanceTimersByTimeAsync(3499);
    expect(native).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(await (await pending).json()).toEqual({ ok: true });
    expect(native).toHaveBeenCalledTimes(2);
  });

  it('honours caller cancellation without retrying', async () => {
    const controller = new AbortController();
    controller.abort();
    const native = vi.fn();
    await expect(createWalletRpcFetch(native)(`${oldUrl}/v1/chain/get_info`, { signal: controller.signal })).rejects.toBeDefined();
    expect(native).not.toHaveBeenCalled();
  });

  it('does not retry a nodeos contract error returned with HTTP 500', async () => {
    const native = vi.fn().mockResolvedValue(new Response('{"error":{"details":[{"message":"invalid account"}]}}', { status: 500 }));
    expect((await createWalletRpcFetch(native)(`${oldUrl}/v1/chain/get_account`)).status).toBe(500);
    expect(native).toHaveBeenCalledTimes(1);
  });

  it('fails over malformed successful read responses', async () => {
    const native = vi.fn().mockResolvedValueOnce(new Response('<html>gateway</html>')).mockResolvedValueOnce(new Response('{"ok":true}'));
    expect(await (await createWalletRpcFetch(native)(`${oldUrl}/v1/chain/get_info`)).json()).toEqual({ ok: true });
    expect(native).toHaveBeenCalledTimes(2);
  });
});