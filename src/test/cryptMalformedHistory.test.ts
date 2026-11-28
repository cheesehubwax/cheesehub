import { describe, expect, it } from 'vitest';
import { encryptMemo, generateKey, mergeMemos, type ChainMemo } from '@/lib/cheeseCrypt';
import { decodeConversations } from '@/lib/cryptGroups';
import { latestProfiles, parseProfileNote, PROFILE_PREFIX } from '@/lib/cryptProfileNotes';
import { baselineMarks, firstUnreadIndex, unreadCounts, unreadReplies } from '@/lib/cryptUnread';
import { isCg2, parseCg2 } from '@/lib/cryptInviteGroups';

const alice = generateKey('alice'), bob = generateKey('bob');
const row: ChainMemo = { txId: 'valid', time: 100, from: 'bob', to: 'alice', quantity: '0.0000 CHEESE', memo: encryptMemo('valid message', alice.publicKey, bob.secretKey) };
const badRows = [null, undefined, {}, { ...row, time: NaN }, { ...row, time: Infinity }, { ...row, memo: 42 }, { ...row, from: null }];

describe('malformed history remains local', () => {
  it('drops invalid incoming and cached memos without replacing a valid row or its identity', () => {
    const merged = mergeMemos([row, ...badRows] as ChainMemo[], [...badRows, row] as ChainMemo[]);
    expect(merged).toEqual([row]);
    expect(merged[0]).toBe(row);
    expect(mergeMemos(merged, [row])).toBe(merged);
  });
  it('decodes the valid encrypted memo beside malformed rows', () => {
    const decoded = decodeConversations([...badRows, row] as ChainMemo[], alice, { bob: bob.publicKey });
    expect(decoded.map(m => m.text)).toEqual(['valid message']);
  });
  it('rejects non-string legacy control text without invoking string methods', () => {
    for (const value of [42, {}, [], true]) {
      expect(isCg2(value as string)).toBe(false);
      expect(parseCg2(value as string)).toBeNull();
      expect(parseProfileNote(value as string)).toBeNull();
    }
    expect(parseProfileNote(PROFILE_PREFIX + '{')).toBeNull();
  });
  it('skips broken profile entries and non-finite times while retaining a complete valid note', () => {
    const note = PROFILE_PREFIX + JSON.stringify({ displayName: 'Bob', avatar: { version: 1, pixels: '0'.repeat(64) } });
    const valid = { from: 'bob', time: 100, text: note, missing: 0 };
    const entries = [null, {}, { ...valid, time: Infinity }, { ...valid, missing: 1 }, valid] as Parameters<typeof latestProfiles>[0];
    expect(latestProfiles(entries, 'alice').bob?.time).toBe(100);
  });
  it('keeps invalid timestamps and malformed rows out of read markers and reply counts', () => {
    const valid = { from: 'bob', to: 'alice', time: 100, group: null, text: 'hello' };
    const rows = [null, {}, { ...valid, time: NaN }, { ...valid, time: Infinity }, { ...valid, text: {} }, valid] as Parameters<typeof unreadCounts>[0];
    expect(baselineMarks(rows, 'alice')).toEqual({ bob: 100 });
    expect(unreadCounts(rows, 'alice', {})).toEqual({ bob: 1 });
    expect(unreadReplies(rows, 'alice', {})).toEqual({});
    expect(firstUnreadIndex([null, { time: Infinity }, { time: 100 }] as { time: number }[], 1)).toBe(2);
  });
});