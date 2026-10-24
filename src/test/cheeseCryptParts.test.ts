import { describe, it, expect } from 'vitest';
import {
  generateKey, encryptMemo, decryptMemo, splitMessage, assembleMessages, buildSendMessageActions, messageCost,
  partCount, MAX_PLAINTEXT_BYTES, MEMO_MAX_BYTES, MAX_PARTS, PART_BODY_BYTES,
} from '@/lib/cheeseCrypt';

const a = generateKey('alice.wam'), b = generateKey('bob.wam');
const roundtrip = (text: string) => {
  const memos = splitMessage(text).map((p) => encryptMemo(p, b.publicKey, a.secretKey));
  memos.forEach((m) => expect(new TextEncoder().encode(m).length).toBeLessThanOrEqual(MEMO_MAX_BYTES));
  const decoded = memos.reverse().map((memo, i) => ({
    txId: 'tx1', time: 1000 + i, from: 'alice.wam', to: 'bob.wam', quantity: '0.0001 CHEESE', memo,
    text: decryptMemo(memo, a.publicKey, b.secretKey),
  }));
  return { memos, msgs: assembleMessages(decoded) };
};

describe('CHEESECrypt multi-part messages', () => {
  it('short messages stay single-part with no header (original format)', () => {
    expect(splitMessage('hello')).toEqual(['hello']);
    expect(splitMessage('x'.repeat(MAX_PLAINTEXT_BYTES))).toHaveLength(1);
  });
  it('a long message reassembles into one message in order', () => {
    const text = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ') + ' 🧀 émoji';
    const { memos, msgs } = roundtrip(text);
    expect(memos.length).toBeGreaterThan(1);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].text).toBe(text);
    expect(msgs[0].parts).toBe(memos.length);
    expect(msgs[0].missing).toBe(0);
  });
  it('never splits a multi-byte character', () => {
    const text = '🧀'.repeat(200);
    expect(roundtrip(text).msgs[0].text).toBe(text);
  });
  it('each part pays 0.0001 CHEESE to recipient and splits 0.0100 CHEESE 80/20 (option A)', () => {
    const actions = buildSendMessageActions('alice.wam', 'bob.wam', ['m1', 'm2', 'm3'], []);
    expect(actions).toHaveLength(9);
    expect(actions.filter((x) => x.data.to === 'bob.wam').map((x) => x.data.quantity)).toEqual(Array(3).fill('0.0001 CHEESE'));
    expect(actions.filter((x) => x.data.to === 'eosio.null').map((x) => x.data.quantity)).toEqual(Array(3).fill('0.0080 CHEESE'));
    expect(actions.filter(x => x.data.to === 'xcheeseliqst').map(x => x.data.quantity)).toEqual(Array(3).fill('0.0020 CHEESE'));
    expect(messageCost(3)).toBe('0.0303 CHEESE');
  });
  it('limits messages to the maximum part count', () => {
    expect(partCount('x'.repeat(PART_BODY_BYTES * MAX_PARTS))).toBe(MAX_PARTS);
    expect(() => splitMessage('x'.repeat(PART_BODY_BYTES * MAX_PARTS + 1))).toThrow();
  });
});
