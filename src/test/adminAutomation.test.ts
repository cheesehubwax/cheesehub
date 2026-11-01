import { describe, it, expect } from 'vitest';
import {
  cryptPendingWarn, cryptBalanceWarn, powerzReserveWarn, nextClaimAt, claimOverdue, missingCompoundLinks,
} from '@/lib/adminAutomation';

describe('monitor warning rules', () => {
  it('flags any pending crypt.cheese payment', () => {
    expect(cryptPendingWarn({ pendingCount: 0 })).toBe(false);
    expect(cryptPendingWarn({ pendingCount: 1 })).toBe(true);
  });
  it('flags CHEESE held on the router above dust', () => {
    expect(cryptBalanceWarn(0.0001)).toBe(false);
    expect(cryptBalanceWarn(0.0002)).toBe(true);
  });
  it('flags cheesepowerz liquid WAX above 400', () => {
    expect(powerzReserveWarn(400)).toBe(false);
    expect(powerzReserveWarn(400.00000001)).toBe(true);
  });
  it('next claim is 24h 5m after the last', () => {
    const last = new Date('2026-11-01T01:19:00Z');
    expect(nextClaimAt(last)?.toISOString()).toBe('2026-11-02T01:24:00.000Z');
  });
  it('claim overdue only after 2h past due', () => {
    const last = new Date('2026-11-01T01:19:00Z');
    expect(claimOverdue(last, new Date('2026-11-02T03:24:00Z'))).toBe(false);
    expect(claimOverdue(last, new Date('2026-11-02T03:25:00Z'))).toBe(true);
  });
  it('reports missing compound links', () => {
    expect(missingCompoundLinks({ compoundPermission: false, linkedActions: [] })).toEqual(['claimgbmvote', 'delegatebw']);
    expect(missingCompoundLinks({ compoundPermission: true, linkedActions: ['claimgbmvote'] })).toEqual(['delegatebw']);
    expect(missingCompoundLinks({ compoundPermission: true, linkedActions: ['claimgbmvote', 'delegatebw'] })).toEqual([]);
  });
});
