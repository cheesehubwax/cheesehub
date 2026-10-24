import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@wharfkit/session';
import { decodeConversations } from '@/lib/cryptGroups';
import { encryptMemo, generateKey, saveContact, saveKey, splitMessage } from '@/lib/cheeseCrypt';
import { encodeGroupText, saveInvites } from '@/lib/cryptInviteGroups';
import { encodeListing } from '@/lib/cryptRooms';
import { editTarget, encodeEdit } from '@/lib/cryptEdits';
import { Messenger } from '@/pages/CheeseCrypt';

const calls = vi.hoisted(() => ({ fetch: vi.fn(), rooms: vi.fn(), transact: vi.fn() }));
vi.mock('@/context/WaxContext', () => ({ useWax: vi.fn() }));
vi.mock('@/hooks/useWaxTransaction', () => ({ useWaxTransaction: () => ({ executeTransaction: calls.transact }) }));
vi.mock('@/lib/cheeseCrypt', async original => ({ ...await original<typeof import('@/lib/cheeseCrypt')>(), fetchMessages: calls.fetch, fetchRoomMemos: calls.rooms, lookupPublishedKey: async () => null }));
vi.mock('@/lib/cryptVault', async original => ({ ...await original<typeof import('@/lib/cryptVault')>(), recallVault: async () => null }));
const alice = generateKey('alice'), bob = generateKey('bob');
const ID = '0123456789abcdef';
const sentAt = Date.now() - 60_000;
const history = (text: string, txId: string, time: number, group = false) => splitMessage(group ? encodeGroupText(ID, text) : text).map(p => ({ from: 'alice', to: 'bob', time, txId, quantity: '0.0010 CHEESE', memo: encryptMemo(p, bob.publicKey, alice.secretKey) }));
const mount = (account = 'alice') => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Messenger account={account} session={{ permissionLevel: { actor: account, permission: 'active' } } as unknown as Session} /></QueryClientProvider>);
beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks(); saveKey(alice); saveContact('alice', 'bob', bob.publicKey);
  calls.rooms.mockResolvedValue([]); calls.fetch.mockResolvedValue(history('original text', 'root', sentAt));
  calls.transact.mockResolvedValue({ success: true, txId: 'new-edit' });
});
describe('message edit flow', () => {
  it('opens Edit, pays only with Terms, and reads the confirmed replacement back in the same row', async () => {
    mount(); fireEvent.click(screen.getByRole('button', { name: /^bob/ }));
    const original = await screen.findByText('original text');
    fireEvent.contextMenu(original);
    fireEvent.click(await screen.findByRole('menuitem', { name: '✏️ Edit' }));
    const input = screen.getByPlaceholderText('Message bob');
    expect(input).toHaveValue('original text');
    fireEvent.change(input, { target: { value: 'corrected text' } });
    const save = screen.getByRole('button', { name: 'Save edit' }); expect(save).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(save);
    await waitFor(() => expect(calls.transact).toHaveBeenCalledTimes(1));
    const actions = calls.transact.mock.calls[0][0] as { data: { from: string; to: string; memo: string; quantity: string } }[];
    expect(actions.filter(a => a.data.to === 'eosio.null').every(a => a.data.quantity === '0.0080 CHEESE')).toBe(true);
    const confirmed = actions.filter(a => a.data.to === 'bob').map(a => ({ ...a.data, txId: 'new-edit', time: sentAt + 1000 }));
    calls.fetch.mockResolvedValue([...history('original text', 'root', sentAt), ...confirmed]);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' })); fireEvent.click(await screen.findByRole('button', { name: 'Refresh messages' }));
    await screen.findByText('corrected text');
    expect(screen.queryByText('original text')).not.toBeInTheDocument();
    expect(screen.getByText('(edited)')).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Chat messages' })).getAllByText(/you · alice/)).toHaveLength(1);
  });
  it.each([true, false])('only exposes the owner log when the group is public=%s', async listed => {
    saveInvites('alice', { [ID]: { id: ID, name: 'Test room', creator: 'alice', created: sentAt - 1000, members: [alice, bob].map(k => ({ account: k.account, publicKey: k.publicKey })) } });
    const raw = history('old public text', 'root', sentAt, true);
    const root = decodeConversations(raw, alice, { bob: bob.publicKey })[0];
    calls.fetch.mockResolvedValue([...raw, ...history(encodeEdit(editTarget(root), 'new public text'), 'edit', sentAt + 1000, true)]);
    if (listed) calls.rooms.mockResolvedValue([{ from: 'alice', to: 'eosio.null', txId: 'list', time: sentAt - 500, quantity: '0.0080 CHEESE', memo: encodeListing({ id: ID, name: 'Test room', topic: '', tags: [], publicKey: alice.publicKey, members: 1 }) }]);
    mount(); fireEvent.click(await screen.findByRole('button', { name: /Test room/ }));
    await screen.findByText('new public text');
    fireEvent.click(screen.getByRole('button', { name: 'Edit group' }));
    const dialog = await screen.findByRole('dialog', { name: '✏️ Edit group' });
    const button = within(dialog).queryByRole('button', { name: '✏️ Edited messages' });
    if (!listed) { expect(button).toBeNull(); return; }
    expect(button).not.toBeNull(); if (!button) return;
    fireEvent.click(button);
    const log = await screen.findByRole('list', { name: 'Edited messages log' });
    expect(within(log).getByText('old public text')).toBeInTheDocument();
    expect(within(log).getByText('new public text')).toBeInTheDocument();
  });
});