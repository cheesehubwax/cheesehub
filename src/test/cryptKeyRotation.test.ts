import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyContactRotation, encryptMemo, generateKey, loadContacts, loadPreviousKeys, saveContact, splitMessage, KEY_PREFIX, type ChainMemo, type MessagingKey,
} from '@/lib/cheeseCrypt';
import { fromLockedFile, lockSecret, parseLockedKeyFile, sealKey, toLockedFile, withRetired } from '@/lib/cryptKeyLock';
import {
  buildRotateBatches, DAY_MS, encodeRotateNotice, expiryFor, isRotateNotice, keyAgeDays, noticeMemos, pendingContactRotations,
  rotatedRing, rotateCost, shouldNudge, shreddable, unannouncedFriends, withoutRetired,
} from '@/lib/cryptKeyRing';
import { decodeConversations } from '@/lib/cryptGroups';
import { buildCg2Actions, encodeGroupText } from '@/lib/cryptInviteGroups';
import { decryptMemo } from '@/lib/cheeseCrypt';

const T0 = Date.parse('2026-01-01T00:00:00Z');
type Act = { account: string; data: { to: string; memo: string; quantity: string } };
const memoRow = (from: string, to: string, memo: string, time: number, n = 0): ChainMemo => ({ txId: `tx${time}${n}`, time, from, to, memo, quantity: '0.0001 CHEESE' });
const textOf = (from: string, to: string, text: string, theirPub: string, mySecret: string, time: number) =>
  splitMessage(text).map((p, i) => memoRow(from, to, encryptMemo(p, theirPub, mySecret), time, i));

let alice0: MessagingKey, bob: MessagingKey, ring: MessagingKey;
beforeEach(() => {
  localStorage.clear();
  alice0 = generateKey('alice'); bob = generateKey('bob');
  ring = rotatedRing(alice0, generateKey('alice'), T0, 30);
});

describe('stealth key rotation', () => {
  it('by default sends only encrypted notices and never posts the key publicly', () => {
    const batches = buildRotateBatches(ring, ['bob'], { bob: bob.publicKey }, [{}], T0) as Act[][];
    const all = batches.flat();
    expect(all.some(a => a.data.memo.startsWith(KEY_PREFIX))).toBe(false);
    expect(all.filter(a => a.data.to === 'bob')).toHaveLength(1);
  });

  it('posting publicly is opt-in and adds exactly one key-publish fee pair', () => {
    const all = (buildRotateBatches(ring, ['bob'], { bob: bob.publicKey }, [{}], T0, true) as Act[][]).flat();
    const pub = all.filter(a => a.data.memo === `${KEY_PREFIX}${ring.publicKey}`);
    expect(pub.map(a => a.data.to).sort()).toEqual(['eosio.null', 'xcheeseliqst']);
    expect(rotateCost(1, 1, false)).toBe('0.0101 CHEESE');
    expect(rotateCost(1, 1, true)).toBe('0.0201 CHEESE');
  });

  it("the notice is written with the old key and carries the new public key", () => {
    const [memo] = noticeMemos(ring, bob.publicKey, T0);
    const text = decryptMemo(memo, alice0.publicKey, bob.secretKey);
    expect(isRotateNotice(text)).toBe(true);
    expect(text).toContain(ring.publicKey);
    expect(decryptMemo(memo, ring.publicKey, bob.secretKey)).toBeNull();
  });
});

describe("receiving a friend's rotation", () => {
  it('accepts a notice opened with the current key and rejects one from any other key', () => {
    const genuine = { from: 'alice', time: T0, text: encodeRotateNotice(ring.publicKey, T0), missing: 0, usedKey: alice0.publicKey };
    expect(pendingContactRotations([genuine], 'bob', { alice: alice0.publicKey }, {})).toEqual([{ from: 'alice', publicKey: ring.publicKey }]);
    const forged = { ...genuine, usedKey: generateKey('x').publicKey };
    expect(pendingContactRotations([forged], 'bob', { alice: alice0.publicKey }, {})).toEqual([]);
    // A stolen retired key can't redirect a friend who already moved on.
    const stale = { ...genuine, usedKey: alice0.publicKey, text: encodeRotateNotice(generateKey('x').publicKey, T0 + 1) };
    expect(pendingContactRotations([stale], 'bob', { alice: ring.publicKey }, { alice: [alice0.publicKey] })).toEqual([]);
  });

  it('end to end: new key is used after the notice and old chats still open', () => {
    saveContact('bob', 'alice', alice0.publicKey);
    const memos = [
      ...textOf('alice', 'bob', 'before rotation', bob.publicKey, alice0.secretKey, T0),
      memoRow('alice', 'bob', noticeMemos(ring, bob.publicKey, T0 + 1)[0], T0 + 1),
      ...textOf('alice', 'bob', 'after rotation', bob.publicKey, ring.secretKey, T0 + 2),
    ];
    let decoded = decodeConversations(memos, bob, loadContacts('bob'), T0, [], loadPreviousKeys('bob'));
    for (const c of pendingContactRotations(decoded, 'bob', loadContacts('bob'), loadPreviousKeys('bob'))) applyContactRotation('bob', c.from, c.publicKey);
    expect(loadContacts('bob').alice).toBe(ring.publicKey);
    decoded = decodeConversations(memos, bob, loadContacts('bob'), T0, [], loadPreviousKeys('bob'));
    expect(decoded.map(d => d.text)).toEqual(expect.arrayContaining(['before rotation', 'after rotation']));
  });

  it('an old key file never replaces the rotated key', () => {
    saveContact('bob', 'alice', alice0.publicKey);
    applyContactRotation('bob', 'alice', ring.publicKey);
    saveContact('bob', 'alice', alice0.publicKey);
    expect(loadContacts('bob').alice).toBe(ring.publicKey);
  });
});

describe('my ring', () => {
  it('reads messages sent to a retired key', () => {
    const memos = textOf('bob', 'alice', 'to my old key', alice0.publicKey, bob.secretKey, T0);
    expect(decodeConversations(memos, ring, { bob: bob.publicKey }, T0).map(d => d.text)).toEqual(['to my old key']);
  });

  it('room traffic keeps using the key the roster pins', () => {
    const roster = { alice: alice0.publicKey, bob: bob.publicKey };
    const [act] = buildCg2Actions(ring, ['bob'], roster, encodeGroupText('0123456789abcdef', 'hi'), [{}]) as Act[];
    expect(decryptMemo(act.data.memo, alice0.publicKey, bob.secretKey)).not.toBeNull();
  });

  it('friends are pending until told; blocked accounts are skipped', () => {
    const state = { to: ring.publicKey, announced: ['bob'] };
    expect(unannouncedFriends(ring, { bob: 'k', carol: 'k', dave: 'k' }, state, ['dave'])).toEqual(['carol']);
    expect(unannouncedFriends(alice0, { bob: 'k' }, state)).toEqual([]);
  });
});

describe('retention and shredding', () => {
  it('expiry follows the retention choice; forever never expires', () => {
    expect(expiryFor(T0, 30)).toBe(new Date(T0 + 30 * DAY_MS).toISOString());
    expect(expiryFor(T0, null)).toBeNull();
    const r = ring.retired![0];
    expect(shreddable(ring, T0 + 29 * DAY_MS, new Set(), false)).toEqual([]);
    expect(shreddable(ring, T0 + 30 * DAY_MS, new Set(), false)).toEqual([r]);
  });

  it('never destroys a key a room pins, nor while friends are still pending', () => {
    const later = T0 + 31 * DAY_MS;
    expect(shreddable(ring, later, new Set([alice0.publicKey]), false)).toEqual([]);
    expect(shreddable(ring, later, new Set(), true)).toEqual([]);
    expect(withoutRetired(ring, [alice0.publicKey]).retired).toBeUndefined();
  });

  it('nudges at 90 days and respects the snooze', () => {
    const created = new Date(T0).toISOString();
    expect(keyAgeDays(created, T0 + 89 * DAY_MS)).toBe(89);
    expect(shouldNudge(T0 + 89 * DAY_MS, created, 0)).toBe(false);
    expect(shouldNudge(T0 + 90 * DAY_MS, created, 0)).toBe(true);
    expect(shouldNudge(T0 + 90 * DAY_MS, created, T0 + 120 * DAY_MS)).toBe(false);
  });
});

describe('locked ring files', () => {
  const sig = 'SIG_K1_' + 'A'.repeat(90);
  it('round-trip retired keys sealed under the active secret', async () => {
    const file = toLockedFile(ring, await lockSecret(ring.secretKey, sig));
    const parsed = parseLockedKeyFile(JSON.parse(JSON.stringify(file)))!;
    expect(parsed.retired).toHaveLength(1);
    expect(JSON.stringify(parsed)).not.toContain(alice0.secretKey);
    expect(fromLockedFile(parsed, ring.secretKey).retired![0].secretKey).toBe(alice0.secretKey);
  });

  it('older files without retired keys still parse the same', async () => {
    const file = toLockedFile(alice0, await lockSecret(alice0.secretKey, sig));
    expect('retired' in file).toBe(false);
    expect(parseLockedKeyFile(JSON.parse(JSON.stringify(file)))).toEqual(file);
  });

  it('rejects a tampered retired entry and re-seals after shredding', async () => {
    const file = toLockedFile(ring, await lockSecret(ring.secretKey, sig));
    const bad = { ...file, retired: [{ ...file.retired![0], publicKey: bob.publicKey }] };
    expect(() => fromLockedFile(parseLockedKeyFile(bad)!, ring.secretKey)).toThrow();
    const shredded = withRetired(file, withoutRetired(ring, [alice0.publicKey]));
    expect(shredded.retired).toBeUndefined();
    expect(shredded.lock).toEqual(file.lock);
  });

  it('sealing verifies the retired keys reopen', async () => {
    const file = await sealKey(async () => sig, ring, 'alice');
    expect(fromLockedFile(file, ring.secretKey).retired![0].publicKey).toBe(alice0.publicKey);
  });
});
