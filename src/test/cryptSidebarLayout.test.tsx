import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@wharfkit/session';
import { generateKey, saveContact, saveKey, encryptMemo } from '@/lib/cheeseCrypt';
import { Messenger } from '@/pages/CheeseCrypt';

const calls = vi.hoisted(() => ({ transact: vi.fn(), fetch: vi.fn() }));
vi.mock('@/context/WaxContext', () => ({ useWax: vi.fn() }));
vi.mock('@/hooks/useWaxTransaction', () => ({ useWaxTransaction: () => ({ executeTransaction: calls.transact }) }));
vi.mock('@/lib/cheeseCrypt', async original => ({ ...await original<typeof import('@/lib/cheeseCrypt')>(), fetchMessages: calls.fetch, lookupPublishedKey: async () => null }));
vi.mock('@/components/Layout', () => ({ Layout: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('@/components/crypt/AvatarEditor', () => ({ AvatarEditor: () => null }));
vi.mock('@/lib/cryptVault', async original => ({ ...await original<typeof import('@/lib/cryptVault')>(), recallVault: async () => null }));

const session = { permissionLevel: { actor: 'alice', permission: 'active' } } as unknown as Session;
const mount = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Messenger account="alice" session={session} /></QueryClientProvider>);

describe('compact sidebar', () => {
  beforeEach(() => {
    localStorage.clear(); vi.clearAllMocks(); Element.prototype.scrollIntoView = vi.fn();
    const alice = generateKey('alice'), bob = generateKey('bob');
    saveKey(alice); saveContact('alice', 'bob', bob.publicKey);
    calls.fetch.mockResolvedValue([{ txId: 'a', time: 1, from: 'bob', to: 'alice', quantity: '0.0010 CHEESE', memo: encryptMemo('hi alice', alice.publicKey, bob.secretKey) }]);
  });

  it('keeps actions behind Menu and the profile visible', async () => {
    mount();
    expect(screen.queryByRole('button', { name: 'Back up private key' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    for (const name of ['Back up private key', 'Blocked accounts', 'Create a new key', 'Public inbox', 'Share my public key file']) expect(await screen.findByRole('button', { name })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit profile' })).toBeInTheDocument();
  });

  it('hides groups and friends, remembers it after remount, and shows them again', async () => {
    const { unmount } = mount();
    await screen.findByRole('button', { name: /^bob/ });
    fireEvent.click(screen.getByRole('button', { name: 'Hide groups and friends' }));
    expect(screen.getByRole('button', { name: 'Show groups and friends' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: /^bob/ }).closest('.overflow-y-auto')).toHaveClass('hidden');
    expect(localStorage.getItem('cheesecrypt-sidebar-collapsed-alice')).toBe('1');
    unmount(); mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Show groups and friends' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /^bob/ }).closest('.overflow-y-auto')).not.toHaveClass('hidden'));
    expect(localStorage.getItem('cheesecrypt-sidebar-collapsed-alice')).toBe('0');
  });

  it('keeps the fee explanation closed until Fee info is clicked', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: /^bob/ }));
    expect(screen.queryByText(/Platform fees split 80% to eosio.null and 20% to xcheeseliqst/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Fee info/ }));
    expect(await screen.findByText(/Platform fees split 80% to eosio.null and 20% to xcheeseliqst/)).toBeInTheDocument();
  });

  it('puts Terms on the bottom line beside Fee info with Send pushed right', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: /^bob/ }));
    const line = screen.getByRole('button', { name: /Fee info/ }).closest('.order-last');
    expect(line).not.toBeNull();
    expect(screen.getByLabelText(/I have read and agree/).closest('.order-last')).toBe(line);
    expect(line?.querySelector('button.bg-cheese')).not.toBeNull();
    expect(line?.querySelector('.ml-auto')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Hide groups and friends' }));
    expect(screen.getByLabelText(/I have read and agree/).closest('.order-last')).toBeNull();
  });
});
