import { describe, expect, it } from 'vitest';
import nacl from 'tweetnacl';
import { encodeBase64 } from 'tweetnacl-util';
import { encryptMemo } from '@/lib/cheeseCrypt';
import { encodeRoomKeyControl, parseCg2, type Cg2Event, type InviteGroup } from '@/lib/cryptInviteGroups';
import { collectRoomKeys, currentRoomKeys, decodeRoomStream, newRoomKeyBytes, sealRoomText, type RoomKey } from '@/lib/cryptRoomKey';

const pk = () => encodeBase64(nacl.box.keyPair().publicKey);
const room: InviteGroup = { id: 'a'.repeat(16), name: 'Room', creator: 'owner', created: 1, publicRoom: true,
  members: [{ account: 'owner', publicKey: pk() }, { account: 'alice', publicKey: pk() }, { account: 'bob', publicKey: pk() }] };
const invites = { [room.id]: room };
const rk: RoomKey = { room: room.id, epoch: 1, key: newRoomKeyBytes(), since: 100 };
const row = (from: string, memo: string, txId = 't1', time = 200) => ({ txId, time, from, to: 'eosio.null', memo, quantity: '' });
const ctl = (from: string, to: string, time: number, control = parseCg2(encodeRoomKeyControl(room.id, 1, rk.key))!): Cg2Event =>
  ({ key: `${from}${to}${time}`, txId: 'k', time, from, to, control, usedKey: room.members.find(m => m.account === (from === 'alice' ? to : from))!.publicKey });

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
  it('only the owner can deliver a key; newest epoch is current', () => {
    expect(collectRoomKeys([ctl('bob', 'alice', 10)], invites, 'alice')).toHaveLength(0);
    const two = parseCg2(encodeRoomKeyControl(room.id, 2, newRoomKeyBytes()))!;
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
