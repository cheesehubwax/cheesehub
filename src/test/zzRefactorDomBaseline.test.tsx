// TEMPORARY refactor guard: writes normalized DOM for many CHEESECrypt states to $DOM_OUT. Deleted after the refactor.
import { fireEvent, render, screen, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, vi, beforeEach } from 'vitest';
import nacl from 'tweetnacl';
import { encodeBase64 } from 'tweetnacl-util';
import { writeFileSync, mkdirSync } from 'fs';
import type { Session } from '@wharfkit/session';
import { saveContact, saveKey, encryptMemo, splitMessage, type MessagingKey } from '@/lib/cheeseCrypt';
import { encodeReply } from '@/lib/cryptReply';
import { groupPayload, saveGroups } from '@/lib/cryptGroups';
import { encodeInvite } from '@/lib/cryptInviteGroups';
import CheeseCrypt, { Messenger } from '@/pages/CheeseCrypt';
import { useWax } from '@/context/WaxContext';

const calls = vi.hoisted(() => ({ transact: vi.fn(), fetch: vi.fn() }));
vi.mock('@/context/WaxContext', () => ({ useWax: vi.fn(() => ({ session: null, accountName: null, login: vi.fn(), logout: vi.fn() })) }));
vi.mock('@/hooks/useWaxTransaction', () => ({ useWaxTransaction: () => ({ executeTransaction: calls.transact }) }));
vi.mock('@/lib/cheeseCrypt', async original => ({ ...await original<typeof import('@/lib/cheeseCrypt')>(), fetchMessages: calls.fetch, lookupPublishedKey: async () => null }));
vi.mock('@/components/Layout', () => ({ Layout: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('@/components/crypt/AvatarEditor', () => ({ AvatarEditor: () => null }));
vi.mock('@/lib/cryptVault', async original => ({ ...await original<typeof import('@/lib/cryptVault')>(), recallVault: async () => null }));

const OUT = process.env.DOM_OUT || '/tmp/dom/current';
mkdirSync(OUT, { recursive: true });
const key = (account: string, seed: number): MessagingKey => {
  const kp = nacl.box.keyPair.fromSecretKey(new Uint8Array(32).fill(seed));
  return { type: 'gpk-msg-key', version: 1, account, publicKey: encodeBase64(kp.publicKey), secretKey: encodeBase64(kp.secretKey), created: '2026-01-01T00:00:00.000Z' };
};
const alice = key('alice', 1), bob = key('bob', 2), carol = key('carol', 3);
const dump = (name: string) => writeFileSync(`${OUT}/${name}.html`, document.body.innerHTML
  .replace(/radix-[^"\s]+/g, 'radix-X').replace(/:r[0-9a-z]+:/g, ':rX:').replace(/«r[0-9a-z]+»/g, '«rX»'));
const flush = () => act(async () => { await new Promise(r => setTimeout(r, 50)); });
const qc = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });
const mount = (who = 'alice') => render(<MemoryRouter><QueryClientProvider client={qc()}><Messenger account={who} session={{ permissionLevel: { actor: who, permission: 'active' } } as unknown as Session} /></QueryClientProvider></MemoryRouter>);
const msg = (time: number, text: string) => ({ txId: `t${time}`, time: 1700000000000 + time * 60000, from: 'bob', to: 'alice', quantity: '0.0010 CHEESE', memo: encryptMemo(text, alice.publicKey, bob.secretKey) });

beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks(); Element.prototype.scrollIntoView = vi.fn();
  vi.spyOn(Date, 'now').mockReturnValue(1700000000000 + 3600000);
  calls.fetch.mockResolvedValue([]); calls.transact.mockResolvedValue({ success: false });
});

describe('dom baseline', () => {
  it('page signed out', async () => {
    render(<MemoryRouter><QueryClientProvider client={qc()}><CheeseCrypt /></QueryClientProvider></MemoryRouter>);
    await flush(); dump('01-page-signed-out');
  });
  it('page signed in locked', async () => {
    vi.mocked(useWax).mockReturnValue({ session: { permissionLevel: { actor: 'alice', permission: 'active' } }, accountName: 'alice', login: vi.fn(), logout: vi.fn() } as never);
    render(<MemoryRouter><QueryClientProvider client={qc()}><CheeseCrypt /></QueryClientProvider></MemoryRouter>);
    await flush(); dump('02-page-locked');
  });
  it('dm states', async () => {
    saveKey(alice); saveContact('alice', 'bob', bob.publicKey);
    calls.fetch.mockResolvedValue([msg(1, 'one'), msg(2, 'two'), msg(3, encodeReply({ author: 'alice', time: 1, quote: 'q' }, 'reply one'))]);
    localStorage.setItem('cheesecrypt-read-alice', JSON.stringify({ bob: 0 }));
    mount(); await screen.findByRole('button', { name: /^bob/ }); await flush(); dump('03-dm-list');
    fireEvent.click(screen.getByRole('button', { name: /^bob/ })); await flush(); dump('04-dm-open');
    fireEvent.click(screen.getByRole('button', { name: 'Menu' })); await flush(); dump('05-menu');
    fireEvent.keyDown(document.activeElement || document.body, { key: 'Escape' }); await flush();
    fireEvent.click(screen.getByRole('button', { name: /Fee info/ })); await flush(); dump('06-feeinfo');
    fireEvent.contextMenu(screen.getByText('two')); await flush(); dump('07-context');
    const reply = screen.queryByRole('menuitem', { name: /Reply/ }); if (reply) fireEvent.click(reply); await flush(); dump('08-replying');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hello there' } }); await flush(); dump('09-typed');
    fireEvent.click(screen.getByRole('button', { name: 'Hide groups and friends' })); await flush(); dump('10-hidden');
  });
  it('legacy group', async () => {
    saveKey(alice); saveContact('alice', 'bob', bob.publicKey);
    const group = { id: '0123456789abcdef', members: ['alice', 'bob', 'carol'] };
    saveGroups('alice', [group]);
    calls.fetch.mockResolvedValue([{ ...msg(1, ''), memo: encryptMemo(groupPayload(group, 'original history'), alice.publicKey, bob.secretKey) }]);
    mount(); fireEvent.click(await screen.findByRole('button', { name: /Group · 3 people/ })); await screen.findByText('original history'); await flush(); dump('11-legacy');
    fireEvent.click(screen.getByRole('button', { name: /Members \(3\)/ })); await flush(); dump('12-legacy-members');
  });
  it('invite group', async () => {
    saveKey(bob); saveContact('bob', 'alice', alice.publicKey);
    const invite = { id: '0123456789abcdef', name: 'Cheese club', creator: 'alice', created: 5, members: [alice, bob, carol].map(k => ({ account: k.account, publicKey: k.publicKey })) };
    calls.fetch.mockResolvedValue(splitMessage(encodeInvite(invite), 'abcdef').map(p => ({ txId: 'inv', time: 1700000000000, from: 'alice', to: 'bob', quantity: '0.0010 CHEESE', memo: encryptMemo(p, bob.publicKey, alice.secretKey) })));
    mount('bob'); await screen.findByRole('button', { name: /Cheese club/ }); await flush(); dump('13-invite-list');
    fireEvent.click(screen.getByRole('button', { name: /Cheese club/ })); await flush(); dump('14-invite-open');
    const m = screen.queryByRole('button', { name: /Members \(3\)/ }); if (m) fireEvent.click(m); await flush(); dump('15-invite-members');
  });
});
