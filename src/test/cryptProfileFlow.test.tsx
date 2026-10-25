import { saveKey } from './cryptLockedFixture';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@wharfkit/session';
import { generateKey, saveContact, encryptMemo, splitMessage, loadContactAvatars } from '@/lib/cheeseCrypt';
import { loadCryptNames } from '@/lib/cryptNames';
import { profileNotePayload } from '@/lib/cryptProfileNotes';
import { Messenger } from '@/pages/CheeseCrypt';

const calls = vi.hoisted(() => ({ transact: vi.fn(), fetch: vi.fn() }));
vi.mock('@/context/WaxContext', () => ({ useWax: vi.fn() }));
vi.mock('@/hooks/useWaxTransaction', () => ({ useWaxTransaction: () => ({ executeTransaction: calls.transact }) }));
vi.mock('@/lib/cheeseCrypt', async original => ({ ...await original<typeof import('@/lib/cheeseCrypt')>(), fetchMessages: calls.fetch, lookupPublishedKey: async () => null }));
vi.mock('@/components/Layout', () => ({ Layout: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('@/lib/cryptVault', async original => ({ ...await original<typeof import('@/lib/cryptVault')>(), recallVault: async () => null }));

const mount = (ui: React.ReactElement) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);
const avatar = { version: 1 as const, pixels: '2'.repeat(64) };

describe('profile notes in the messenger', () => {
  beforeEach(async () => { localStorage.clear(); vi.clearAllMocks(); URL.createObjectURL = vi.fn(() => 'blob:x'); URL.revokeObjectURL = vi.fn(); Element.prototype.scrollIntoView = vi.fn(); calls.transact.mockResolvedValue({ success: false }); });

  it('applies the newest received note to the friend and never shows it as a message', async () => {
    const alice = generateKey('alice'), bob = generateKey('bob');
    await saveKey(alice); saveContact('alice', 'bob', bob.publicKey);
    const note = (name: string, txId: string, time: number) => splitMessage(profileNotePayload({ avatar, displayName: name }))
      .map(p => ({ txId, time, from: 'bob', to: 'alice', quantity: '0.0010 CHEESE', memo: encryptMemo(p, alice.publicKey, bob.secretKey) }));
    calls.fetch.mockResolvedValue([
      ...note('Bobby New', 'n2', 5), ...note('Bobby Old', 'n1', 2),
      { txId: 'm', time: 3, from: 'bob', to: 'alice', quantity: '0.0010 CHEESE', memo: encryptMemo('real hi', alice.publicKey, bob.secretKey) },
    ]);
    mount(<Messenger account="alice" session={{ actor: 'alice', walletPlugin: { id: 'anchor' }, permissionLevel: { actor: 'alice', permission: 'active' } } as unknown as Session} />);
    await waitFor(() => expect(loadCryptNames('alice').bob).toBe('Bobby New'));
    expect(loadContactAvatars('alice').bob).toEqual(avatar);
    fireEvent.click(await screen.findByRole('button', { name: /Bobby New/ }));
    await screen.findByText('real hi');
    expect(screen.queryByText(/CP1/)).not.toBeInTheDocument();
  });

  it('offers to send an edited profile and pays only after terms are accepted', async () => {
    const alice = generateKey('alice'), bob = generateKey('bob');
    await saveKey(alice); saveContact('alice', 'bob', bob.publicKey);
    calls.fetch.mockResolvedValue([]);
    calls.transact.mockResolvedValue({ success: true, txId: 'ok' });
    mount(<Messenger account="alice" session={{ actor: 'alice', walletPlugin: { id: 'anchor' }, permissionLevel: { actor: 'alice', permission: 'active' } } as unknown as Session} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit profile' }));
    fireEvent.change(await screen.findByLabelText('CHEESECrypt name'), { target: { value: 'Alice New' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save profile' })); });
    const send = await screen.findByRole('button', { name: 'Send update' });
    expect(send).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    await act(async () => { fireEvent.click(send); });
    expect(calls.transact).toHaveBeenCalledTimes(1);
    const actions = calls.transact.mock.calls[0][0] as { data: { to: string } }[];
    expect(actions.some(a => a.data.to === 'bob')).toBe(true);
    expect(actions.some(a => a.data.to === 'eosio.null')).toBe(true);
    expect(actions.some(a => a.data.to === 'xcheeseliqst')).toBe(true);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Send update' })).not.toBeInTheDocument());
  });
});
