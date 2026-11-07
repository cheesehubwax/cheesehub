// @vitest-environment node
import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

// The package's Node distribution is CommonJS; browser initialization is checked separately in Chromium.
vi.mock('@kinsh/vodozemac-wasm', () => {
  const engine = createRequire(import.meta.url)('@kinsh/vodozemac-wasm');
  return { ...engine, default: async () => {} };
});

import { acceptSecretPrototypeSession, advanceSecretPrototypeReceive, advanceSecretPrototypeSend, createSecretPrototypeIdentity, createSecretPrototypeSession, SECRET_CHAT_LIVE } from '@/lib/cryptSecretEngine';
import { assembleSecretPrototype, frameSecretPrototype } from '@/lib/cryptSecretWire';
import { decryptMemoBytes, generateKey, msgPrefixOf } from '@/lib/cheeseCrypt';

async function pair() {
  const alice = await createSecretPrototypeIdentity(), bob = await createSecretPrototypeIdentity();
  const initial = await createSecretPrototypeSession(alice.accountState, bob);
  const first = await advanceSecretPrototypeSend(initial, 'first secret');
  const accepted = await acceptSecretPrototypeSession(bob.accountState, first.ciphertext, alice.identityKey);
  const reply = await advanceSecretPrototypeSend(accepted.sessionState, 'accepted');
  const received = await advanceSecretPrototypeReceive(first.sessionState, reply.ciphertext);
  return { alice, bob, first, accepted, a: received.sessionState, b: reply.sessionState };
}

describe('isolated Secret Chat prototype', () => {
  it('never enables real messaging before release gates pass', () => expect(SECRET_CHAT_LIVE).toBe(false));
  it('uses independent random identities and authenticated expected peer identities', async () => {
    const p = await pair();
    expect(p.alice.identityKey).not.toBe(p.bob.identityKey);
    expect(p.accepted.text).toBe('first secret');
    await expect(acceptSecretPrototypeSession(p.bob.accountState, p.first.ciphertext, p.bob.identityKey)).rejects.toThrow('identity changed');
  });
  it('consumes the recipient prekey; old initial ciphertext cannot create another session', async () => {
    const p = await pair();
    await expect(acceptSecretPrototypeSession(p.accepted.accountState, p.first.ciphertext, p.alice.identityKey)).rejects.toBeDefined();
  });
  it('supports out-of-order messages and rejects replay after consuming skipped keys', async () => {
    const p = await pair();
    const one = await advanceSecretPrototypeSend(p.a, 'one');
    const two = await advanceSecretPrototypeSend(one.sessionState, 'two');
    const newer = await advanceSecretPrototypeReceive(p.b, two.ciphertext);
    expect(newer.text).toBe('two');
    const older = await advanceSecretPrototypeReceive(newer.sessionState, one.ciphertext);
    expect(older.text).toBe('one');
    await expect(advanceSecretPrototypeReceive(older.sessionState, one.ciphertext)).rejects.toBeDefined();
  });
  it('current receiver state cannot decrypt previously consumed ciphertext', async () => {
    const p = await pair();
    const sent = await advanceSecretPrototypeSend(p.a, 'erase this message key');
    const read = await advanceSecretPrototypeReceive(p.b, sent.ciphertext);
    await expect(advanceSecretPrototypeReceive(read.sessionState, sent.ciphertext)).rejects.toBeDefined();
  });
  it('tampering fails without changing the caller snapshot; original still decrypts', async () => {
    const p = await pair();
    const sent = await advanceSecretPrototypeSend(p.a, 'authentic');
    const body = sent.ciphertext.body;
    const index = Math.floor(body.length / 2);
    const changed = body.slice(0, index) + (body[index] === 'A' ? 'B' : 'A') + body.slice(index + 1);
    await expect(advanceSecretPrototypeReceive(p.b, { ...sent.ciphertext, body: changed })).rejects.toBeDefined();
    expect((await advanceSecretPrototypeReceive(p.b, sent.ciphertext)).text).toBe('authentic');
  });
  it('frames complete logical envelopes into 256-byte memos, up to 35 parts', async () => {
    const p = await pair();
    const sent = await advanceSecretPrototypeSend(p.a, '🧀'.repeat(500));
    const memos = frameSecretPrototype(sent.ciphertext);
    expect(memos.length).toBeGreaterThan(1);
    expect(memos.length).toBeLessThanOrEqual(35);
    expect(new Set(memos.map(m => new TextEncoder().encode(m).length))).toEqual(new Set([256]));
    const copies = memos.map(memo => ({ txId: 'tx1', from: 'alice', to: 'bob', memo }));
    expect(assembleSecretPrototype([...copies].reverse())?.id).toBe(memos[0].slice(8, 40));
    expect(assembleSecretPrototype(copies.slice(1))).toBeNull();
    expect(assembleSecretPrototype(copies.map((c, i) => i ? c : { ...c, txId: 'different' }))).toBeNull();
    expect(assembleSecretPrototype(copies.map((c, i) => i ? c : { ...c, to: 'mallory' }))).toBeNull();
  });
  it('secret framing is not accepted or decrypted as ordinary chat traffic', async () => {
    const p = await pair(), a = generateKey('alice'), b = generateKey('bob');
    for (const memo of frameSecretPrototype(p.first.ciphertext)) {
      expect(msgPrefixOf(memo)).toBeNull();
      expect(decryptMemoBytes(memo, a.publicKey, b.secretKey)).toBeNull();
    }
  });
  it('bounds input before advancing the ratchet', async () => {
    const p = await pair();
    await expect(advanceSecretPrototypeSend(p.a, 'x'.repeat(2049))).rejects.toThrow('text size');
    await expect(advanceSecretPrototypeSend(p.a, '')).rejects.toThrow('text size');
    expect((await advanceSecretPrototypeSend(p.a, 'still usable')).ciphertext.body).toBeTruthy();
  });
});