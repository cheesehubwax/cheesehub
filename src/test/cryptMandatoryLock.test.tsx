import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import type { Session } from '@wharfkit/session';
import { clearSessionKeys, generateKey, loadContacts, loadKey, saveContact } from '@/lib/cheeseCrypt';
import { loadLockedEnvelope, LOCK_TX_EXPIRATION, saveLockedEnvelope, sealKey, clearVerifiedKeys } from '@/lib/cryptKeyLock';
import { Messenger } from '@/pages/CheeseCrypt';

const calls = vi.hoisted(() => ({ pay: vi.fn(), sign: vi.fn(), download: vi.fn(), fetch: vi.fn() }));
vi.mock('@/hooks/useWaxTransaction', () => ({ useWaxTransaction: () => ({ executeTransaction: calls.pay }) }));
vi.mock('@/lib/cheeseCrypt', async original => ({ ...await original<typeof import('@/lib/cheeseCrypt')>(), fetchMessages: calls.fetch }));
vi.mock('@/lib/cryptVault', async original => ({ ...await original<typeof import('@/lib/cryptVault')>(), recallVault: async () => null }));
vi.mock('@/components/crypt/cryptDownload', () => ({ download: calls.download }));
const session = { actor: 'alice', permission: 'active', permissionLevel: { actor: 'alice', permission: 'active' }, walletPlugin: { id: 'anchor' }, transact: calls.sign } as unknown as Session;
const mount = (s = session) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Messenger account="alice" session={s} /></QueryClientProvider>);
beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks(); calls.fetch.mockResolvedValue([]);
  calls.pay.mockResolvedValue({ success: true, txId: 'paid' });
  calls.sign.mockResolvedValue({ resolved: { transaction: { expiration: LOCK_TX_EXPIRATION } }, signatures: ['SIG_K1_abc'] });
});

it('legacy keys cannot enter chat until sealed, and sealing preserves identity and friends without payment', async () => {
  const key = generateKey('alice'), friend = generateKey('bob');
  localStorage.setItem('cheesecrypt-key-alice', JSON.stringify(key)); saveContact('alice', 'bob', friend.publicKey);
  mount();
  expect(screen.queryByRole('button', { name: 'Menu' })).toBeNull();
  expect(calls.fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Lock key to continue' }));
  await screen.findByRole('button', { name: 'Menu' });
  expect(loadKey('alice')).toEqual(key);
  expect(loadContacts('alice')).toEqual({ bob: friend.publicKey });
  expect(localStorage.getItem('cheesecrypt-key-alice')).toBeNull();
  expect(calls.pay).not.toHaveBeenCalled(); expect(calls.sign).toHaveBeenCalledTimes(2);
  expect(calls.download.mock.calls[0][1]).toMatchObject({ version: 2, publicKey: key.publicKey });
  expect(calls.download.mock.calls[0][1]).not.toHaveProperty('secretKey');
});

it('a cancelled lock after confirmed 100 CHEESE creation retries without charging or exporting plaintext', async () => {
  calls.sign.mockRejectedValueOnce(new Error('Cancelled'));
  mount(); fireEvent.click(screen.getByRole('button', { name: 'Create a new key' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Use defaults' }));
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Pay 100 CHEESE & create key' }));
  const retry = await screen.findByRole('button', { name: 'Lock key to continue' });
  await waitFor(() => expect(retry).toBeEnabled());
  expect(loadKey('alice')).toBeNull(); expect(loadLockedEnvelope('alice')).toBeNull();
  expect(calls.download).not.toHaveBeenCalled();
  fireEvent.click(retry); await screen.findByRole('button', { name: 'Menu' });
  expect(calls.pay).toHaveBeenCalledTimes(1);
  expect(calls.pay.mock.calls[0][0].map((a: { data: { quantity: string } }) => a.data.quantity)).toEqual(['80.0000 CHEESE', '20.0000 CHEESE']);
  expect(loadLockedEnvelope('alice')?.version).toBe(2);
  expect(localStorage.getItem('cheesecrypt-key-alice')).toBeNull();
});

it('stored envelopes require a fresh explicit unlock after a browser restart, never an automatic wallet prompt', async () => {
  const key = generateKey('alice'); saveLockedEnvelope(await sealKey(async () => 'SIG_K1_abc', key, 'alice'));
  clearSessionKeys(); clearVerifiedKeys();
  mount(); expect(calls.sign).not.toHaveBeenCalled(); expect(calls.fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Unlock saved key with Anchor' }));
  await screen.findByRole('button', { name: 'Menu' });
  expect(calls.sign).toHaveBeenCalledTimes(1); expect(loadKey('alice')).toEqual(key);
});

it('non-Anchor wallets cannot create keys or pay the creation fee', () => {
  mount({ ...session, walletPlugin: { id: 'cloudwallet' } } as unknown as Session);
  expect(screen.getByRole('button', { name: 'Create a new key' })).toBeDisabled();
  expect(calls.pay).not.toHaveBeenCalled();
});

it('a signing result arriving after leaving the account cannot persist or export its key', async () => {
  const key = generateKey('alice'); localStorage.setItem('cheesecrypt-key-alice', JSON.stringify(key));
  let finish: ((result: unknown) => void) | undefined;
  calls.sign.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const view = mount(); fireEvent.click(screen.getByRole('button', { name: 'Lock key to continue' }));
  view.unmount();
  await act(async () => { finish?.({ resolved: { transaction: { expiration: LOCK_TX_EXPIRATION } }, signatures: ['SIG_K1_abc'] }); });
  expect(loadLockedEnvelope('alice')).toBeNull(); expect(calls.download).not.toHaveBeenCalled();
});