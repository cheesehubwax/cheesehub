import { saveKey } from './cryptLockedFixture';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@wharfkit/session';
import { encryptMemo, generateKey, saveContact } from '@/lib/cheeseCrypt';
import { encodeNotice, saveInvites } from '@/lib/cryptInviteGroups';
import { encodeJoinMemo, encodeListing } from '@/lib/cryptRooms';
import { Messenger } from '@/pages/CheeseCrypt';

const calls = vi.hoisted(() => ({ fetch: vi.fn(), lookup: vi.fn(), transact: vi.fn(), rooms: vi.fn(), notify: vi.fn(), dismiss: vi.fn(), pending: new Set<string>() }));
vi.mock('sonner', () => ({ toast: Object.assign(calls.notify, { dismiss: calls.dismiss }) }));
vi.mock('@/context/WaxContext', () => ({ useWax: vi.fn() }));
vi.mock('@/hooks/useWaxTransaction', () => ({ useWaxTransaction: () => ({ executeTransaction: calls.transact }) }));
vi.mock('@/lib/cheeseCrypt', async original => ({ ...await original<typeof import('@/lib/cheeseCrypt')>(), fetchMessages: calls.fetch, lookupPublishedKey: calls.lookup, fetchRoomMemos: calls.rooms }));
vi.mock('@/lib/cryptVault', async original => ({ ...await original<typeof import('@/lib/cryptVault')>(), recallVault: async () => null }));

const alice = generateKey('alice'), bob = generateKey('bob'), carol = generateKey('carol');
const ID = '00112233445566ff';
let tick: (() => void) | undefined;
const memo = (from: typeof bob, text: string, time: number) => ({ txId: `${from.account}:${time}`, time, from: from.account, to: 'alice', quantity: '0.0001 CHEESE', memo: text });
const mount = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Messenger account="alice" session={{ actor: 'alice', walletPlugin: { id: 'anchor' }, permissionLevel: { actor: 'alice', permission: 'active' } } as unknown as Session} /></QueryClientProvider>);

beforeEach(async () => {
  localStorage.clear(); vi.clearAllMocks(); calls.pending.clear(); tick = undefined;
  const interval = window.setInterval.bind(window);
  vi.spyOn(window, 'setInterval').mockImplementation((handler, ms, ...args) => {
    if (ms === 6000 && typeof handler === 'function') tick = () => handler();
    return interval(handler, ms, ...args);
  });
  calls.notify.mockImplementation((_text, options) => { calls.pending.add(options.id); });
  calls.dismiss.mockImplementation((id: string) => { calls.pending.delete(id); });
  await saveKey(alice); saveContact('alice', 'bob', bob.publicKey);
  saveInvites('alice', { [ID]: { id: ID, name: 'Cheese club', creator: 'alice', created: 1000, publicRoom: true, members: [alice, bob].map(k => ({ account: k.account, publicKey: k.publicKey })) } });
  calls.rooms.mockResolvedValue([{ txId: 'list', time: 50, from: 'alice', to: 'eosio.null', quantity: '80.0000 CHEESE', memo: encodeListing({ id: ID, name: 'Cheese club', topic: '', tags: [], publicKey: alice.publicKey, members: 1 }) }]);
  calls.lookup.mockResolvedValue(null);
  calls.transact.mockResolvedValue({ success: true, txId: 'confirmed' });
});
afterEach(() => { vi.restoreAllMocks(); });

async function deliverLive() {
  const now = Date.now();
  const leave = memo(bob, encryptMemo(encodeNotice('leave', ID), alice.publicKey, bob.secretKey), now - 3000);
  calls.fetch.mockResolvedValue([leave]);
  mount();
  await waitFor(() => expect(calls.fetch).toHaveBeenCalled());
  fireEvent.click(await screen.findByRole('button', { name: /Cheese club/ }));
  const history = [leave,
    memo(bob, encodeJoinMemo(bob, ID, alice.publicKey), now - 1000),
    memo(carol, encodeJoinMemo(carol, ID, alice.publicKey), now)];
  calls.fetch.mockResolvedValue(history);
  await waitFor(() => expect(tick).toBeDefined());
  await act(async () => { tick?.(); });
  await waitFor(() => expect(calls.pending.size).toBe(2));
  expect(screen.getByLabelText('2 pending room requests')).toBeInTheDocument();
  return history;
}

describe('live owner request alerts', () => {
  it.each(['sidebar accept', 'chat decline', 'rail block'])('%s clears only that request across every alert', async entry => {
    const history = await deliverLive();
    expect(screen.getByRole('region', { name: 'Chat request from bob' })).toBeInTheDocument();
    if (entry === 'rail block') {
      fireEvent.click(screen.getByRole('button', { name: 'Hide groups and friends' }));
      fireEvent.click(screen.getByRole('button', { name: '2 pending room requests' }));
    }
    const panel = entry === 'chat decline'
      ? screen.getByRole('region', { name: 'Chat request from bob' })
      : screen.getByRole('region', { name: 'Room join requests' });
    fireEvent.click(within(panel).getAllByRole('button', { name: entry === 'sidebar accept' ? 'Accept' : entry === 'chat decline' ? 'Decline' : 'Block' })[entry === 'chat decline' ? 0 : 1]);
    if (entry !== 'rail block') {
      fireEvent.click(screen.getByRole('checkbox'));
      fireEvent.click(screen.getByRole('button', { name: entry === 'sidebar accept' ? 'Pay & invite' : 'Pay & decline' }));
    }
    await waitFor(() => expect(calls.pending.size).toBe(1));
    expect([...calls.pending][0]).toContain(':carol:');
    expect(screen.getByLabelText('1 pending room requests')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Chat request from bob' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Chat request from carol' })).toBeInTheDocument();
    // A lagging history node still returns both requests: completed alerts must stay cleared.
    calls.fetch.mockResolvedValue(history);
    await act(async () => { tick?.(); });
    expect(calls.pending.size).toBe(1);
    expect(screen.getByLabelText('1 pending room requests')).toBeInTheDocument();
  });

  it('review, cancelled confirmation and failed payment leave both requests pending', async () => {
    await deliverLive();
    const first = calls.notify.mock.calls.find(([, options]) => options.id.includes(':bob:'));
    await act(async () => { first?.[1].action.onClick(); });
    expect(calls.pending.size).toBe(2);
    fireEvent.click(within(screen.getByRole('region', { name: 'Chat request from bob' })).getByRole('button', { name: 'Decline' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(calls.pending.size).toBe(2);
    calls.transact.mockResolvedValue({ success: false });
    fireEvent.click(within(screen.getByRole('region', { name: 'Chat request from bob' })).getByRole('button', { name: 'Decline' }));
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Pay & decline' }));
    await waitFor(() => expect(calls.transact).toHaveBeenCalledTimes(1));
    expect(calls.pending.size).toBe(2);
    expect(screen.getByLabelText('2 pending room requests')).toBeInTheDocument();
  });
});