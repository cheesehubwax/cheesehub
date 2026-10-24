import { describe, expect, it } from 'vitest';
import { applyEdits, canEdit, editTarget, encodeEdit, publicEditLog, EDIT_WINDOW_MS, EDIT_LOG_MS } from '@/lib/cryptEdits';
import { decodeConversations, groupPayload, type ConversationEntry } from '@/lib/cryptGroups';
import { encryptMemo, generateKey, splitMessage, encryptBytesMemo } from '@/lib/cheeseCrypt';
import { splitVoice } from '@/lib/cryptVoice';
import { encodeGroupText } from '@/lib/cryptInviteGroups';

const base: ConversationEntry = { key: 'root', txId: 'original', time: 1000, from: 'alice', to: 'bob', text: 'hello', parts: 1, missing: 0, group: null };
const edit = (root = base, time = 2000, text = 'updated'): ConversationEntry => ({ ...root, key: 'edit', txId: 'edit', time, text: encodeEdit(editTarget(root), text) });
describe('message editing rules', () => {
  it('allows only the sender up to exactly 24 hours from the original', () => {
    expect(EDIT_WINDOW_MS).toBe(24 * 60 * 60 * 1000);
    expect(canEdit(base, 'alice', 1000 + 24 * 60 * 60 * 1000)).toBe(true);
    expect(canEdit(base, 'alice', 1001 + 24 * 60 * 60 * 1000)).toBe(false);
    expect(canEdit(base, 'bob', 2000)).toBe(false);
  });
  it('validates chain time and repeated edits never extend the deadline', () => {
    const projected = applyEdits([base, edit(base, 2000), { ...edit(base, base.time + EDIT_WINDOW_MS + 1, 'too late'), txId: 'later' }]);
    expect(projected.messages).toHaveLength(1);
    expect(projected.messages[0]).toMatchObject({ key: 'root', time: 1000, text: 'updated' });
    expect(projected.log).toHaveLength(1);
  });
  it('rejects forged senders, cross-conversation references, missing parts and unresolved edits', () => {
    for (const invalid of [{ ...edit(), from: 'carol' }, { ...edit(), to: 'carol' }, { ...edit(), igroup: '0123456789abcdef' }, { ...edit(), missing: 1 }]) {
      expect(applyEdits([base, invalid]).messages[0].text).toBe('hello');
    }
    expect(applyEdits([edit()]).messages).toEqual([]);
  });
  it('resolves multiple contents in one transaction without using author/time alone', () => {
    const second = { ...base, key: 'second', text: 'other message' };
    const result = applyEdits([base, second, edit(second)]);
    expect(result.messages.map(m => m.text)).toEqual(['hello', 'updated']);
  });
  it('refuses ambiguous identical originals instead of choosing one', () => {
    expect(applyEdits([base, { ...base, key: 'duplicate' }, edit()]).messages.map(m => m.text)).toEqual(['hello', 'hello']);
  });
  it('shows only public room owners a 72-hour log, including the exact boundary', () => {
    const root = { ...base, igroup: '0123456789abcdef' };
    const { log } = applyEdits([root, edit(root)]);
    expect(EDIT_LOG_MS).toBe(72 * 60 * 60 * 1000);
    expect(publicEditLog(log, root.igroup, 'bob', 'bob', true, 2000 + 72 * 60 * 60 * 1000)).toHaveLength(1);
    expect(publicEditLog(log, root.igroup, 'bob', 'bob', true, 2001 + 72 * 60 * 60 * 1000)).toHaveLength(0);
    expect(publicEditLog(log, root.igroup, 'bob', 'alice', true, 2000)).toHaveLength(0);
    expect(publicEditLog(log, root.igroup, 'bob', 'bob', false, 2000)).toHaveLength(0);
    expect(publicEditLog(applyEdits([base, edit()]).log, root.igroup, 'bob', 'bob', true, 2000)).toHaveLength(0);
  });
  it.each(['dm', 'cg1', 'cg2'])('decrypts NFT replacement in %s and retains the original row position', kind => {
    const alice = generateKey('alice'), bob = generateKey('bob');
    const group = { id: '0123456789abcdef', members: ['alice', 'bob', 'carol'] };
    const wrap = (text: string) => kind === 'cg1' ? groupPayload(group, text) : kind === 'cg2' ? encodeGroupText(group.id, text) : text;
    const memos = (text: string, txId: string, time: number) => splitMessage(wrap(text)).map(p => ({ from: 'alice', to: 'bob', txId, time, quantity: '0.0010 CHEESE', memo: encryptMemo(p, bob.publicKey, alice.secretKey) }));
    const raw = memos('hello', 'original', 1000);
    const root = decodeConversations(raw, bob, { alice: alice.publicKey })[0];
    const result = applyEdits(decodeConversations([...raw, ...memos(encodeEdit(editTarget(root), '[nft:123]'), 'edit', 2000)], bob, { alice: alice.publicKey }));
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]).toMatchObject({ key: root.key, time: 1000, text: '[nft:123]', editedAt: 2000 });
  });
  it.each(['dm', 'cg1', 'cg2'])('assembles voice edits in %s only when complete and verified', kind => {
    const alice = generateKey('alice'), bob = generateKey('bob');
    const group = kind === 'dm' ? null : { id: kind === 'cg2' ? 'i0123456789abcdef' : '0123456789abcdef', members: kind === 'cg2' ? ['-'] : ['alice', 'bob', 'carol'] };
    const clip = { bytes: new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, ...Array(300).fill(1)]), mime: 'audio/webm;codecs=opus' as const, durationMs: 1000 };
    const memos = (id: string, time: number, target?: string) => splitVoice(clip, group, id, target).map(p => ({ from: 'alice', to: 'bob', time, txId: id, quantity: '0.0010 CHEESE', memo: encryptBytesMemo(p, bob.publicKey, alice.secretKey) }));
    const raw = memos('root00', 1000), root = decodeConversations(raw, bob, { alice: alice.publicKey })[0];
    const changed = memos('edit00', 2000, editTarget(root));
    const complete = applyEdits(decodeConversations([...raw, ...changed], bob, { alice: alice.publicKey }));
    expect(complete.messages).toHaveLength(1);
    expect(complete.messages[0].editedAt).toBe(2000);
    expect(complete.messages[0].voice?.status).toBe('ready');
    const partial = applyEdits(decodeConversations([...raw, ...changed.slice(0, -1)], bob, { alice: alice.publicKey }));
    expect(partial.messages).toHaveLength(1);
    expect(partial.messages[0].editedAt).toBeUndefined();
  });
});