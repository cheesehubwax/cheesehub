import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@wharfkit/session';
import { generateKey, saveContact, saveKey, encryptMemo, loadContacts } from '@/lib/cheeseCrypt';
import { groupPayload, saveGroups } from '@/lib/cryptGroups';
import { loadBlocked } from '@/lib/cryptBlocklist';
import { Messenger } from '@/pages/CheeseCrypt';

const calls = vi.hoisted(() => ({ transact: vi.fn(), fetch: vi.fn() }));
vi.mock('@/context/WaxContext', () => ({ useWax: vi.fn() }));
vi.mock('@/hooks/useWaxTransaction', () => ({ useWaxTransaction: () => ({ executeTransaction: calls.transact }) }));
vi.mock('@/lib/cheeseCrypt', async original => ({ ...await original<typeof import('@/lib/cheeseCrypt')>(), fetchMessages: calls.fetch, lookupPublishedKey: async () => null }));
vi.mock('@/components/Layout', () => ({ Layout: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('@/components/crypt/AvatarEditor', () => ({ AvatarEditor: () => null }));
vi.mock('@/lib/cryptVault', async original => ({ ...await original<typeof import('@/lib/cryptVault')>(), recallVault: async () => null }));

const mount = (ui: React.ReactElement) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);

describe('blocking on this device', () => {
  beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); Element.prototype.scrollIntoView = vi.fn(); calls.transact.mockResolvedValue({ success: false }); });

  it('hides a blocked friend and their group messages, keeps their key, and restores on unblock', async () => {
    const alice = generateKey('alice'), bob = generateKey('bob'), carol = generateKey('carol');
    saveKey(alice); saveContact('alice', 'bob', bob.publicKey); saveContact('alice', 'carol', carol.publicKey);
    const group = { id: '0123456789abcdef', members: ['alice', 'bob', 'carol'] };
    saveGroups('alice', [group]);
    calls.fetch.mockResolvedValue([
      { txId: 'a', time: 1, from: 'bob', to: 'alice', quantity: '0.0010 CHEESE', memo: encryptMemo('bob dm', alice.publicKey, bob.secretKey) },
      { txId: 'b', time: 2, from: 'bob', to: 'alice', quantity: '0.0010 CHEESE', memo: encryptMemo(groupPayload(group, 'bob in group'), alice.publicKey, bob.secretKey) },
      { txId: 'c', time: 3, from: 'carol', to: 'alice', quantity: '0.0010 CHEESE', memo: encryptMemo(groupPayload(group, 'carol in group'), alice.publicKey, carol.secretKey) },
    ]);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    mount(<Messenger account="alice" session={{ permissionLevel: { actor: 'alice', permission: 'active' } } as unknown as Session} />);
    fireEvent.click(screen.getByRole('button', { name: /^bob/ }));
    await screen.findByText('bob dm');
    fireEvent.click(screen.getByRole('button', { name: 'Block bob' }));
    expect(confirm).toHaveBeenCalled();
    expect(loadBlocked('alice')).toEqual(['bob']);
    expect(loadContacts('alice').bob).toBe(bob.publicKey);
    expect(screen.queryByRole('button', { name: /^bob/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Group · 3 people/ }));
    await screen.findByText('carol in group');
    expect(screen.queryByText('bob in group')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Blocked accounts' }));
    fireEvent.click(screen.getByRole('button', { name: 'Unblock bob' }));
    expect(loadBlocked('alice')).toEqual([]);
    await waitFor(() => expect(screen.getByText('bob in group')).toBeInTheDocument());
  });
});
