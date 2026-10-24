import { describe, expect, it } from 'vitest';
import { generateKey } from '@/lib/cheeseCrypt';
import { encodeAdmin, encodeModeration, encodeReport, encodeRoomPolicy, parseCg2, type Cg2Event, type InviteGroup } from '@/lib/cryptInviteGroups';
import { collectReports, deriveModeration } from '@/lib/cryptModeration';

const keys = Object.fromEntries(['alice', 'bob', 'carol', 'dave', 'erin'].map(a => [a, generateKey(a)]));
const id = '0123456789abcdef';
const target = 'ab'.repeat(32);
// alice owns; dave becomes an admin; carol and erin are regular members.
const g: InviteGroup = { id, name: 'room', created: 1, creator: 'alice', members: Object.values(keys).map(k => ({ account: k.account, publicKey: k.publicKey })) };
const ev = (payload: string, time: number, from: string, to: string): Cg2Event => {
  const control = parseCg2(payload);
  if (!control) throw new Error('bad control');
  return { key: `${time}${from}${to}`, txId: `${time}`, time, from, to, usedKey: keys[from].publicKey, control };
};
const base = [ev(encodeRoomPolicy(id, true, ['alice', 'bob']), 1000, 'alice', 'bob'), ev(encodeAdmin(id, 'dave', true), 1500, 'alice', 'bob')];
const moderationWith = (...extra: Cg2Event[]) => deriveModeration([...base, ...extra], { [id]: g }, 'bob');
const reports = (me: string, events: Cg2Event[], mod = moderationWith()) => collectReports(events, { [id]: g }, mod, me);

describe('message reports', () => {
  it('a regular member report reaches the owner and admins', () => {
    const toOwner = ev(encodeReport(id, 'erin', target, 'admin'), 2000, 'carol', 'alice');
    const toAdmin = ev(encodeReport(id, 'erin', target, 'admin'), 2000, 'carol', 'dave');
    expect(reports('alice', [toOwner])).toHaveLength(1);
    expect(reports('dave', [toAdmin])).toHaveLength(1);
  });
  it('a regular member cannot send an owner-level ban report', () => {
    expect(reports('alice', [ev(encodeReport(id, 'erin', target, 'owner'), 2000, 'carol', 'alice')])).toHaveLength(0);
  });
  it('an admin report goes to the owner for a ban, never to other admins', () => {
    expect(reports('alice', [ev(encodeReport(id, 'erin', target, 'owner'), 2000, 'dave', 'alice')])[0].level).toBe('owner');
    expect(reports('carol', [ev(encodeReport(id, 'erin', target, 'owner'), 2000, 'dave', 'carol')])).toHaveLength(0);
  });
  it('regular members do not see member reports', () => {
    expect(reports('erin', [ev(encodeReport(id, 'bob', target, 'admin'), 2000, 'carol', 'erin')])).toHaveLength(0);
  });
  it('owner messages cannot be reported', () => {
    expect(reports('dave', [ev(encodeReport(id, 'alice', target, 'admin'), 2000, 'carol', 'dave')])).toHaveLength(0);
  });
  it('reports sent while muted are ignored', () => {
    const mod = moderationWith(ev(encodeModeration(id, 'carol', 15), 1800, 'alice', 'bob'));
    expect(reports('alice', [ev(encodeReport(id, 'erin', target, 'admin'), 2000, 'carol', 'alice')], mod)).toHaveLength(0);
  });
});
