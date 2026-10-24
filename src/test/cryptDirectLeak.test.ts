import { describe, expect, it } from 'vitest';
import { encryptMemo, generateKey, splitMessage, type MessagingKey } from '@/lib/cheeseCrypt';
import { decodeConversations, isDirectMessage } from '@/lib/cryptGroups';
import { encodeGroupText } from '@/lib/cryptInviteGroups';

// A group message is delivered pairwise: one encrypted copy per member. The contact key can open
// it, so the decoder must tag it with the group id (`igroup`) and the DM thread must exclude it.
const alice = generateKey('alice'), bob = generateKey('bob'), carol = generateKey('carol');
const ID = '00112233445566ff';

let tx = 0;
/** Every part of `text` as encrypted memos in one transaction. */
const memos = (text: string, from: MessagingKey, to: MessagingKey, time: number) => {
  const txId = `tx${++tx}`;
  return splitMessage(text).map(p => ({ txId, time, from: from.account, to: to.account, quantity: '0.0001 CHEESE', memo: encryptMemo(p, to.publicKey, from.secretKey) }));
};

describe('group messages never leak into direct threads', () => {
  it('tags a pairwise CG2 room message with its group id for both sender and recipient', () => {
    // Alice sends one room message pairwise to bob and carol, encrypted with each member's key.
    const chain = [...memos(encodeGroupText(ID, 'room hello'), alice, bob, 10), ...memos(encodeGroupText(ID, 'room hello'), alice, carol, 10)];
    const bobView = decodeConversations(chain, bob, { alice: alice.publicKey }, 0);
    const bobRoom = bobView.find(c => c.text === 'room hello');
    expect(bobRoom?.igroup).toBe(ID);
    expect(isDirectMessage(bobRoom!, bob.account, alice.account)).toBe(false);

    // The sender sees a copy per recipient; none may appear in a 1-on-1 thread.
    const aliceView = decodeConversations(chain, alice, { bob: bob.publicKey, carol: carol.publicKey }, 0);
    const aliceCopies = aliceView.filter(c => c.text === 'room hello');
    expect(aliceCopies).toHaveLength(2);
    for (const c of aliceCopies) {
      expect(c.igroup).toBe(ID);
      expect(isDirectMessage(c, alice.account, c.to)).toBe(false);
    }
  });

  it('keeps genuine 1-on-1 traffic direct and excludes legacy group envelopes', () => {
    const dm = { key: 'k', txId: 't', time: 1, from: 'alice', to: 'bob', text: 'hi', parts: 1, missing: 0, group: null };
    expect(isDirectMessage(dm, 'alice', 'bob')).toBe(true);
    expect(isDirectMessage({ ...dm, from: 'bob', to: 'alice' }, 'alice', 'bob')).toBe(true);
    expect(isDirectMessage({ ...dm, from: 'alice', to: 'carol' }, 'alice', 'bob')).toBe(false);
    expect(isDirectMessage({ ...dm, igroup: ID }, 'alice', 'bob')).toBe(false);
    expect(isDirectMessage({ ...dm, group: { id: ID, members: ['alice', 'bob', 'carol'] } }, 'alice', 'bob')).toBe(false);
  });
});
