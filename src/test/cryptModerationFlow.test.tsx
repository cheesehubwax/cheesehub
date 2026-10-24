import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import type { Session } from '@wharfkit/session';
import { encryptMemo, generateKey, saveKey, splitMessage } from '@/lib/cheeseCrypt';
import { encodeGroupText, encodeRoomPolicy, saveInvites } from '@/lib/cryptInviteGroups';
import { encodeListing } from '@/lib/cryptRooms';
import { Messenger } from '@/pages/CheeseCrypt';
const calls = vi.hoisted(() => ({ fetch: vi.fn(), rooms: vi.fn(), transact: vi.fn() }));
vi.mock('@/context/WaxContext', () => ({ useWax: vi.fn() }));
vi.mock('@/hooks/useWaxTransaction', () => ({ useWaxTransaction: () => ({ executeTransaction: calls.transact }) }));
vi.mock('@/lib/cheeseCrypt', async original => ({ ...await original<typeof import('@/lib/cheeseCrypt')>(), fetchMessages: calls.fetch, fetchRoomMemos: calls.rooms, lookupPublishedKey: async () => null }));
vi.mock('@/lib/cryptVault', async original => ({ ...await original<typeof import('@/lib/cryptVault')>(), recallVault: async () => null }));
const alice = generateKey('alice'), bob = generateKey('bob'), carol = generateKey('carol');
const id = '0123456789abcdef', at = Date.now() - 10000;
const memos = (payload: string, time: number, from = alice, to = bob, txId = `t${time}`) => splitMessage(payload).map(p => ({ from: from.account, to: to.account, time, txId, quantity: '0.0010 CHEESE', memo: encryptMemo(p, to.publicKey, from.secretKey) }));
beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks(); saveKey(alice);
  saveInvites('alice', { [id]: { id, name: 'Moderated room', creator: 'alice', created: at - 1000, members: [alice, bob, carol].map(k => ({ account: k.account, publicKey: k.publicKey })) } });
  calls.rooms.mockResolvedValue([{ from: 'alice', to: 'eosio.null', txId: 'listed', time: at, quantity: '0.0080 CHEESE', memo: encodeListing({ id, name: 'Moderated room', topic: '', tags: [], publicKey: alice.publicKey, members: 2 }) }]);
  calls.fetch.mockResolvedValue(memos(encodeRoomPolicy(id, true, ['alice', 'bob']), at));
});
const renderAs = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Messenger account="alice" session={{ permissionLevel: { actor: 'alice', permission: 'active' } } as unknown as Session} /></QueryClientProvider>);
const chatHistory = () => [...memos(encodeRoomPolicy(id, true, ['alice', 'bob']), at), ...memos(encodeGroupText(id, 'hello from bob'), at + 100, bob, alice), ...memos(encodeGroupText(id, 'hello from carol'), at + 200, carol, alice)];
const openMenu = async (text: string) => { fireEvent.click(await screen.findByRole('button', { name: /Moderated room/ })); fireEvent.contextMenu(await screen.findByText(text)); return screen.findByRole('menu'); };

it('owner mutes for 15 minutes from the message menu and muted messages disappear after refresh', async () => {
  const history = chatHistory();
  calls.fetch.mockResolvedValue(history);
  calls.transact.mockImplementation(async (actions: { data: { from: string; to: string; memo: string; quantity: string } }[]) => {
    calls.fetch.mockResolvedValue([...history, ...actions.filter(a => a.data.to === 'bob' || a.data.to === 'carol').map(a => ({ ...a.data, txId: 'mute', time: at + 1000 })), ...memos(encodeGroupText(id, 'muted content'), at + 2000, carol, alice)]);
    return { success: true, txId: 'mute' };
  });
  renderAs();
  const menu = await openMenu('hello from carol');
  const sub = within(menu).getByRole('menuitem', { name: '🔇 Mute user' });
  fireEvent.keyDown(sub, { key: 'ArrowRight' });
  fireEvent.click(await screen.findByRole('menuitem', { name: '15 minutes' }));
  const payDialog = await screen.findByRole('dialog', { name: '🔇 Mute carol' });
  const pay = within(payDialog).getByRole('button', { name: 'Pay & mute' });
  expect(pay).toBeDisabled(); fireEvent.click(within(payDialog).getByRole('checkbox')); fireEvent.click(pay);
  await waitFor(() => expect(calls.transact).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(calls.fetch.mock.calls.length).toBeGreaterThan(1));
  expect(within(screen.getByRole('list', { name: 'Chat messages', hidden: true })).queryByText('muted content')).not.toBeInTheDocument();
});

it('owner cannot ban a founding member but can ban a later member', async () => {
  calls.fetch.mockResolvedValue(chatHistory());
  renderAs();
  let menu = await openMenu('hello from bob');
  expect(within(menu).getByRole('menuitem', { name: /Ban user/ })).toHaveAttribute('data-disabled');
  fireEvent.keyDown(menu, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  fireEvent.contextMenu(screen.getByText('hello from carol'));
  menu = await screen.findByRole('menu');
  const ban = within(menu).getByRole('menuitem', { name: /Ban user/ });
  expect(ban).not.toHaveAttribute('data-disabled');
  expect(within(menu).getByRole('menuitem', { name: '🛡️ Make admin' })).toBeInTheDocument();
  fireEvent.click(ban);
  expect(await screen.findByRole('dialog', { name: /carol/ })).toBeInTheDocument();
});
