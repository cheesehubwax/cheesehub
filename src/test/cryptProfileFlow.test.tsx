import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@wharfkit/session';
import { generateKey, saveContact, saveKey, encryptMemo, splitMessage, loadContactAvatars } from '@/lib/cheeseCrypt';
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
  beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); Element.prototype.scrollIntoView = vi.fn(); calls.transact.mockResolvedValue({ success: false }); });

  it('applies the newest received note to the friend and never shows it as a message', async () => {
    const alice = generateKey('alice'), bob = generateKey('bob');
    saveKey(alice); saveContact('alice', 'bob', bob.publicKey);
    const note = (name: string, txId: string, time: number) => splitMessage(profileNotePayload({ avatar, displayName: name }))
      .map(p => ({ txId, time, from: 'bob', to: 'alice', quantity: '0.0010 CHEESE', memo: encryptMemo(p, alice.publicKey, bob.secretKey) }));
    calls.fetch.mockResolvedValue([
      ...note('Bobby New', 'n2', 5), ...note('Bobby Old', 'n1', 2),
      { txId: 'm', time: 3, from: 'bob', to: 'alice', quantity: '0.0010 CHEESE', memo: encryptMemo('real hi', alice.publicKey, bob.secretKey) },
    ]);
    mount(<Messenger account="alice" session={{ permissionLevel: { actor: 'alice', permission: 'active' } } as unknown as Session} />);
    await waitFor(() => expect(loadCryptNames('alice').bob).toBe('Bobby New'));
    expect(loadContactAvatars('alice').bob).toEqual(avatar);
    fireEvent.click(await screen.findByRole('button', { name: /Bobby New/ }));
    await screen.findByText('real hi');
    expect(screen.queryByText(/CP1/)).not.toBeInTheDocument();
  });
});
