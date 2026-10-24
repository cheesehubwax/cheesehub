import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@wharfkit/session';
import { encryptMemo, generateKey, partCount, saveContact, saveKey } from '@/lib/cheeseCrypt';
import { encodeNotice, encodeAdmission, encodeMemberAdd, loadInvites, saveInvites, type InviteGroup } from '@/lib/cryptInviteGroups';
import { encodeListing, saveRoomRequest } from '@/lib/cryptRooms';
import { Messenger } from '@/pages/CheeseCrypt';

const calls = vi.hoisted(() => ({ fetch: vi.fn(), lookup: vi.fn(), transact: vi.fn(), rooms: vi.fn() }));
vi.mock('@/context/WaxContext', () => ({ useWax: vi.fn() }));
vi.mock('@/hooks/useWaxTransaction', () => ({ useWaxTransaction: () => ({ executeTransaction: calls.transact }) }));
vi.mock('@/lib/cheeseCrypt', async original => ({ ...await original<typeof import('@/lib/cheeseCrypt')>(), fetchMessages: calls.fetch, lookupPublishedKey: calls.lookup, fetchRoomMemos: calls.rooms }));
vi.mock('@/lib/cryptVault', async original => ({ ...await original<typeof import('@/lib/cryptVault')>(), recallVault: async () => null }));

const alice = generateKey('alice'), bob = generateKey('bob'), carol = generateKey('carol');
const ID = '00112233445566ff';
const invite: InviteGroup = { id: ID, name: 'Cheese club', creator: 'alice', created: 1000, members: [alice, bob].map(k => ({ account: k.account, publicKey: k.publicKey })) };
const listing = { txId: 'list', time: 50, from: 'alice', to: 'eosio.null', quantity: '8.0000 CHEESE', memo: encodeListing({ id: ID, name: 'Cheese club', topic: 'All cheese', tags: ['cheese'], publicKey: alice.publicKey, members: 1 }) };
const joinMemo = { txId: 'join', time: 100, from: 'carol', to: 'alice', quantity: '0.0010 CHEESE', memo: encryptMemo(encodeNotice('join', ID), alice.publicKey, carol.secretKey) };
const mount = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Messenger account="alice" session={{ permissionLevel: { actor: 'alice', permission: 'active' } } as unknown as Session} /></QueryClientProvider>);

beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks(); saveKey(alice); saveContact('alice', 'bob', bob.publicKey); saveInvites('alice', { [ID]: invite });
  calls.fetch.mockResolvedValue([joinMemo]); calls.rooms.mockResolvedValue([listing]);
  calls.lookup.mockImplementation(async (a: string) => (a === 'carol' ? carol.publicKey : null));
  calls.transact.mockResolvedValue({ success: true, txId: 'tx' });
});

describe('public rooms', () => {
  it('shows the listed room in search and a stranger\'s join request; accepting pays one updated invite to every member', async () => {
    mount();
    const panel = await screen.findByRole('region', { name: 'Room join requests' });
    expect(within(panel).getByText('Cheese club')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Public rooms' }));
    expect(await screen.findByRole('list', { name: 'Listed rooms' })).toHaveTextContent('Your room');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    fireEvent.click(within(panel).getByRole('button', { name: 'Accept' }));
    const pay = await screen.findByRole('button', { name: 'Pay & invite' });
    expect(pay).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(pay);
    await waitFor(() => expect(calls.transact).toHaveBeenCalledTimes(1));
    const actions = calls.transact.mock.calls[0][0] as { data: { to: string; quantity: string } }[];
    const to = actions.map(a => a.data.to);
    expect(new Set(to.filter(t => t !== 'eosio.null' && t !== 'xcheeseliqst'))).toEqual(new Set(['bob', 'carol']));
    const bootstrapParts = partCount(encodeAdmission({ ...invite, members: [...invite.members, { account: 'carol', publicKey: carol.publicKey }] }));
    const deltaParts = partCount(encodeMemberAdd(invite, { account: 'carol', publicKey: carol.publicKey }));
    expect(to.filter(t => t === 'bob').length).toBe(deltaParts + 1);
    expect(to.filter(t => t === 'carol').length).toBe(bootstrapParts + 2);
    expect(to.filter(t => t === 'eosio.null').length).toBe(bootstrapParts + deltaParts + 2);
    expect(actions.filter(a => a.data.to === 'bob' || a.data.to === 'carol').every(a => a.data.quantity === '0.0001 CHEESE')).toBe(true);
    expect(actions.filter(a => a.data.to === 'eosio.null').every(a => a.data.quantity === '0.0080 CHEESE')).toBe(true);
    await waitFor(() => expect(loadInvites('alice')[ID].members.map(m => m.account)).toEqual(['alice', 'bob', 'carol']));
  });

  it('declining a join request pays one encrypted decline note to the requester and is remembered', async () => {
    const view = mount();
    const panel = await screen.findByRole('region', { name: 'Room join requests' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Decline' }));
    const pay = await screen.findByRole('button', { name: 'Pay & decline' });
    expect(pay).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(pay);
    await waitFor(() => expect(calls.transact).toHaveBeenCalledTimes(1));
    const actions = calls.transact.mock.calls[0][0] as { data: { to: string; quantity: string } }[];
    expect(actions.map(a => [a.data.to, a.data.quantity])).toEqual([['carol', '0.0001 CHEESE'], ['eosio.null', '0.0080 CHEESE'], ['xcheeseliqst', '0.0020 CHEESE']]);
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Room join requests' })).not.toBeInTheDocument());
    const fetchedBeforeRemount = calls.fetch.mock.calls.length;
    view.unmount(); mount();
    await waitFor(() => expect(calls.fetch.mock.calls.length).toBeGreaterThan(fetchedBeforeRemount));
    expect(screen.queryByRole('region', { name: 'Room join requests' })).not.toBeInTheDocument();
  });

  it('the requester sees a pending request in Groups until the owner declines it', async () => {
    localStorage.clear(); saveKey(carol);
    saveRoomRequest('carol', { id: ID, creator: 'alice', publicKey: alice.publicKey, name: 'Cheese club' }, 1000);
    calls.fetch.mockResolvedValue([]);
    const mountCarol = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Messenger account="carol" session={{ permissionLevel: { actor: 'carol', permission: 'active' } } as unknown as Session} /></QueryClientProvider>);
    const first = mountCarol();
    expect(await screen.findByText(/Request pending/)).toBeInTheDocument();
    first.unmount();
    calls.fetch.mockResolvedValue([{ txId: 'no', time: 5000, from: 'alice', to: 'carol', quantity: '0.0001 CHEESE', memo: encryptMemo(encodeNotice('join-no', ID), carol.publicKey, alice.secretKey) }]);
    mountCarol();
    expect(await screen.findByText(/Request declined by alice/)).toBeInTheDocument();
    expect(screen.queryByText(/Request pending/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss declined request' }));
    expect(screen.queryByText(/Request declined/)).not.toBeInTheDocument();
  });

  it('a decline sent before a newer request does not cancel it', async () => {
    localStorage.clear(); saveKey(carol);
    saveRoomRequest('carol', { id: ID, creator: 'alice', publicKey: alice.publicKey, name: 'Cheese club' }, 1_000_000);
    calls.fetch.mockResolvedValue([{ txId: 'no', time: 1000, from: 'alice', to: 'carol', quantity: '0.0001 CHEESE', memo: encryptMemo(encodeNotice('join-no', ID), carol.publicKey, alice.secretKey) }]);
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Messenger account="carol" session={{ permissionLevel: { actor: 'carol', permission: 'active' } } as unknown as Session} /></QueryClientProvider>);
    expect(await screen.findByText(/Request pending/)).toBeInTheDocument();
  });

  it('delivers the ninth-member bootstrap through the stranger path and lets the newcomer join', async () => {
    const members = [alice, bob, ...Array.from({ length: 6 }, (_, i) => generateKey(`peer${String.fromCharCode(97 + i)}`))];
    saveInvites('alice', { [ID]: { ...invite, members: members.map(k => ({ account: k.account, publicKey: k.publicKey })) } });
    const ownerView = mount();
    const panel = await screen.findByRole('region', { name: 'Room join requests' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Accept' }));
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Pay & invite' }));
    await waitFor(() => expect(loadInvites('alice')[ID].members).toHaveLength(9));
    const actions = calls.transact.mock.calls[0][0] as { data: { from: string; to: string; quantity: string; memo: string } }[];
    ownerView.unmount();
    saveKey(carol);
    saveRoomRequest('carol', { id: ID, creator: 'alice', publicKey: alice.publicKey });
    calls.fetch.mockResolvedValue(actions.filter(a => a.data.to === 'carol').map(a => ({ ...a.data, txId: 'admission', time: Date.now() })));
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Messenger account="carol" session={{ permissionLevel: { actor: 'carol', permission: 'active' } } as unknown as Session} /></QueryClientProvider>);
    await waitFor(() => expect(loadInvites('carol')[ID]?.members).toHaveLength(9));
    fireEvent.click(await screen.findByRole('button', { name: /Invited by alice/ }));
    fireEvent.click(await screen.findByRole('button', { name: /^Join$/ }));
    const pay = await screen.findByRole('button', { name: 'Pay & join' });
    expect(pay).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(pay);
    await waitFor(() => expect(calls.transact).toHaveBeenCalledTimes(2));
    expect(await screen.findByPlaceholderText('Message group')).toBeInTheDocument();
  });

  it('lists a room from the unified room settings dialog, warning that the public key becomes visible', async () => {
    calls.rooms.mockResolvedValue([]);
    mount();
    fireEvent.click(await screen.findByRole('button', { name: /1 of 2 joined/ }));
    expect(screen.queryByRole('button', { name: /^Pay & list room/ })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit group' }));
    const settings = await screen.findByRole('dialog', { name: '✏️ Room settings' });
    expect(within(settings).getByText(/public messaging key are published on chain/)).toBeInTheDocument();
    const pay = within(settings).getByRole('button', { name: /^Pay & list room/ });
    expect(pay).toBeDisabled();
    fireEvent.click(within(settings).getByRole('checkbox'));
    fireEvent.click(pay);
    await waitFor(() => expect(calls.transact).toHaveBeenCalledTimes(1));
    const actions = calls.transact.mock.calls[0][0] as { data: { to: string; quantity: string; memo?: string } }[];
    expect(actions.filter(a => a.data.to === 'eosio.null').map(a => a.data.quantity)).toEqual(['8.0000 CHEESE', '0.0080 CHEESE']);
    expect(actions.filter(a => a.data.to === 'xcheeseliqst').map(a => a.data.quantity)).toEqual(['2.0000 CHEESE', '0.0020 CHEESE']);
    expect(actions.find(a => a.data.to === 'eosio.null')?.data.memo?.startsWith('CRYPTROOM1:')).toBe(true);
    await waitFor(() => expect(within(settings).getByText(/This room is listed publicly, so anyone can find it and ask to join/)).toBeInTheDocument());
  });
});
