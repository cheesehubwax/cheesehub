import { describe, expect, it } from 'vitest';
import { expandRouterActions, generateKey, routeCryptActions } from '@/lib/cheeseCrypt';
import { decodeConversations } from '@/lib/cryptGroups';
import { buildJoinRequestActions, collectJoinRequests, decodeRoomEvents, joinMemoKey } from '@/lib/cryptRooms';
import { buildVoiceBatches, voiceNoteCost, voicePartCount, type VoiceClip } from '@/lib/cryptVoice';

const alice = generateKey('alice'), bob = generateKey('bob'), carol = generateKey('carol');
const auth = [{ actor: alice.account, permission: 'active' }];
const roomId = '00112233445566ff';
type RoutedAction = { account: string; name: string; authorization: unknown; data: { quantity?: string; sender?: string; parts?: number; copies?: { to: string; memo: string }[] } };
const routed = (actions: unknown[]) => routeCryptActions(actions) as RoutedAction[];
const history = (actions: RoutedAction[], index = 0) => expandRouterActions(`tx${index}`, 1000 + index, actions.map(act => ({ act })));
const clip = (): VoiceClip => {
  const bytes = new Uint8Array(5000);
  bytes.set([0x1a, 0x45, 0xdf, 0xa3]);
  return { bytes, mime: 'audio/webm;codecs=opus', durationMs: 5000 };
};

describe('live router-compatible join and voice flows', () => {
  it('routes a 0.0101 CHEESE join/rejoin and retains its scoped key without publishing', () => {
    const direct = buildJoinRequestActions(alice, bob.account, bob.publicKey, roomId, auth, 'Please admit me');
    const out = routed(direct);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ account: 'cheeseburger', data: { to: 'crypt.cheese', quantity: '0.0101 CHEESE' } });
    expect(out[1]).toMatchObject({ account: 'crypt.cheese', name: 'sendmsg', authorization: auth, data: { sender: 'alice', parts: 1, copies: [{ to: 'bob', memo: direct[0].data.memo }] } });
    expect(joinMemoKey(out[1].data.copies?.[0].memo ?? '')).toBe(alice.publicKey);
    const rows = history(out);
    const events = decodeRoomEvents(rows, bob, {});
    expect(collectJoinRequests(events, bob.account, new Set([roomId]), { [roomId]: ['bob'] }, [], {})).toEqual([
      { groupId: roomId, from: 'alice', publicKey: alice.publicKey, time: 1000, note: 'Please admit me' },
    ]);
    expect(decodeRoomEvents(rows, alice, { bob: bob.publicKey })[0]?.control).toEqual(events[0]?.control);
  });

  it('routes each voice batch separately at 0.0100 per part plus 0.0001 per recipient', () => {
    const recording = clip();
    const batches = buildVoiceBatches(alice, ['bob'], null, recording, { bob: bob.publicKey }, auth).map(routed);
    expect(batches).toHaveLength(2);
    expect(batches[0][0].data.quantity).toBe('0.3030 CHEESE');
    expect(batches[0][1].data.parts).toBe(30);
    for (const batch of batches) {
      expect(batch).toHaveLength(2);
      expect(batch[1]).toMatchObject({ account: 'crypt.cheese', name: 'sendmsg', authorization: auth });
      expect(batch[0].data.quantity).toBe(voiceNoteCost(batch[1].data.parts ?? 0));
    }
    expect(batches.reduce((sum, batch) => sum + (batch[1].data.parts ?? 0), 0)).toBe(voicePartCount(recording));
    const rows = batches.flatMap(history);
    for (const [key, peers] of [[bob, { alice: alice.publicKey }], [alice, { bob: bob.publicKey }]] as const) {
      const conversation = decodeConversations(rows, key, peers, 2000);
      expect(conversation).toHaveLength(1);
      expect(conversation[0].from).toBe('alice');
      expect(conversation[0].voice?.status).toBe('ready');
      expect(conversation[0].voice?.audio).toEqual(recording.bytes);
    }
    const incomplete = decodeConversations(history(batches[0]), bob, { alice: alice.publicKey }, 10 ** 9);
    expect(incomplete[0].voice?.status).toBe('incomplete');
    expect(incomplete[0].voice?.audio).toBeNull();
  });

  it('shares group voice fees and preserves edit-target parts through router history', () => {
    const recording = clip();
    const target = 'a'.repeat(64);
    const batches = buildVoiceBatches(alice, ['bob', 'carol'], { id: roomId, members: ['alice', 'bob', 'carol'] }, recording,
      { bob: bob.publicKey, carol: carol.publicKey }, auth, 'abcdef', target).map(routed);
    expect(batches[0][0].data.quantity).toBe('0.3060 CHEESE');
    for (const batch of batches) {
      const parts = batch[1].data.parts ?? 0;
      expect(batch[0].data.quantity).toBe(voiceNoteCost(parts, 2));
      expect(batch[1].data.copies).toHaveLength(parts * 2);
    }
    expect(batches.reduce((sum, batch) => sum + (batch[1].data.parts ?? 0), 0)).toBe(voicePartCount(recording) + 1);
    const rows = batches.flatMap(history);
    for (const key of [bob, carol]) {
      const messages = decodeConversations(rows.filter(row => row.to === key.account), key, { alice: alice.publicKey }, 2000);
      expect(messages[0].group?.id).toBe(roomId);
      expect(messages[0].voice?.editTarget).toBe(target);
      expect(messages[0].voice?.audio).toEqual(recording.bytes);
    }
  });
});