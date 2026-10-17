import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@wharfkit/session';
import { generateKey, saveContact, saveKey, encryptMemo } from '@/lib/cheeseCrypt';
import { loadCryptNames, saveCryptName } from '@/lib/cryptNames';
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
  it('renames a friend locally, reads it back after remount, and still sends to their WAX account', async () => {
    const alice = generateKey('alice'), bob = generateKey('bob');
    saveKey({ ...alice, displayName: 'Alice Cheese' });
    saveContact('alice', 'bob', bob.publicKey, undefined, 'Bob Cheese');
    calls.fetch.mockResolvedValue([{ txId: 'abc', time: 1, from: 'bob', to: 'alice', quantity: '0.0010 CHEESE', memo: encryptMemo('hi', alice.publicKey, bob.secretKey) }]);
    const props = { account: 'alice', session: { permissionLevel: { actor: 'alice', permission: 'active' } } as unknown as Session };
    const view = render(<Messenger {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /Bob Cheese/ }));
    await screen.findByText('hi');
    fireEvent.click(screen.getByRole('button', { name: 'Edit nickname for bob' }));
    fireEvent.change(screen.getByLabelText('Nickname'), { target: { value: 'Best friend' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save nickname' }));
    expect(loadCryptNames('alice', 'nicknames').bob).toBe('Best friend');
    view.unmount();
    render(<Messenger {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /Best friend/ }));
    fireEvent.change(screen.getByPlaceholderText('Message Best friend'), { target: { value: 'reply' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /^Send$/ }));
    await waitFor(() => expect(calls.transact).toHaveBeenCalledTimes(1));
    expect(calls.transact.mock.calls[0][0][0].data.to).toBe('bob');
    expect(calls.transact.mock.calls[0][0][0].data.from).toBe('alice');
    saveCryptName('alice', 'bob', '', 'nicknames');
  });
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