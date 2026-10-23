import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@wharfkit/session';
import { encryptMemo, generateKey, loadContacts, saveKey } from '@/lib/cheeseCrypt';
import { Messenger } from '@/pages/CheeseCrypt';
import { loadBlocked } from '@/lib/cryptBlocklist';
import { loadPublicInbox } from '@/lib/cryptPublicInbox';

const calls = vi.hoisted(() => ({ fetch: vi.fn(), lookup: vi.fn(), transact: vi.fn() }));
vi.mock('@/context/WaxContext', () => ({ useWax: vi.fn() }));
vi.mock('@/hooks/useWaxTransaction', () => ({ useWaxTransaction: () => ({ executeTransaction: calls.transact }) }));
vi.mock('@/lib/cheeseCrypt', async original => ({ ...await original<typeof import('@/lib/cheeseCrypt')>(), fetchMessages: calls.fetch, lookupPublishedKey: calls.lookup }));
vi.mock('@/lib/cryptVault', async original => ({ ...await original<typeof import('@/lib/cryptVault')>(), recallVault: async () => null }));
const alice = generateKey('alice'), bob = generateKey('bob');
const history = [{ txId: 'request', time: 100, from: 'bob', to: 'alice', quantity: '0.0010 CHEESE', memo: encryptMemo('hello support', alice.publicKey, bob.secretKey) }];
const mount = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Messenger account="alice" session={{ permissionLevel: { actor: 'alice', permission: 'active' } } as unknown as Session} /></QueryClientProvider>);
async function enable() {
  fireEvent.click(screen.getByRole('button', { name: 'Public inbox' }));
  fireEvent.click(screen.getByRole('switch', { name: 'Accept message requests' }));
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  await screen.findByRole('button', { name: 'Accept request from bob' });
}
beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks(); saveKey(alice);
  calls.fetch.mockResolvedValue(history); calls.lookup.mockResolvedValue(bob.publicKey);
  calls.transact.mockResolvedValue({ success: false });
});
describe('public inbox transitions', () => {
  it('never discovers strangers when off; quarantines requests until free explicit acceptance', async () => {
    mount(); await waitFor(() => expect(calls.fetch).toHaveBeenCalled());
    expect(calls.lookup).not.toHaveBeenCalled(); expect(loadContacts('alice')).toEqual({});
    await enable(); expect(loadPublicInbox('alice')).toBe(true);
    expect(loadContacts('alice')).toEqual({});
    expect(screen.queryByRole('button', { name: 'Remove friend bob' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Accept request from bob' }));
    await screen.findByPlaceholderText('Message bob');
    expect(loadContacts('alice').bob).toBe(bob.publicKey);
    expect(screen.getByText('hello support')).toBeInTheDocument();
    expect(calls.transact).not.toHaveBeenCalled();
  });
  it('remembers decline across remount without adding a friend', async () => {
    const view = mount(); await enable();
    fireEvent.click(screen.getByRole('button', { name: 'Decline request from bob' }));
    expect(loadContacts('alice')).toEqual({}); view.unmount(); mount();
    await waitFor(() => expect(calls.fetch).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('button', { name: 'Accept request from bob' })).not.toBeInTheDocument();
    expect(calls.transact).not.toHaveBeenCalled();
  });
  it('blocks requests through the existing block list and sends nothing', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mount(); await enable();
    fireEvent.click(screen.getByRole('button', { name: 'Block request from bob' }));
    expect(loadBlocked('alice')).toEqual(['bob']);
    expect(screen.queryByRole('button', { name: 'Accept request from bob' })).not.toBeInTheDocument();
    expect(loadContacts('alice')).toEqual({}); expect(calls.transact).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});