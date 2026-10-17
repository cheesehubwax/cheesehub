import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@wharfkit/session';
import { generateKey, saveContact, saveKey } from '@/lib/cheeseCrypt';
import { loadGroups } from '@/lib/cryptGroups';
import { Messenger } from '@/pages/CheeseCrypt';

const calls = vi.hoisted(() => ({ transact: vi.fn(), fetch: vi.fn() }));
vi.mock('@/context/WaxContext', () => ({ useWax: vi.fn() }));
vi.mock('@/hooks/useWaxTransaction', () => ({ useWaxTransaction: () => ({ executeTransaction: calls.transact }) }));
vi.mock('@/lib/cheeseCrypt', async original => ({ ...await original<typeof import('@/lib/cheeseCrypt')>(), fetchMessages: calls.fetch, lookupPublishedKey: async () => null }));
vi.mock('@/components/Layout', () => ({ Layout: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('@/components/crypt/AvatarEditor', () => ({ AvatarEditor: () => null }));
vi.mock('@/lib/cryptVault', async original => ({ ...await original<typeof import('@/lib/cryptVault')>(), recallVault: async () => null }));

beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
  saveKey(generateKey('alice'));
  saveContact('alice', 'bob', generateKey('bob').publicKey);
  saveContact('alice', 'carol', generateKey('carol').publicKey);
  calls.fetch.mockResolvedValue([]);
  calls.transact.mockResolvedValue({ success: false });
});

describe('group creation and signing gate', () => {
  it('saves the selected membership and submits both recipient copies only after terms acceptance', async () => {
    render(<Messenger account="alice" session={{ permissionLevel: { actor: 'alice', permission: 'active' } } as unknown as Session} />);
    fireEvent.click(screen.getByRole('button', { name: '👥 New group' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'bob' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'carol' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create group' }));
    expect(loadGroups('alice')[0].members).toEqual(['alice', 'bob', 'carol']);
    fireEvent.change(screen.getByPlaceholderText('Message group'), { target: { value: 'hello group' } });
    const send = screen.getByRole('button', { name: /^Send$/ });
    expect(send).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(send);
    await waitFor(() => expect(calls.transact).toHaveBeenCalledTimes(1));
    const actions = calls.transact.mock.calls[0][0];
    expect(actions.map((a: { data: { to: string } }) => a.data.to)).toEqual(['bob', 'eosio.null', 'carol']);
    expect(actions.reduce((total: number, a: { data: { quantity: string } }) => total + Math.round(parseFloat(a.data.quantity) * 10000), 0)).toBe(120);
  });
});