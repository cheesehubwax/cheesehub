import { describe, it, expect } from 'vitest';
import { formatRawUnits, waxRoutes, hopPercent, isInFlight, widgetUrl, type BridgeRoute } from '@/lib/alcorBridge';

const r = (symbol: string, from: string, to: string): BridgeRoute => ({ symbol, precision: 6, from, to, via: null, open: true, min: '1', max: '2' });

describe('alcorBridge', () => {
  it('formats raw units exactly', () => {
    expect(formatRawUnits('5000000', 6)).toBe('5');
    expect(formatRawUnits('5050505050505050506', 18)).toBe('5.050505050505050506');
    expect(formatRawUnits('1000000000000000', 18)).toBe('0.001');
    expect(formatRawUnits('abc', 6)).toBeNull();
  });
  it('splits WAX routes into arriving and leaving', () => {
    const { into, outOf } = waxRoutes([r('USDC', 'bsc', 'wax'), r('USDC', 'wax', 'mainnet'), r('ETH', 'mainnet', 'telos')]);
    expect(into.map((x) => x.from)).toEqual(['bsc']);
    expect(outOf.map((x) => x.to)).toEqual(['mainnet']);
  });
  it('keeps unknown progress unknown', () => {
    expect(hopPercent({ key: 'a', status: 'arriving' })).toBeNull();
    expect(hopPercent({ key: 'a', status: 'delivered' })).toBe(100);
    expect(hopPercent({ key: 'a', status: 'sending', progress: { percent: 140 } })).toBe(100);
    expect(isInFlight({ key: 'a', status: 'sending' })).toBe(true);
    expect(isInFlight({ key: 'a', status: 'delivered' })).toBe(false);
  });
  it('widget URL never carries a partner tag and rejects bad recipients', () => {
    const u = new URL(widgetUrl({ recipient: 'm23qs.wam' }));
    expect(u.searchParams.get('recipient')).toBe('m23qs.wam');
    expect(u.searchParams.has('partner')).toBe(false);
    expect(new URL(widgetUrl({ recipient: 'BAD<x>' })).searchParams.has('recipient')).toBe(false);
  });
});
