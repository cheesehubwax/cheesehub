import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSnapshot, setSnapshot, SNAPSHOT_MAX_BYTES, SNAPSHOT_TTL_MS, snapshotAccounts } from '@/lib/cryptTrustSnapshot';
import { clearCryptLookupCache } from '@/lib/cryptStorage';
const KEY = 'cheesecrypt-trust-snapshot-v1';
const now = 1_800_000_000_000;
beforeEach(() => { clearCryptLookupCache(); localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); clearCryptLookupCache(); });
describe('bounded Respect lookup cache', () => {
  it('caps serialized snapshots at 256 KiB and keeps the newest entries', () => {
    expect(SNAPSHOT_MAX_BYTES).toBe(262144);
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(Array.from({ length: 100 }, (_, i) =>
      [`pools:account${i}`, { at: now - 100 + i, value: 'x'.repeat(5000) }]))));
    expect(getSnapshot('pools:account99', now)?.value).toHaveLength(5000);
    expect(getSnapshot('pools:account0', now)).toBeNull();
    expect(2 * (localStorage.getItem(KEY)?.length ?? Infinity)).toBeLessThanOrEqual(262144);
  });
  it('does not allow one oversized lookup to evict all useful small lookups', () => {
    setSnapshot('balance:alice', 12, now);
    setSnapshot('pools:bob', 'x'.repeat(SNAPSHOT_MAX_BYTES), now + 1);
    expect(getSnapshot('pools:bob', now + 1)).toBeNull();
    expect(getSnapshot('balance:alice', now + 1)?.value).toBe(12);
  });
  it('expires after 24 hours and excludes future timestamps and failed lookups', () => {
    expect(SNAPSHOT_TTL_MS).toBe(86400000);
    setSnapshot('balance:alice', 10, now);
    setSnapshot('balance:bob', null, now);
    expect(getSnapshot('balance:alice', now - 1)).toBeNull();
    setSnapshot('balance:alice', 10, now);
    expect(getSnapshot('balance:alice', now + SNAPSHOT_TTL_MS - 1)?.value).toBe(10);
    expect(snapshotAccounts(now + SNAPSHOT_TTL_MS)).toEqual([]);
    expect(getSnapshot('balance:bob', now)).toBeNull();
  });
  it('retains a successful lookup in this tab when quota prevents persistence', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    setSnapshot('balance:alice', 42, now);
    expect(getSnapshot('balance:alice', now)?.value).toBe(42);
    expect(snapshotAccounts(now)).toEqual(['alice']);
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});