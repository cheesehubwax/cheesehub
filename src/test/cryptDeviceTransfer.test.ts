import { describe, expect, it } from 'vitest';
import nacl from 'tweetnacl';
import { encodeBase64 } from 'tweetnacl-util';
import { buildBundle, decryptFrames, encryptBundle, generateCode, mergeBundle, CODE_ALPHABET, type StorageLike } from '@/lib/cryptDeviceTransfer';

const ITER = 1000;
const b64 = (n: number) => encodeBase64(nacl.randomBytes(n));
const pk = () => b64(32);
const locked = (account = 'dr.cheese') => ({ type: 'gpk-msg-key', version: 2, account, publicKey: pk(), created: '2026-01-01',
  lock: { scheme: 'cheesecrypt-anchor-sig-v1', salt: b64(16), nonce: b64(24), ciphertext: b64(48) } });
const mem = (init: Record<string, unknown> = {}): StorageLike & { data: Map<string, string> } => {
  const data = new Map(Object.entries(init).map(([k, v]) => [k, JSON.stringify(v)]));
  return { data, getItem: k => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

describe('device transfer', () => {
  it('codes are 12 symbols from the 32-letter alphabet', () => {
    const c = generateCode();
    expect(c).toHaveLength(12);
    expect([...c].every(ch => CODE_ALPHABET.includes(ch))).toBe(true);
  });

  it('round-trips and reports the friend list', async () => {
    const friend = pk();
    const src = mem({ 'cheesecrypt-contacts-dr.cheese': { alice: friend }, 'cheesecrypt-blocked-dr.cheese': ['spammer'] });
    const code = generateCode();
    const frames = await encryptBundle(buildBundle('dr.cheese', locked(), src), code, ITER);
    const b = await decryptFrames([...frames].reverse(), code, 'dr.cheese', ITER);
    expect(b.stores.contacts).toEqual({ alice: friend });
    expect(b.stores.blocked).toEqual(['spammer']);
  });

  it('refuses a plain (unlocked) key', () => {
    expect(() => buildBundle('dr.cheese', { type: 'gpk-msg-key', version: 1, account: 'dr.cheese', publicKey: pk(), secretKey: b64(32) }, mem())).toThrow();
  });

  it('rejects a wrong code', async () => {
    const frames = await encryptBundle(buildBundle('dr.cheese', locked(), mem()), 'AAAAAAAAAAAA', ITER);
    await expect(decryptFrames(frames, 'BBBBBBBBBBBB', 'dr.cheese', ITER)).rejects.toThrow(/Wrong code/);
  });

  it('rejects a tampered frame', async () => {
    const frames = await encryptBundle(buildBundle('dr.cheese', locked(), mem()), 'AAAAAAAAAAAA', ITER);
    const last = frames[frames.length - 1];
    const flipped = last.slice(0, -2) + (last.slice(-2, -1) === 'A' ? 'B' : 'A') + last.slice(-1);
    await expect(decryptFrames([...frames.slice(0, -1), flipped], 'AAAAAAAAAAAA', 'dr.cheese', ITER)).rejects.toThrow();
  });

  it('rejects missing frames and the wrong account', async () => {
    const big: Record<string, string> = {};
    for (let i = 0; i < 60; i++) big[`f${'abcde'[i % 5]}${i}`] = pk();
    const frames = await encryptBundle(buildBundle('dr.cheese', locked(), mem({ 'cheesecrypt-contacts-dr.cheese': big })), 'AAAAAAAAAAAA', ITER);
    expect(frames.length).toBeGreaterThan(1);
    await expect(decryptFrames(frames.slice(1), 'AAAAAAAAAAAA', 'dr.cheese', ITER)).rejects.toThrow(/missing/);
    await expect(decryptFrames(frames, 'AAAAAAAAAAAA', 'bob', ITER)).rejects.toThrow(/for dr.cheese/);
  });

  it('merges without wiping, keeps newer entries and respects local removals', async () => {
    const a = pk(), b = pk(), c = pk();
    const src = mem({
      'cheesecrypt-contacts-dr.cheese': { alice: a, bob: b, carol: c },
      'cheesecrypt-invite-decisions-dr.cheese': { '0123456789abcdef': { status: 'joined', at: 200 } },
      'cheesecrypt-blocked-dr.cheese': ['spammer'],
    });
    const bundle = buildBundle('dr.cheese', locked(), src);
    const dst = mem({
      'cheesecrypt-contacts-dr.cheese': { dave: pk() },
      'cheesecrypt-removed-contacts-dr.cheese': ['carol'],
      'cheesecrypt-invite-decisions-dr.cheese': { '0123456789abcdef': { status: 'left', at: 100 } },
      'cheesecrypt-blocked-dr.cheese': ['troll'],
    });
    mergeBundle(bundle, dst);
    const contacts = JSON.parse(dst.data.get('cheesecrypt-contacts-dr.cheese')!);
    expect(Object.keys(contacts).sort()).toEqual(['alice', 'bob', 'dave']);
    expect(JSON.parse(dst.data.get('cheesecrypt-invite-decisions-dr.cheese')!)['0123456789abcdef'].status).toBe('joined');
    expect(JSON.parse(dst.data.get('cheesecrypt-blocked-dr.cheese')!).sort()).toEqual(['spammer', 'troll']);
  });
});
