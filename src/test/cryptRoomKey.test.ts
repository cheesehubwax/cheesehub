import { describe, expect, it, vi } from 'vitest';
import nacl from 'tweetnacl';
import { encodeBase64 } from 'tweetnacl-util';
import { encryptMemo } from '@/lib/cheeseCrypt';
import { encodeRoomKeyControl, encodeRoomKeyOff, parseCg2, type Cg2, type Cg2Event, type InviteGroup } from '@/lib/cryptInviteGroups';
import { collectRoomKeys, collectRoomKeyOffs, currentRoomKeys, decodeRoomStream, latestRoomKeyEpoch, newRoomKeyBytes, ownedRoomKeys, sealRoomText, type RoomKey } from '@/lib/cryptRoomKey';

const pk = () => encodeBase64(nacl.box.keyPair().publicKey);
const room: InviteGroup = { id: 'a'.repeat(16), name: 'Room', creator: 'owner', created: 1, publicRoom: true,
  members: [{ account: 'owner', publicKey: pk() }, { account: 'alice', publicKey: pk() }, { account: 'bob', publicKey: pk() }] };
const invites = { [room.id]: room };
const rk: RoomKey = { room: room.id, epoch: 1, key: newRoomKeyBytes(), since: 100 };
const row = (from: string, memo: string, txId = 't1', time = 200) => ({ txId, time, from, to: 'eosio.null', memo, quantity: '' });
const parsed = (text: string): Cg2 => {
  const control = parseCg2(text);
  if (!control) throw new Error('Invalid test control');
  return control;
};
const ctl = (from: string, to: string, time: number, control = parsed(encodeRoomKeyControl(room.id, 1, rk.key)), me = 'alice'): Cg2Event => {
  const member = room.members.find(m => m.account === (from === me ? to : from));
  if (!member) throw new Error('Missing test member');
  return { key: `${from}${to}${time}`, txId: 'k', time, from, to, control, usedKey: member.publicKey };
};

describe('shared room key', () => {
  it('memos have the same length as an ordinary padded message', () => {
    const k = nacl.box.keyPair();
    const normal = encryptMemo('hi', encodeBase64(k.publicKey), encodeBase64(k.secretKey));
    const [stealth] = sealRoomText(rk, 'bob', 'hi');
    expect(stealth.startsWith('CRYPT2:')).toBe(true);
    expect(stealth.length).toBe(normal.length);
    expect(stealth).not.toContain(room.id);
  });
  it('members read a message from its chain sender', () => {
    const events = decodeRoomStream(sealRoomText(rk, 'bob', 'hello room').map(m => row('bob', m)), [rk], invites, 'alice');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ from: 'bob', to: 'alice', igroup: room.id, text: 'hello room', control: { kind: 'msg', text: 'hello room' } });
  });
  it('a member cannot post as another member', () => {
    const forged = sealRoomText(rk, 'owner', 'fake').map(m => row('bob', m));
    expect(decodeRoomStream(forged, [rk], invites, 'alice')).toHaveLength(0);
  });
  it('a wrong key, a non-member or a pre-delivery copy is ignored', () => {
    const other = { ...rk, key: newRoomKeyBytes() };
    const memos = sealRoomText(rk, 'bob', 'x');
    expect(decodeRoomStream(memos.map(m => row('bob', m)), [other], invites, 'alice')).toHaveLength(0);
    expect(decodeRoomStream(sealRoomText(rk, 'mallory', 'x').map(m => row('mallory', m)), [rk], invites, 'alice')).toHaveLength(0);
    expect(decodeRoomStream(memos.map(m => row('bob', m, 't', 50)), [rk], invites, 'alice')).toHaveLength(0);
  });
  it('long messages split into parts and reassemble', () => {
    const text = 'z'.repeat(600);
    const memos = sealRoomText(rk, 'bob', text);
    expect(memos.length).toBeGreaterThan(1);
    expect(decodeRoomStream(memos.map(m => row('bob', m)), [rk], invites, 'alice')[0].control).toMatchObject({ text });
  });
  it('derives only one subkey per sender for a busy stream and rechecks each decode', () => {
    const rows = Array.from({ length: 120 }, (_, i) => {
      const sender = i % 2 ? 'bob' : 'owner';
      return sealRoomText(rk, sender, `message ${i}`).map(m => row(sender, m, `tx${i}`));
    }).flat();
    const hash = vi.spyOn(nacl, 'hash');
    try {
      const entries = decodeRoomStream(rows, [rk], invites, 'alice');
      expect(entries).toHaveLength(120);
      expect(entries[119].text).toBe('message 119');
      expect(hash).toHaveBeenCalledTimes(2);
      hash.mockClear();
      expect(decodeRoomStream(rows, [{ ...rk, key: newRoomKeyBytes() }], invites, 'alice')).toHaveLength(0);
      expect(hash).toHaveBeenCalledTimes(2);
    } finally { hash.mockRestore(); }
  });
  it('a malformed held key does not prevent opening with another held key', () => {
    const rows = sealRoomText(rk, 'bob', 'still readable').map(m => row('bob', m));
    expect(decodeRoomStream(rows, [{ ...rk, key: '?' }, rk], invites, 'alice')[0]?.text).toBe('still readable');
  });
  it('only the owner can deliver a key; newest epoch is current', () => {
    expect(collectRoomKeys([ctl('bob', 'alice', 10)], invites, 'alice')).toHaveLength(0);
    const two = parsed(encodeRoomKeyControl(room.id, 2, newRoomKeyBytes()));
    const keys = collectRoomKeys([ctl('owner', 'alice', 10), ctl('owner', 'alice', 20, two)], invites, 'alice');
    expect(keys).toHaveLength(2);
    expect(currentRoomKeys(keys)[room.id].epoch).toBe(2);
  });
  it('rekey cut-off: a removed member without the new key cannot read new messages', () => {
    const next = { ...rk, epoch: 2, key: newRoomKeyBytes(), since: 300 };
    const rows = sealRoomText(next, 'owner', 'after').map(m => row('owner', m, 't2', 400));
    expect(decodeRoomStream(rows, [rk], invites, 'bob')).toHaveLength(0);
    expect(decodeRoomStream(rows, [rk, next], invites, 'alice')).toHaveLength(1);
  });
  it('owner off restores pairwise state without losing historical room messages', () => {
    const events = [ctl('owner', 'alice', 100), ctl('owner', 'alice', 300, parsed(encodeRoomKeyOff(room.id, 2)))];
    const keys = collectRoomKeys(events, invites, 'alice');
    expect(currentRoomKeys(keys, collectRoomKeyOffs(events, invites, 'alice'))[room.id]).toBeUndefined();
    expect(decodeRoomStream(sealRoomText(rk, 'bob', 'before off').map(m => row('bob', m)), keys, invites, 'alice')[0]?.text).toBe('before off');
    expect(keys).toHaveLength(1);
  });
  it('only roster-authenticated owner off controls count', () => {
    const off = parsed(encodeRoomKeyOff(room.id, 2));
    const valid = ctl('owner', 'alice', 300, off);
    expect(collectRoomKeyOffs([ctl('bob', 'alice', 300, off), { ...valid, usedKey: pk() }, { ...valid, to: 'bob' }], invites, 'alice')).toEqual([]);
    expect(collectRoomKeyOffs([valid], invites, 'alice')).toEqual([{ room: room.id, epoch: 2 }]);
  });
  it('owner derives off state from its authenticated outgoing history too', () => {
    const events = [ctl('owner', 'alice', 100, parsed(encodeRoomKeyControl(room.id, 1, rk.key)), 'owner'), ctl('owner', 'alice', 300, parsed(encodeRoomKeyOff(room.id, 2)), 'owner')];
    expect(ownedRoomKeys(events, invites, 'owner')).toHaveLength(1);
    expect(currentRoomKeys(ownedRoomKeys(events, invites, 'owner'), collectRoomKeyOffs(events, invites, 'owner'))).toEqual({});
  });
  it('re-enabling advances past off epochs and ignores stale off replays', () => {
    const offs = [{ room: room.id, epoch: 2 }];
    expect(latestRoomKeyEpoch(room.id, [rk], offs) + 1).toBe(3);
    const next = { ...rk, epoch: 3, key: newRoomKeyBytes(), since: 400 };
    expect(currentRoomKeys([rk, next], offs)[room.id]).toEqual(next);
    expect(currentRoomKeys([rk], [{ room: room.id, epoch: 1 }])).toEqual({});
  });
  it('rejects malformed off epochs and never accepts a key in an off notice', () => {
    for (const epoch of [0, -1, 1.5, 1_000_001]) {
      expect(() => encodeRoomKeyOff(room.id, epoch)).toThrow();
      expect(parseCg2(`\u0002CG2:roomkey-off:${JSON.stringify({ i: room.id, e: epoch })}`)).toBeNull();
    }
    expect(parseCg2(`\u0002CG2:roomkey-off:${JSON.stringify({ i: room.id, e: 2, k: rk.key })}`)).toBeNull();
  });
});

describe('shared room key routing', () => {
  it('one eosio.null copy routes through sendmsg as a normal one-part message', async () => {
    const { buildSendMessageActions, routeCryptActions } = await import('@/lib/cheeseCrypt');
    const memos = sealRoomText(rk, 'bob', 'hi');
    const routed = routeCryptActions(buildSendMessageActions('bob', 'eosio.null', memos, [{ actor: 'bob', permission: 'active' }]), { payfee: true }) as any[];
    expect(routed.map(a => a.name)).toEqual(['transfer', 'sendmsg']);
    expect(routed[0].data.quantity).toBe('0.0101 CHEESE');
    expect(routed[1].data).toEqual({ sender: 'bob', parts: 1, copies: [{ to: 'eosio.null', memo: memos[0] }] });
  });
});
