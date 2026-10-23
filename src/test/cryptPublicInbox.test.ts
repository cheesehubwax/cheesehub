import { beforeEach, describe, expect, it } from 'vitest';
import { generateKey, encryptMemo, splitMessage, encryptBytesMemo, type ChainMemo } from '@/lib/cheeseCrypt';
import { decodeInboxRequests, declineRequest, inboxCandidates, loadPublicInbox, loadRequestDeclines, savePublicInbox } from '@/lib/cryptPublicInbox';

const alice = generateKey('alice'), bob = generateKey('bob');
const rows = (text: string, time = 100): ChainMemo[] => splitMessage(text).map(m => ({ txId: `tx${time}`, time, from: 'bob', to: 'alice', quantity: '0.0010 CHEESE', memo: encryptMemo(m, alice.publicKey, bob.secretKey) }));
const keys = { bob: bob.publicKey };
beforeEach(() => localStorage.clear());
describe('public inbox rules', () => {
  it('defaults off and isolates saved opt-in by account', () => {
    expect(loadPublicInbox('alice')).toBe(false);
    savePublicInbox('alice', true);
    expect(loadPublicInbox('alice')).toBe(true);
    expect(loadPublicInbox('bob')).toBe(false);
    savePublicInbox('alice', false);
    expect(loadPublicInbox('alice')).toBe(false);
  });
  it('bounds discovery to 10 newest incoming unexcluded accounts', () => {
    const memos = Array.from({ length: 25 }, (_, i) => ({ ...rows('hi')[0], from: `user${'abcde'[Math.floor(i / 5)]}${i % 5 + 1}`, time: i + 1 }));
    memos.push({ ...rows('sent')[0], from: 'alice', to: 'outgoing', time: 100 });
    const candidates = inboxCandidates(memos, 'alice', new Set(['usere5']));
    expect(candidates).toHaveLength(10);
    expect(candidates[0]).toBe('usere4');
    expect(candidates).not.toContain('usere5');
    expect(candidates).not.toContain('outgoing');
  });
  it('requires a published key and complete text or NFT data', () => {
    const text = 'hello '.repeat(80);
    expect(decodeInboxRequests(rows(text), alice, {}, {})).toEqual([]);
    expect(decodeInboxRequests(rows(text).slice(1), alice, keys, {})).toEqual([]);
    expect(decodeInboxRequests(rows(text), alice, keys, {})[0].messages[0].text).toBe(text);
    expect(decodeInboxRequests(rows('[nft:123456]'), alice, keys, {})[0].messages[0].text).toBe('[nft:123456]');
  });
  it('rejects voice bytes, profile notes and group controls', () => {
    const voice = { ...rows('hi')[0], memo: encryptBytesMemo(new Uint8Array([3, 65, 66]), alice.publicKey, bob.secretKey) };
    expect(decodeInboxRequests([voice, ...rows('\u0002CP1:{}'), ...rows('\u0002CG1:{}'), ...rows('\u0002CG2:{}')], alice, keys, {})).toEqual([]);
  });
  it('declines current messages persistently without suppressing newer messages', () => {
    declineRequest('alice', 'bob', 100);
    declineRequest('alice', 'bob', 50);
    expect(loadRequestDeclines('alice')).toEqual({ bob: 100 });
    expect(loadRequestDeclines('carol')).toEqual({});
    expect(decodeInboxRequests(rows('old', 100), alice, keys, loadRequestDeclines('alice'))).toEqual([]);
    expect(decodeInboxRequests(rows('new', 101), alice, keys, loadRequestDeclines('alice'))[0].messages[0].text).toBe('new');
  });
});