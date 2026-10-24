import { describe, expect, it } from 'vitest';
import { LOCK_SIGN_WINDOW_MS, patchAnchorForLockSigning } from '@/lib/anchorLockSigning';

class LinkInfo { constructor(public expiration: Date) {} static from(v: { expiration: Date }) { return new LinkInfo(v.expiration); } }

function fakePlugin() {
  const seen: { delay?: number; link?: LinkInfo; tx?: unknown } = {};
  return {
    seen,
    // Mirrors Anchor: link expiry and prompt timeout both come from the transaction expiry.
    async sign(resolved: { transaction: { expiration: { toDate(): Date } } }, context: { createRequest(a: unknown): Promise<{ setInfoKey(k: string, v: unknown): void }> }) {
      const expiration = resolved.transaction.expiration.toDate();
      const req = await context.createRequest({ transaction: resolved.transaction });
      req.setInfoKey('link', LinkInfo.from({ expiration }));
      seen.tx = resolved.transaction;
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('The request expired, please try again.')), expiration.getTime() - Date.now());
        seen.delay = expiration.getTime() - Date.now();
        setTimeout(() => { clearTimeout(t); resolve(); }, 20);
      });
      return 'signed';
    },
  };
}
const ctx = (store: { link?: unknown }) => ({ createRequest: async () => ({ setInfoKey: (k: string, v: unknown) => { if (k === 'link') store.link = v; } }) });
const resolvedAt = (iso: string) => ({ transaction: { expiration: { toDate: () => new Date(iso) } } });

describe('Anchor key-lock signing window', () => {
  it('keeps the 2020 lock request open instead of expiring instantly, without touching the transaction', async () => {
    const plugin = patchAnchorForLockSigning(fakePlugin());
    const store: { link?: LinkInfo } = {};
    const resolved = resolvedAt('2020-01-01T00:00:00Z');
    await expect(plugin.sign(resolved, ctx(store))).resolves.toBe('signed');
    expect(plugin.seen.tx).toBe(resolved.transaction);
    expect(resolved.transaction.expiration.toDate().toISOString()).toBe('2020-01-01T00:00:00.000Z');
    const linkMs = store.link!.expiration.getTime() - Date.now();
    expect(linkMs).toBeGreaterThan(LOCK_SIGN_WINDOW_MS - 5000);
    expect(linkMs).toBeLessThanOrEqual(LOCK_SIGN_WINDOW_MS);
  });

  it('restores the real timer afterwards', async () => {
    const real = globalThis.setTimeout;
    await patchAnchorForLockSigning(fakePlugin()).sign(resolvedAt('2020-01-01T00:00:00Z'), ctx({}));
    expect(globalThis.setTimeout).toBe(real);
  });

  it('leaves normal transactions alone', async () => {
    const plugin = patchAnchorForLockSigning(fakePlugin());
    const store: { link?: LinkInfo } = {};
    const future = new Date(Date.now() + 60_000).toISOString();
    await plugin.sign(resolvedAt(future), ctx(store));
    expect(store.link!.expiration.toISOString()).toBe(future);
  });
});
