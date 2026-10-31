import { saveKey } from './cryptLockedFixture';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@wharfkit/session';
import { encryptMemo, generateKey, loadContacts, saveContact } from '@/lib/cheeseCrypt';
import { buildCg2Actions, encodeAdmission, encodeGroupText, encodeNotice, encodePolicySnapshot, loadInvites, type InviteGroup } from '@/lib/cryptInviteGroups';
import { encodeJoinMemo, encodeListing } from '@/lib/cryptRooms';
import { Messenger } from '@/pages/CheeseCrypt';

const calls = vi.hoisted(() => ({ fetch: vi.fn(), lookup: vi.fn(), rooms: vi.fn(), transact: vi.fn() }));
vi.mock('@/context/WaxContext', () => ({ useWax: vi.fn() }));
vi.mock('@/hooks/useWaxTransaction', () => ({ useWaxTransaction: () => ({ executeTransaction: calls.transact }) }));
vi.mock('@/lib/cheeseCrypt', async original => ({ ...await original<typeof import('@/lib/cheeseCrypt')>(), fetchMessages: calls.fetch, lookupPublishedKey: calls.lookup, fetchRoomMemos: calls.rooms }));
vi.mock('@/lib/cryptVault', async original => ({ ...await original<typeof import('@/lib/cryptVault')>(), recallVault: async () => null }));
const owner = generateKey('alice'), me = generateKey('bob'), friend = generateKey('carol');
const id = '00112233445566ff';
const group: InviteGroup = { id, creator: 'alice', created: 1, name: 'Recovery club', publicRoom: true, members: [owner, me].map(k => ({ account: k.account, publicKey: k.publicKey })) };
const memo = (from: string, to: string, text: string, time: number, sender = me, recipient = owner) => ({ from, to, time, txId: `tx${time}`, quantity: '0.0001 CHEESE', memo: encryptMemo(text, recipient.publicKey, sender.secretKey) });
const admission = [...buildCg2Actions(owner, ['bob'], { bob: me.publicKey }, encodeAdmission(group), []),
  ...buildCg2Actions(owner, ['bob'], { bob: me.publicKey }, encodePolicySnapshot(id, ['alice'], [], [], []), [])]
  .filter(a => a.data.to === 'bob').map(a => ({ ...a.data, time: 20, txId: 'admit' }));
const history = [
  { ...memo('bob', 'alice', 'unused', 10), memo: encodeJoinMemo(me, id, owner.publicKey) }, ...admission,
  memo('bob', 'alice', encodeNotice('joined', id), 30),
  memo('alice', 'bob', encodeGroupText(id, 'Room restored'), 40, owner, me),
  memo('bob', 'carol', 'Private hello', 50, me, friend),
];
const mount = (account = 'bob') => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
  <Messenger account={account} session={{ actor: account, walletPlugin: { id: 'anchor' }, permissionLevel: { actor: account, permission: 'active' } } as unknown as Session} />
</QueryClientProvider>);

beforeEach(async () => {
  localStorage.clear(); vi.clearAllMocks(); await saveKey(me);
  calls.fetch.mockResolvedValue(history);
  calls.lookup.mockImplementation(async (a: string) => a === 'carol' ? friend.publicKey : null);
  calls.rooms.mockResolvedValue([{ from: 'alice', to: 'eosio.null', time: 1, txId: 'list', quantity: '80.0000 CHEESE', memo: encodeListing({ id, name: group.name, topic: '', tags: [], publicKey: owner.publicKey, members: 2 }) }]);
});

describe('recovery through the messenger', () => {
  it('recovers rooms and prior friends from an empty cache and retains them through account switching', async () => {
    const first = mount();
    const room = await screen.findByRole('button', { name: /Recovery club.*2 of 2 joined/ });
    fireEvent.click(room);
    expect(await screen.findByText('Room restored')).toBeInTheDocument();
    await waitFor(() => expect(loadContacts('bob')).toEqual({ carol: friend.publicKey }));
    expect(loadInvites('bob')[id]?.members).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /^carol/ }));
    expect(await screen.findByText('Private hello')).toBeInTheDocument();
    expect(screen.queryByText('Room restored')).not.toBeInTheDocument();
    first.unmount(); await saveKey(friend);
    const other = mount('carol');
    expect(screen.queryByRole('button', { name: /Recovery club/ })).not.toBeInTheDocument();
    other.unmount(); mount();
    fireEvent.click(await screen.findByRole('button', { name: /Recovery club/ }));
    expect(await screen.findByText('Room restored')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^carol/ })).toBeInTheDocument();
    expect(calls.transact).not.toHaveBeenCalled();
  });
  it('synchronizes another tab’s friend addition and removal without account leakage', async () => {
    calls.fetch.mockResolvedValue([]); calls.rooms.mockResolvedValue([]);
    mount();
    saveContact('bob', 'carol', friend.publicKey);
    fireEvent(window, new StorageEvent('storage', { key: 'cheesecrypt-contacts-bob', storageArea: localStorage }));
    expect(await screen.findByRole('button', { name: 'Remove friend carol' })).toBeInTheDocument();
    localStorage.setItem('cheesecrypt-contacts-bob', '{}');
    fireEvent(window, new StorageEvent('storage', { key: 'cheesecrypt-contacts-bob', storageArea: localStorage }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Remove friend carol' })).not.toBeInTheDocument());
    saveContact('alice', 'carol', friend.publicKey);
    fireEvent(window, new StorageEvent('storage', { key: 'cheesecrypt-contacts-alice', storageArea: localStorage }));
    expect(screen.queryByRole('button', { name: 'Remove friend carol' })).not.toBeInTheDocument();
  });
});