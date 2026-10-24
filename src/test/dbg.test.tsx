import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, it, vi } from 'vitest';
import type { Session } from '@wharfkit/session';
import { generateKey, saveContact, saveKey, encryptMemo } from '@/lib/cheeseCrypt';
import { encodeReply } from '@/lib/cryptReply';
import { Messenger } from '@/pages/CheeseCrypt';
const calls = vi.hoisted(() => ({ transact: vi.fn(), fetch: vi.fn() }));
vi.mock('@/context/WaxContext', () => ({ useWax: vi.fn() }));
vi.mock('@/hooks/useWaxTransaction', () => ({ useWaxTransaction: () => ({ executeTransaction: calls.transact }) }));
vi.mock('@/lib/cheeseCrypt', async original => ({ ...await original<typeof import('@/lib/cheeseCrypt')>(), fetchMessages: calls.fetch, lookupPublishedKey: async () => null }));
vi.mock('@/components/Layout', () => ({ Layout: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('@/components/crypt/AvatarEditor', () => ({ AvatarEditor: () => null }));
vi.mock('@/lib/cryptVault', async original => ({ ...await original<typeof import('@/lib/cryptVault')>(), recallVault: async () => null }));
const session = { permissionLevel: { actor: 'alice', permission: 'active' } } as unknown as Session;
describe('dbg', () => {
  beforeEach(() => {
    localStorage.clear(); vi.clearAllMocks(); Element.prototype.scrollIntoView = vi.fn();
    const alice = generateKey('alice'), bob = generateKey('bob');
    saveKey(alice); saveContact('alice', 'bob', bob.publicKey);
    const msg = (time: number, text: string) => ({ txId: `t${time}`, time, from: 'bob', to: 'alice', quantity: '0.0010 CHEESE', memo: encryptMemo(text, alice.publicKey, bob.secretKey) });
    calls.fetch.mockResolvedValue([msg(1, 'one'), msg(2, 'two'), msg(3, encodeReply({ author: 'alice', time: 1, quote: 'q' }, 'reply one')), msg(4, encodeReply({ author: 'alice', time: 2, quote: 'q' }, 'reply two'))]);
    localStorage.setItem('cheesecrypt-read-alice', JSON.stringify({ bob: 0 }));
  });
  it('dump', async () => {
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Messenger account="alice" session={session} /></QueryClientProvider>);
    const room = await screen.findByRole('button', { name: /^bob/ });
    console.log('HTML:', room.outerHTML);
  });
});
