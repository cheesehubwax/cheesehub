import { describe, it, expect } from 'vitest';
import nacl from 'tweetnacl';
import { encodeBase64, decodeUTF8 } from 'tweetnacl-util';
import {
  generateKey, encryptMemo, decryptMemo, keyMemo, buildPublishKeyActions, newestPublishedKey, MAX_PLAINTEXT_BYTES, MEMO_MAX_BYTES, messageCost,
} from '@/lib/cheeseCrypt';
import { isCryptNullMemo } from '@/lib/cheeseNullBreakdown';
import { decodeConversations, groupMessageCost, createGroup } from '@/lib/cryptGroups';
import { buildVoiceBatches, splitVoice, voicePartCount, VOICE_MAX_BYTES, VOICE_PARTS_PER_TX, type VoiceClip } from '@/lib/cryptVoice';

const a = generateKey('alice.wam'), b = generateKey('bob.wam'), c = generateKey('carol.wam');
const webm = (n: number) => { const x = nacl.randomBytes(n); x.set([0x1a, 0x45, 0xdf, 0xa3]); return x; };
const clip = (n = 9000, durationMs = 9500): VoiceClip => ({ bytes: webm(n), mime: 'audio/webm;codecs=opus', durationMs });

/** Turns built transactions into the chain memos the recipient would see. */
const toMemos = (batches: unknown[][], to: string) => batches.flatMap((actions, t) => (actions as { data: { from: string; to: string; memo: string; quantity: string } }[])
  .filter(x => x.data.to === to).map((x, i) => ({ txId: `tx${t}`, time: 1000 + t * 1000 + i, from: x.data.from, to, memo: x.data.memo, quantity: x.data.quantity })));

describe('CHEESECrypt memo prefixes', () => {
  it('new messages and key publications use CRYPT1: and CRYPTKEY1:', () => {
    expect(encryptMemo('hi', b.publicKey, a.secretKey).startsWith('CRYPT1:')).toBe(true);
    expect(buildPublishKeyActions('alice.wam', a.publicKey, [])[0].data.memo).toBe(`CRYPTKEY1:${a.publicKey}`);
    expect(keyMemo(a.publicKey).startsWith('CRYPTKEY1:')).toBe(true);
  });
  it('legacy GPKM1: messages still decrypt', () => {
    const nonce = nacl.randomBytes(24);
    const legacy = `GPKM1:${encodeBase64(nonce)}:${encodeBase64(nacl.box(decodeUTF8('old hello'), nonce, Buffer.from(b.publicKey, 'base64'), Buffer.from(a.secretKey, 'base64')))}`;
    expect(decryptMemo(legacy, a.publicKey, b.secretKey)).toBe('old hello');
  });
  it('legacy GPKMKEY1: keys still resolve, newest of either prefix wins', () => {
    const row = (memo: string) => ({ txId: 't', time: 0, from: 'alice.wam', to: 'eosio.null', memo, quantity: '0.0100 CHEESE' });
    expect(newestPublishedKey('alice.wam', [row(`GPKMKEY1:${a.publicKey}`)])).toBe(a.publicKey);
    expect(newestPublishedKey('alice.wam', [row(`CRYPTKEY1:${b.publicKey}`), row(`GPKMKEY1:${a.publicKey}`)])).toBe(b.publicKey);
  });
  it('one-part limit stays 146 bytes and fits the memo', () => {
    expect(MAX_PLAINTEXT_BYTES).toBe(146);
    expect(new TextEncoder().encode(encryptMemo('x'.repeat(146), b.publicKey, a.secretKey)).length).toBeLessThanOrEqual(MEMO_MAX_BYTES);
  });
  it('Null by Contract counts both key prefixes and the fee memo', () => {
    expect(isCryptNullMemo('CRYPTKEY1:abc')).toBe(true);
    expect(isCryptNullMemo('GPKMKEY1:abc')).toBe(true);
    expect(isCryptNullMemo('CHEESECrypt messaging fee')).toBe(true);
    expect(isCryptNullMemo('something else')).toBe(false);
  });
});

describe('CHEESECrypt voice notes', () => {
  it('round trips through encryption across several transactions, even out of order', () => {
    const v = clip();
    const batches = buildVoiceBatches(a, ['bob.wam'], null, v, { 'bob.wam': b.publicKey }, []);
    expect(batches.length).toBeGreaterThan(1);
    const memos = toMemos(batches, 'bob.wam').reverse();
    const conv = decodeConversations(memos, b, { 'alice.wam': a.publicKey }, 2000);
    expect(conv).toHaveLength(1);
    expect(conv[0].voice?.status).toBe('ready');
    expect(Array.from(conv[0].voice!.audio!)).toEqual(Array.from(v.bytes));
    expect(conv[0].voice!.durationMs).toBe(9500);
    // the sender reads their own note too
    expect(decodeConversations(memos, a, { 'bob.wam': b.publicKey }, 2000)[0].voice?.status).toBe('ready');
  });
  it('a missing part never plays; a damaged part is rejected', () => {
    const memos = toMemos(buildVoiceBatches(a, ['bob.wam'], null, clip(), { 'bob.wam': b.publicKey }, []), 'bob.wam');
    const missing = decodeConversations(memos.filter((_, i) => i !== 5), b, { 'alice.wam': a.publicKey }, 10 ** 9);
    expect(missing[0].voice?.status).toBe('incomplete');
    expect(missing[0].voice?.audio).toBeNull();
    const fresh = decodeConversations(memos.filter((_, i) => i !== 5), b, { 'alice.wam': a.publicKey }, 2000);
    expect(fresh[0].voice?.status).toBe('loading');
    // swap one audio part for a validly encrypted but different body → digest mismatch
    const plain = splitVoice(clip(), null, 'abcdef');
    const other = splitVoice(clip(), null, 'abcdef');
    const parts = plain.map((p, i) => (i === 3 ? other[3] : p));
    const bad = parts.map((p, i) => ({ txId: 'tx', time: i, from: 'alice.wam', to: 'bob.wam', quantity: '', memo: encryptBytes(p) }));
    expect(decodeConversations(bad, b, { 'alice.wam': a.publicKey }, 0)[0].voice?.status).toBe('invalid');
  });
  it('enforces the 10 second and 12 KB caps', () => {
    expect(() => splitVoice(clip(VOICE_MAX_BYTES + 1))).toThrow();
    expect(() => splitVoice(clip(1000, 11_000))).toThrow();
    expect(() => splitVoice(clip(VOICE_MAX_BYTES, 10_000))).not.toThrow();
  });
  it('never puts more than 30 parts in one transaction', () => {
    const v = clip(VOICE_MAX_BYTES, 10_000);
    const batches = buildVoiceBatches(a, ['bob.wam'], null, v, { 'bob.wam': b.publicKey }, []);
    batches.forEach(t => expect(t.length / 2).toBeLessThanOrEqual(VOICE_PARTS_PER_TX));
    expect(batches.reduce((n, t) => n + t.length / 2, 0)).toBe(voicePartCount(v));
  });
  it('costs the message rate per part in DMs and groups', () => {
    const v = clip();
    const parts = voicePartCount(v);
    const dm = buildVoiceBatches(a, ['bob.wam'], null, v, { 'bob.wam': b.publicKey }, []).flat() as { data: { quantity: string } }[];
    const sum = (l: { data: { quantity: string } }[]) => (l.reduce((t, x) => t + Math.round(parseFloat(x.data.quantity) * 10000), 0) / 10000).toFixed(4) + ' CHEESE';
    expect(sum(dm)).toBe(messageCost(parts));
    expect(messageCost(parts)).toBe(`${(parts * 0.011).toFixed(4)} CHEESE`);
    const group = createGroup('alice.wam', ['bob.wam', 'carol.wam']);
    const g = buildVoiceBatches(a, ['bob.wam', 'carol.wam'], group, v, { 'bob.wam': b.publicKey, 'carol.wam': c.publicKey }, []).flat() as { data: { quantity: string } }[];
    expect(sum(g)).toBe(groupMessageCost(parts, 2));
    expect(groupMessageCost(parts, 2)).toBe(`${(parts * 0.012).toFixed(4)} CHEESE`);
  });
  it('group notes land in the group and show once for the sender', () => {
    const group = createGroup('alice.wam', ['bob.wam', 'carol.wam']);
    const batches = buildVoiceBatches(a, ['bob.wam', 'carol.wam'], group, clip(), { 'bob.wam': b.publicKey, 'carol.wam': c.publicKey }, []);
    const forCarol = decodeConversations(toMemos(batches, 'carol.wam'), c, { 'alice.wam': a.publicKey }, 2000);
    expect(forCarol).toHaveLength(1);
    expect(forCarol[0].group?.id).toBe(group.id);
    expect(forCarol[0].voice?.status).toBe('ready');
    const all = [...toMemos(batches, 'bob.wam'), ...toMemos(batches, 'carol.wam')];
    expect(decodeConversations(all, a, { 'bob.wam': b.publicKey, 'carol.wam': c.publicKey }, 2000)).toHaveLength(1);
  });
});

function encryptBytes(p: Uint8Array) {
  const nonce = nacl.randomBytes(24);
  return `CRYPT1:${encodeBase64(nonce)}:${encodeBase64(nacl.box(p, nonce, Buffer.from(b.publicKey, 'base64'), Buffer.from(a.secretKey, 'base64')))}`;
}
