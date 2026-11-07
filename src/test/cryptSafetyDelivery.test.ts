import { describe, expect, it } from 'vitest';
import { generateKey } from '@/lib/cheeseCrypt';
import { safetyGroups, safetyNumber, verifyState } from '@/lib/cryptSafety';
import { deliveryState, parseLibTime } from '@/lib/cryptDelivery';

const a = generateKey('alice'), b = generateKey('bob'), c = generateKey('bob');
const A = { account: 'alice', publicKey: a.publicKey }, B = { account: 'bob', publicKey: b.publicKey };

describe('safety numbers', () => {
  it('is 60 digits in 12 groups and identical from both sides', () => {
    const n = safetyNumber(A, B);
    expect(n).toMatch(/^\d{60}$/);
    expect(safetyGroups(n)).toHaveLength(12);
    expect(safetyNumber(B, A)).toBe(n);
  });
  it('changes when either key changes', () => {
    expect(safetyNumber(A, { account: 'bob', publicKey: c.publicKey })).not.toBe(safetyNumber(A, B));
  });
  it('a verified mark only holds for the exact key that was verified', () => {
    expect(verifyState({ bob: b.publicKey }, 'bob', b.publicKey)).toBe('verified');
    expect(verifyState({ bob: b.publicKey }, 'bob', c.publicKey)).toBe('changed');
    expect(verifyState({}, 'bob', b.publicKey)).toBe('unverified');
  });
});

describe('delivery ticks', () => {
  const lib = parseLibTime({ last_irreversible_block_time: '2026-11-07T02:00:00.000' })!;
  it('reads the chain time as UTC', () => expect(lib).toBe(Date.parse('2026-11-07T02:00:00.000Z')));
  it('is permanent only when the message block is at or before the irreversible block', () => {
    expect(deliveryState(lib, lib)).toBe('permanent');
    expect(deliveryState(lib - 500, lib)).toBe('permanent');
    expect(deliveryState(lib + 500, lib)).toBe('sent');
  });
  it('never claims permanence without chain data', () => {
    expect(deliveryState(0, null)).toBe('sent');
    expect(parseLibTime({})).toBeNull();
  });
});
