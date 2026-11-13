import 'fake-indexeddb/auto';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import type { Session } from '@wharfkit/session';
import { saveKey } from './cryptLockedFixture';
import { generateKey, encryptMemo, saveContact } from '@/lib/cheeseCrypt';
import { saveHistory } from '@/lib/cryptHistoryCache';
import { Messenger } from '@/pages/CheeseCrypt';

const calls = vi.hoisted(() => ({ full: vi.fn(), delta: vi.fn(), rooms: vi.fn() }));
vi.mock('@/context/WaxContext', () => ({ useWax: vi.fn() }));
vi.mock('@/hooks/useWaxTransaction', () => ({ useWaxTransaction: () => ({ executeTransaction: vi.fn() }) }));
vi.mock('@/lib/cheeseCrypt', async original => ({ ...await original<typeof import('@/lib/cheeseCrypt')>(), fetchMessages: calls.full, fetchMessageDelta: calls.delta, fetchRoomMemos: calls.rooms, lookupPublishedKey: async () => null }));
vi.mock('@/lib/cryptVault', async original => ({ ...await original<typeof import('@/lib/cryptVault')>(), recallVault: async () => null }));
vi.mock('@/lib/cryptRoomDenylist', async original => ({ ...await original<typeof import('@/lib/cryptRoomDenylist')>(), fetchRoomCurators: async () => [], fetchRoomHides: async () => [] }));
const alice = generateKey('cachealice'), bob = generateKey('cachebob');
const at = Date.now() - 600000;
const memo = (text: string, txId: string, time = at) => ({ txId, time, from: bob.account, to: alice.account, memo: encryptMemo(text, alice.publicKey, bob.secretKey), quantity: '0.0001 CHEESE' });
const mount = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Messenger account={alice.account} session={{ actor: alice.account, walletPlugin: { id: 'anchor' }, permissionLevel: { actor: alice.account, permission: 'active' } } as unknown as Session} /></QueryClientProvider>);
beforeEach(async () => { localStorage.clear(); vi.clearAllMocks(); await saveKey(alice); saveContact(alice.account, bob.account, bob.publicKey); calls.rooms.mockResolvedValue([]); });

it('opens saved ciphertext before a stalled network, merges a new message and retains both after restart', async () => {
  await saveHistory(alice.account, 'standard', [memo('saved conversation', 'saved')], at, 4);
  let complete: ((r: { rows: ReturnType<typeof memo>[]; cursor: number; complete: boolean }) => void) | undefined;
  calls.delta.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
  const first = mount();
  fireEvent.click(await screen.findByRole('button', { name: /cachebob/ }));
  expect(await screen.findByText('saved conversation')).toBeInTheDocument();
  expect(calls.full).not.toHaveBeenCalled();
  expect(calls.rooms).not.toHaveBeenCalled();
  await waitFor(() => expect(complete).toBeDefined());
  complete?.({ rows: [memo('new conversation', 'new', at + 1000)], cursor: Date.now(), complete: true });
  expect(await screen.findByText('new conversation')).toBeInTheDocument();
  await waitFor(async () => {
    const { loadHistory } = await import('@/lib/cryptHistoryCache');
    expect((await loadHistory(alice.account, 'standard'))?.rows).toHaveLength(2);
  });
  first.unmount();
  calls.delta.mockImplementation(() => new Promise(() => {}));
  mount();
  fireEvent.click(await screen.findByRole('button', { name: /cachebob/ }));
  expect(await screen.findByText('saved conversation')).toBeInTheDocument();
  expect(await screen.findByText('new conversation')).toBeInTheDocument();
  expect(calls.full).not.toHaveBeenCalled();
});