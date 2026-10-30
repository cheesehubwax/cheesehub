import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAirAllocation } from '@/hooks/useAirAllocation';
import { useAirCosts } from '@/hooks/useAirCosts';
import type { ResourcePricing } from '@/lib/airdropResources';

const pricing: ResourcePricing = {
  waxPerCheese: 1, priceSource: 'pool', powerup: null,
  ram: { enabled: true, minCheese: 1, maxCheese: 10, waxPerByte: 0.001, feeBps: 0, historicalBytesPerCheese: null, liquidWax: 100, minLiquidReserve: 10, reserveBufferBps: 0 },
};
const holders = [{ account: 'alice', weight: 2, raw: '2' }, { account: 'bob', weight: 1, raw: '1' }, { account: 'carol', weight: 1, raw: '1' }];
function input() {
  return {
    actor: 'sender', tokenStat: { precision: 4, supply: '100.0000 CHEESE' },
    walletTokens: [{ contract: 'cheeseburger', symbol: 'CHEESE', amount: 100, precision: 4 }],
    sendContract: 'cheeseburger', sendSymbol: 'cheese', precision: 4, pricing,
    ramUnit: 'cheese' as const, amountText: '20', isRam: false, isNft: false,
    filteredHolders: holders, selected: new Set(['alice', 'carol']),
    snapshot: { holders, source: 'lightapi' as const, truncated: false, hasBalances: true }, mode: 'equal' as const,
    nftPool: [], setAmountText: vi.fn(),
  };
}
describe('CHEESEAir extracted allocation and costs', () => {
  it('uses only selected holders still present in the filtered snapshot', () => {
    const params = { ...input(), filteredHolders: holders.slice(0, 2) };
    const { result } = renderHook(() => useAirAllocation(params));
    expect(result.current.recipients.map(r => [r.account, r.units])).toEqual([['alice', 200000n]]);
    expect(result.current.senderBalanceUnits).toBe(1000000n);
  });
  it('returns no token deliveries for invalid amount input', () => {
    const { result } = renderHook(() => useAirAllocation({ ...input(), amountText: '1.00001' }));
    expect(result.current.recipients).toEqual([]);
    expect(result.current.total).toBe(0n);
    expect(result.current.allocationError).toContain('Too many decimals');
  });
  it('splits RAM shares without changing selected totals or recipient counts', () => {
    const { result } = renderHook(() => useAirAllocation({ ...input(), isRam: true, amountText: '50' }));
    expect(result.current.recipients.length).toBe(2);
    expect(result.current.ramPurchases.length).toBe(6);
    expect(result.current.ramCheeseTotal).toBe(50);
    expect(result.current.ramExcluded).toEqual({ belowMin: 0, split: 2 });
    expect(result.current.ramPoolWax).toEqual({ needed: 50, spendable: 90, overBy: 0 });
  });
  it('applies the minimum suggestion through the original amount setter', () => {
    const params = { ...input(), isRam: true };
    const { result } = renderHook(() => useAirAllocation(params));
    expect(result.current.ramMinViable?.text).toBe('2.0001');
    act(() => result.current.applyRamMinViable());
    expect(params.setAmountText).toHaveBeenCalledWith('2.0001');
  });
  function cost(params = input(), checked = 0, newRows = 2) {
    return renderHook(() => {
      const allocation = useAirAllocation(params);
      return useAirCosts({ ...allocation, isRam: params.isRam, isNft: params.isNft, batchSize: 1, ramPrice: undefined, rowStats: { existing: 2 - newRows, checked, newRows, complete: checked === 2 }, pricing: params.pricing, cheeseBalance: 100, mode: params.mode, precision: params.precision, sendSymbol: params.sendSymbol, resources: undefined, cpuPercent: 80 });
    });
  }
  it('surfaces impossible RAM plans as blocking warnings', () => {
    const { result } = cost({ ...input(), isRam: true, amountText: '22', pricing: { ...pricing, ram: { ...pricing.ram, minCheese: 6, maxCheese: 10 } } });
    expect(result.current.hasError).toBe(true);
    expect(result.current.warnings[0].message).toContain('cannot be split');
  });
  it('keeps unknown token rows conservative and credits known existing rows', () => {
    expect(cost().result.current.estimate.maxNewRows).toBe(2);
    expect(cost(input(), 1, 1).result.current.estimate.maxNewRows).toBe(1);
    expect(cost(input(), 2, 0).result.current.estimate.maxNewRows).toBe(0);
  });
  it('preserves mandatory 10 CHEESE sender RAM purchase and RAM-drop exemption', () => {
    expect(cost().result.current.requiredRamCheese).toBe(10);
    const ram = cost({ ...input(), isRam: true, amountText: '50' }).result.current;
    expect(ram.requiredRamCheese).toBeNull();
    expect(ram.estimate.maxNewRows).toBe(0);
    expect(ram.estimate.txCount).toBe(6);
    expect(ram.recipientCount).toBe(2);
  });
  it('leaves CPU quotations unknown when calibration and powerup pricing are unavailable', () => {
    const { result } = cost();
    expect(result.current.estCpuCheese).toBeNull();
    expect(result.current.cheesePerCpuMs).toBeNull();
  });
});