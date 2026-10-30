import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@wharfkit/session';
import { useAirdropRunner } from '@/hooks/useAirdropRunner';
import { CHEESE_CONTRACT, CHEESE_CPU_CONTRACT, CHEESE_RAM_CONTRACT } from '@/lib/airdropCheese';
import type { ResourcePricing } from '@/lib/airdropResources';

const mocks = vi.hoisted(() => ({ execute: vi.fn(), showSuccess: vi.fn(), invalidate: vi.fn(), gauges: vi.fn() }));
vi.mock('@/hooks/useWaxTransaction', () => ({ useWaxTransaction: () => ({ executeTransaction: mocks.execute }) }));
vi.mock('@/context/TransactionSuccessContext', () => ({ useTransactionSuccess: () => ({ showSuccess: mocks.showSuccess }) }));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: mocks.invalidate }) }));
vi.mock('@/components/shared/ResourceGauges', () => ({ refreshResourceGauges: mocks.gauges }));

export const pricing: ResourcePricing = {
  waxPerCheese: 0.01, priceSource: 'pool', powerup: null,
  ram: { enabled: true, minCheese: 1, maxCheese: 100, waxPerByte: 0.001, feeBps: 0, historicalBytesPerCheese: null, liquidWax: 100, minLiquidReserve: 0, reserveBufferBps: 0 },
};
const input = () => ({
  session: { permissionLevel: { actor: 'alice', permission: 'active' } } as unknown as Session,
  actor: 'alice', cheeseBalance: 1000, isRam: false, isNft: false, hasError: false,
  nftAssignments: [], nftShortfall: 0,
  recipients: [{ account: 'bob', weight: 1, units: 101n }, { account: 'carol', weight: 1, units: 202n }],
  ramPurchases: [], ramCheeseTotal: 0, pricing, suggestedCpuCheese: null,
  requiredRamCheese: 10, cpuPercent: 80, batchSize: 1, memo: 'hello',
  sendContract: 'cheeseburger', sendSymbol: 'cheese', precision: 4,
  tokenStat: { precision: 4, supply: '1000.0000 CHEESE' },
  refetchResources: vi.fn().mockResolvedValue(undefined), refreshBalance: vi.fn().mockResolvedValue(undefined),
});
type Input = ReturnType<typeof input>;
async function run(overrides: Partial<Parameters<typeof useAirdropRunner>[0]> = {}) {
  const params = { ...input(), ...overrides };
  const hook = renderHook(() => useAirdropRunner(params));
  act(() => hook.result.current.setTermsAccepted(true));
  await act(async () => {
    const promise = hook.result.current.runAirdrop();
    await vi.runAllTimersAsync();
    await promise;
  });
  return { ...hook, params };
}

describe('CHEESEAir sending runner', () => {
  it('rejects CHEESE delivery plus resources before spending when separately affordable', async () => {
    const { result } = await run({ cheeseBalance: 10.02 });
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(result.current.runError).toContain('10.0303 CHEESE');
  });
  it('permits exactly the combined delivery and resource budget', async () => {
    await run({ cheeseBalance: 10.0303 });
    expect(mocks.execute).toHaveBeenCalledTimes(3);
  });
  it('includes raised minimum top-ups before buying CPU', async () => {
    const { result } = await run({ cheeseBalance: 1.5, suggestedCpuCheese: 1, requiredRamCheese: 0.1 });
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(result.current.runError).toContain('2.0303 CHEESE');
  });
  it('rejects an incomplete RAM top-up before any CPU purchase', async () => {
    const { result } = await run({ requiredRamCheese: 5001, suggestedCpuCheese: 1, cheeseBalance: 10000 });
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(result.current.runError).toContain('50 purchases');
  });
  it('fails closed when the CHEESE balance is unknown', async () => {
    const { result } = await run({ cheeseBalance: null });
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(result.current.runError).toContain('balance');
  });
  beforeEach(() => {
    vi.useFakeTimers(); vi.clearAllMocks();
    mocks.execute.mockResolvedValue({ success: true, txId: 'confirmed-id' });
    mocks.invalidate.mockResolvedValue(undefined);
  });
  afterEach(() => vi.useRealTimers());
  it('enforces terms before any resource purchase or delivery', async () => {
    const { result } = renderHook(() => useAirdropRunner(input()));
    await act(async () => { await result.current.runAirdrop(); });
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(result.current.canRun).toBe(false);
  });
  it('prevents error-blocked and unsigned runs from sending', async () => {
    await run({ hasError: true });
    await run({ session: null });
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it('buys mandatory sender RAM first, then sends exact token quantities sequentially', async () => {
    const { result, params } = await run({ suggestedCpuCheese: 2 });
    const actions = mocks.execute.mock.calls.map(c => c[0][0]);
    expect(actions.map(a => a.data.to)).toEqual([CHEESE_CPU_CONTRACT, CHEESE_RAM_CONTRACT, 'bob', 'carol']);
    expect(actions[0].data).toEqual({ from: 'alice', to: CHEESE_CPU_CONTRACT, quantity: '2.0000 CHEESE', memo: 'cpu:80,net:20:alice' });
    expect(actions[1].data.memo).toBe('');
    expect(actions[1].data.quantity).toBe('10.0000 CHEESE');
    expect(actions[2]).toEqual({ account: 'cheeseburger', name: 'transfer', authorization: [params.session.permissionLevel], data: { from: 'alice', to: 'bob', quantity: '0.0101 CHEESE', memo: 'hello' } });
    expect(actions[3].data.quantity).toBe('0.0202 CHEESE');
    expect(result.current.runState).toBe('done');
    expect(result.current.batchLog.map(b => b.items)).toEqual([[{ account: 'bob', units: 101n }], [{ account: 'carol', units: 202n }]]);
    expect(mocks.invalidate).toHaveBeenCalledWith({ queryKey: ['air-wallet-tokens'] });
  });
  it('stops immediately after a resource purchase fails', async () => {
    mocks.execute.mockResolvedValue({ success: false, txId: null, error: new Error('declined') });
    const { result } = await run();
    expect(mocks.execute).toHaveBeenCalledTimes(1);
    expect(result.current.purchaseLog[0].error).toBe('declined');
    expect(result.current.batchLog).toEqual([]);
    expect(mocks.showSuccess).not.toHaveBeenCalled();
  });
  it('never treats a missing transaction ID as a confirmed resource purchase', async () => {
    mocks.execute.mockResolvedValue({ success: true, txId: null });
    const { result } = await run();
    expect(mocks.execute).toHaveBeenCalledTimes(1);
    expect(result.current.purchaseLog[0].txId).toBeUndefined();
    expect(result.current.batchLog).toEqual([]);
  });
  it('continues later delivery batches after a failure and counts only confirmed batches', async () => {
    mocks.execute.mockResolvedValueOnce({ success: true, txId: 'ram-id' }).mockResolvedValueOnce({ success: false, txId: null, error: new Error('CPU') }).mockResolvedValueOnce({ success: true, txId: 'last-id' });
    const { result } = await run();
    expect(mocks.execute).toHaveBeenCalledTimes(3);
    expect(result.current.batchLog.map(b => b.txId ?? b.error)).toEqual(['CPU', 'last-id']);
    expect(mocks.showSuccess.mock.calls[0][1]).toContain('1 transfer sent');
    expect(mocks.showSuccess.mock.calls[0][2]).toBe('last-id');
  });
  it('records an unconfirmed delivery as failed rather than showing success', async () => {
    mocks.execute.mockResolvedValueOnce({ success: true, txId: 'ram-id' }).mockResolvedValue({ success: true, txId: null });
    const { result } = await run();
    expect(result.current.batchLog.every(b => b.error && !b.txId)).toBe(true);
    expect(mocks.showSuccess).not.toHaveBeenCalled();
  });
  it('sends RAM directly to recipient memos without buying sender RAM', async () => {
    const { result } = await run({ isRam: true, ramCheeseTotal: 3, ramPurchases: [{ account: 'alice', units: 10000n }, { account: 'bob', units: 20000n }] });
    const actions = mocks.execute.mock.calls.map(c => c[0][0]);
    expect(actions.map(a => [a.account, a.data.to, a.data.quantity, a.data.memo])).toEqual([[CHEESE_CONTRACT, CHEESE_RAM_CONTRACT, '1.0000 CHEESE', ''], [CHEESE_CONTRACT, CHEESE_RAM_CONTRACT, '2.0000 CHEESE', 'bob']]);
    expect(result.current.purchaseLog).toEqual([]);
  });
  it('preserves NFT IDs and memo and refreshes the inventory after sending', async () => {
    await run({ isNft: true, nftAssignments: [{ account: 'bob', assetIds: ['100', '101'] }] });
    expect(mocks.execute.mock.calls[1][0][0]).toMatchObject({ account: 'atomicassets', name: 'transfer', data: { from: 'alice', to: 'bob', asset_ids: ['100', '101'], memo: 'hello' } });
    expect(mocks.invalidate).toHaveBeenCalledWith({ queryKey: ['air-inventory-assets'] });
  });
  it('cancels after the current batch without sending the next batch', async () => {
    const hook = renderHook(() => useAirdropRunner(input()));
    act(() => hook.result.current.setTermsAccepted(true));
    mocks.execute.mockImplementation(async (_actions, options) => {
      if (!options.showErrorToast) hook.result.current.requestCancel();
      return { success: true, txId: 'id' };
    });
    await act(async () => { const p = hook.result.current.runAirdrop(); await vi.runAllTimersAsync(); await p; });
    expect(mocks.execute).toHaveBeenCalledTimes(2);
    expect(hook.result.current.batchLog[1]).toEqual({ batch: 2, recipients: 0, error: 'Cancelled by user' });
  });
  it('blocks duplicate invocation while the first wallet request is pending', async () => {
    const hook = renderHook(() => useAirdropRunner(input()));
    act(() => hook.result.current.setTermsAccepted(true));
    await act(async () => {
      const first = hook.result.current.runAirdrop();
      const second = hook.result.current.runAirdrop();
      await vi.runAllTimersAsync(); await Promise.all([first, second]);
    });
    expect(mocks.execute).toHaveBeenCalledTimes(3);
  });
});