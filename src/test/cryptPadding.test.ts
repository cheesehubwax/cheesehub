import { describe, expect, it } from 'vitest';
import nacl from 'tweetnacl';
import { decodeBase64, decodeUTF8, encodeBase64 } from 'tweetnacl-util';
import { buildSendMessageActions, decryptMemo, decryptMemoBytes, encryptBytesMemo, encryptMemo, generateKey, MAX_PLAINTEXT_BYTES, MEMO_MAX_BYTES, splitMessage } from '@/lib/cheeseCrypt';
import { routeCryptActions } from '@/lib/cheeseCrypt';
import { encodeJoinMemo, joinMemoKey } from '@/lib/cryptRooms';

const a = generateKey('alice'), b = generateKey('bob');
const len = (s: string) => new TextEncoder().encode(s).length;

describe('fixed-length padding', () => {
  it('every single-part memo has the same length regardless of content length', () => {
    const lengths = new Set(['k', 'ok', 'hello there', 'x'.repeat(MAX_PLAINTEXT_BYTES)].map(t => len(encryptMemo(t, b.publicKey, a.secretKey))));
    expect([...lengths]).toEqual([MEMO_MAX_BYTES]);
  });
  it('round-trips 1-byte, maximum and multi-part content', () => {
    for (const t of ['k', 'y'.repeat(MAX_PLAINTEXT_BYTES), 'À€🧀']) expect(decryptMemo(encryptMemo(t, b.publicKey, a.secretKey), a.publicKey, b.secretKey)).toBe(t);
    const parts = splitMessage('z'.repeat(400)).map(p => encryptMemo(p, b.publicKey, a.secretKey));
    expect(new Set(parts.map(len)).size).toBe(1);
    expect(parts.map(m => decryptMemo(m, a.publicKey, b.secretKey)).join('').includes('z'.repeat(100))).toBe(true);
  });
  it('preserves binary payloads ending in zero or 0x80 bytes', () => {
    const raw = new Uint8Array([3, 0, 0x80, 0, 0]);
    expect(Array.from(decryptMemoBytes(encryptBytesMemo(raw, b.publicKey, a.secretKey), a.publicKey, b.secretKey)!)).toEqual(Array.from(raw));
  });
  it('legacy unpadded CRYPT1: memos still decrypt unchanged', () => {
    const nonce = nacl.randomBytes(24);
    const legacy = `CRYPT1:${encodeBase64(nonce)}:${encodeBase64(nacl.box(decodeUTF8('old\u0080'), nonce, decodeBase64(b.publicKey), decodeBase64(a.secretKey)))}`;
    expect(decryptMemo(legacy, a.publicKey, b.secretKey)).toBe('old\u0080');
  });
  it('rejects CRYPT2: memos with malformed padding', () => {
    const nonce = nacl.randomBytes(24);
    const bad = `CRYPT2:${encodeBase64(nonce)}:${encodeBase64(nacl.box(new Uint8Array([104, 105, 0, 0]), nonce, decodeBase64(b.publicKey), decodeBase64(a.secretKey)))}`;
    expect(decryptMemoBytes(bad, a.publicKey, b.secretKey)).toBeNull();
  });
  it('padded join requests still fit the memo with the carried key', () => {
    const memos = [undefined, 'hi', 'x'.repeat(60)].map(n => encodeJoinMemo(a, 'abcdef0123456789', b.publicKey, n));
    for (const m of memos) { expect(len(m)).toBeLessThanOrEqual(MEMO_MAX_BYTES); expect(joinMemoKey(m)).toBe(a.publicKey); }
    expect(new Set(memos.map(len)).size).toBe(1);
  });
  it('padded memos still convert to the router shape', () => {
    const memo = encryptMemo('hi', b.publicKey, a.secretKey);
    const out = routeCryptActions(buildSendMessageActions('alice', 'bob', [memo], [{ actor: 'alice', permission: 'active' }])) as { name: string; data: { copies?: { memo: string }[] } }[];
    expect(out.some(x => x.name === 'sendmsg' && x.data.copies?.[0].memo === memo)).toBe(true);
  });
});
