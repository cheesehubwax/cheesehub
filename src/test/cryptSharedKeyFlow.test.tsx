import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import type { Session } from '@wharfkit/session';
import { generateKey, encryptMemo, decryptMemo, type ChainMemo } from '@/lib/cheeseCrypt';
import { encodeRoomKeyControl, encodeNotice, parseCg2, saveInvites } from '@/lib/cryptInviteGroups';
import { encodeListing } from '@/lib/cryptRooms';
import { newRoomKeyBytes, sealRoomText } from '@/lib/cryptRoomKey';
import { saveKey } from './cryptLockedFixture';
import { Messenger } from '@/pages/CheeseCrypt';
import { loadModerationMemos } from '@/lib/cryptModeration';

const calls = vi.hoisted(() => ({ fetch: vi.fn(), rooms: vi.fn(), transact: vi.fn() }));
vi.mock('@/context/WaxContext', () => ({ useWax: vi.fn() }));
vi.mock('@/hooks/useWaxTransaction', () => ({ useWaxTransaction: () => ({ executeTransaction: calls.transact }) }));
vi.mock('@/lib/cheeseCrypt', async original => ({ ...await original<typeof import('@/lib/cheeseCrypt')>(), fetchMessages: calls.fetch,
  fetchContractStream: async (_a: string, cursor: number) => ({ rows: await calls.fetch(), cursor, complete: true }),
  fetchMessageDelta: async (_a: string, cursor: number) => ({ rows: await calls.fetch(), cursor, complete: true }),
  fetchRoomStream: async () => [], lookupPublishedKey: async () => null, fetchRoomMemos: calls.rooms }));
vi.mock('@/lib/cryptVault', async original => ({ ...await original<typeof import('@/lib/cryptVault')>(), recallVault: async () => null }));

const alice = generateKey('alice'), bob = generateKey('bob');
const id = '00112233445566ff';
const rk = { room: id, epoch: 1, key: newRoomKeyBytes(), since: 100 };
const history: ChainMemo[] = [];
beforeEach(async () => {
  localStorage.clear(); vi.clearAllMocks(); history.length = 0;
  await saveKey(alice);
  saveInvites('alice', { [id]: { id, name: 'Test room', creator: 'alice', created: 1, publicRoom: true,
    members: [alice, bob].map(k => ({ account: k.account, publicKey: k.publicKey })) } });
  history.push({ txId: 'key', time: 100, from: 'alice', to: 'bob', quantity: '', memo: encryptMemo(encodeRoomKeyControl(id, 1, rk.key), bob.publicKey, alice.secretKey) },
    { txId: 'join', time: 101, from: 'bob', to: 'alice', quantity: '', memo: encryptMemo(encodeNotice('joined', id), alice.publicKey, bob.secretKey) },
    ...sealRoomText(rk, 'bob', 'Earlier shared message').map(memo => ({ txId: 'msg', time: 200, from: 'bob', to: 'eosio.null', quantity: '', memo })));
  calls.fetch.mockImplementation(async () => [...history]);
  calls.rooms.mockResolvedValue([{ txId: 'listing', time: 1, from: 'alice', to: 'eosio.null', quantity: '80.0000 CHEESE',
    memo: encodeListing({ id, name: 'Test room', topic: '', tags: [], publicKey: alice.publicKey, members: 1 }) }]);
  calls.transact.mockImplementation(async (actions: { data: { from: string; to: string; memo: string; quantity: string } }[]) => {
    history.push(...actions.filter(a => a.data.to === 'bob').map(a => ({ ...a.data, txId: 'off', time: 300 })));
    return { success: true, txId: 'off' };
  });
});

it('owner switches off, history remains visible, and the next message is pairwise', async () => {
  const user = userEvent.setup();
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <Messenger account="alice" session={{ actor: 'alice', walletPlugin: { id: 'anchor' }, permissionLevel: { actor: 'alice', permission: 'active' } } as unknown as Session} />
  </QueryClientProvider>);
  await user.click(await screen.findByRole('button', { name: /Test room/ }));
  await screen.findByText('Earlier shared message');
  await user.click(screen.getByRole('button', { name: 'Group options' }));
  await user.click(await screen.findByRole('menuitem', { name: '🔑 Turn off shared room key' }));
  await waitFor(() => expect(calls.transact).toHaveBeenCalledTimes(1));
  const off = calls.transact.mock.calls[0][0].find((a: { data: { to: string } }) => a.data.to === 'bob');
  expect(parseCg2(decryptMemo(off.data.memo, bob.publicKey, alice.secretKey))).toEqual({ kind: 'roomkey-off', id, epoch: 2 });
  await user.click(screen.getByRole('button', { name: 'Group options' }));
  await screen.findByRole('menuitem', { name: '🔑 Turn on shared room key' });
  const held = loadModerationMemos('alice').filter(m => m.to === 'bob').map(m => parseCg2(decryptMemo(m.memo, bob.publicKey, alice.secretKey)));
  expect(held).toContainEqual({ kind: 'roomkey', id, epoch: 1, key: rk.key });
  expect(held).toContainEqual({ kind: 'roomkey-off', id, epoch: 2 });
  await user.keyboard('{Escape}');
  expect(screen.getByText('Earlier shared message')).toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText('Message group'), { target: { value: 'Pairwise again' } });
  await user.click(screen.getByRole('button', { name: /^Send$/ }));
  await waitFor(() => expect(calls.transact).toHaveBeenCalledTimes(2));
  const message = calls.transact.mock.calls[1][0].find((a: { data: { to: string } }) => a.data.to === 'bob');
  expect(parseCg2(decryptMemo(message.data.memo, bob.publicKey, alice.secretKey))).toEqual({ kind: 'msg', id, text: 'Pairwise again' });
});