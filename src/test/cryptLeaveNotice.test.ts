import { describe, it, expect } from 'vitest';
import { ownerLeaveNotices, type Cg2Event, type InviteGroup } from '@/lib/cryptInviteGroups';

const g = { id: 'g1', creator: 'owner', name: 'r', members: [{ account: 'owner', publicKey: 'K1' }, { account: 'bob', publicKey: 'K2' }, { account: 'amy', publicKey: 'K3' }] } as unknown as InviteGroup;
const ev = (from: string, to: string, t = 5): Cg2Event => ({ key: `${from}${to}${t}`, txId: `tx${from}${t}`, time: t, from, to, usedKey: ({ owner: 'K1', bob: 'K2', amy: 'K3', eve: 'K9' } as Record<string,string>)[from], control: { kind: 'leave', id: 'g1' } as never });

describe('owner leave notices', () => {
  it('shows a leave to the owner', () => {
    expect(ownerLeaveNotices([ev('bob', 'owner')], { g1: g }, 'g1', 'owner').map(n => n.from)).toEqual(['bob']);
  });
  it('hides leaves from non-owners', () => {
    expect(ownerLeaveNotices([ev('bob', 'amy')], { g1: g }, 'g1', 'amy')).toEqual([]);
  });
  it('ignores non-members', () => {
    expect(ownerLeaveNotices([ev('eve', 'owner')], { g1: g }, 'g1', 'owner')).toEqual([]);
  });
});
