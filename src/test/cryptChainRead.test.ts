import { describe, expect, it, vi } from 'vitest';
import { decidePrepRoute, decideChainReadRoute, decideMediaRoute } from '@/lib/cryptMediaProxy';
import { ChainReadBlockedError, routedChainPost } from '@/lib/cryptChainRead';
import { createWalletRpcFetch } from '@/lib/walletRpcFetch';

const H = 'http://127.0.0.1:8088';

describe('helper routes', () => {
  it('prep reads need a v1.6 helper, fail closed when down, stay public for older helpers', () => {
    expect(decidePrepRoute(H, 'prep')).toEqual({ kind: 'tor', base: H });
    expect(decidePrepRoute(H, 'full').kind).toBe('legacy');
    expect(decidePrepRoute(H, 'down').kind).toBe('blocked');
    expect(decidePrepRoute(H, null).kind).toBe('blocked');
    expect(decidePrepRoute(null, 'prep').kind).toBe('public');
  });
  it('account chain reads use a v1.4+ helper, and v1.6 still carries media', () => {
    expect(decideChainReadRoute(H, 'full').kind).toBe('tor');
    expect(decideChainReadRoute(H, 'prep').kind).toBe('tor');
    expect(decideChainReadRoute(H, 'media').kind).toBe('legacy');
    expect(decideMediaRoute(H, 'prep').kind).toBe('tor');
  });
});

describe('routedChainPost', () => {
  it('never falls back to public servers while the helper is blocked', async () => {
    const pub = vi.fn();
    await expect(routedChainPost({ kind: 'blocked', base: H }, '/v1/chain/get_currency_balance', {}, { helper: vi.fn(), pub })).rejects.toBeInstanceOf(ChainReadBlockedError);
    expect(pub).not.toHaveBeenCalled();
  });
  it('sends the read only to the helper on the Tor route', async () => {
    const pub = vi.fn(); const helper = vi.fn().mockResolvedValue(['1.0000 CHEESE']);
    await routedChainPost({ kind: 'tor', base: H }, '/v1/chain/get_currency_balance', { account: 'bob' }, { helper, pub });
    expect(helper).toHaveBeenCalledWith(H, '/v1/chain/get_currency_balance', { account: 'bob' });
    expect(pub).not.toHaveBeenCalled();
  });
});

describe('wallet prep reads on CHEESECrypt', () => {
  it('go to the v1.6 helper only', async () => {
    const native = vi.fn().mockResolvedValue(new Response('{"head_block_num":1}', { status: 200 }));
    const f = createWalletRpcFetch(native, { onCrypt: () => true, prepRoute: async () => ({ kind: 'tor', base: H }) });
    await f('https://wax.greymass.com/v1/chain/get_info', { method: 'POST' });
    expect(native).toHaveBeenCalledTimes(1);
    expect(String(native.mock.calls[0][0])).toBe(`${H}/v1/chain/get_info`);
  });
  it('fail closed while the helper is down', async () => {
    const native = vi.fn();
    const f = createWalletRpcFetch(native, { onCrypt: () => true, prepRoute: async () => ({ kind: 'blocked', base: H }) });
    await expect(f('https://wax.greymass.com/v1/chain/get_info', { method: 'POST' })).rejects.toThrow(/Tor helper/);
    expect(native).not.toHaveBeenCalled();
  });
  it('leave broadcasts untouched (one attempt, never through the prep path)', async () => {
    const native = vi.fn().mockResolvedValue(new Response('{"error":{"code":500}}', { status: 500 }));
    const prepRoute = vi.fn();
    const f = createWalletRpcFetch(native, { onCrypt: () => true, prepRoute });
    await f('https://wax.greymass.com/v1/chain/send_transaction', { method: 'POST', body: '{}' });
    expect(prepRoute).not.toHaveBeenCalled();
    expect(native).toHaveBeenCalledTimes(1);
  });
});
