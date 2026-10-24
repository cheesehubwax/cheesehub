import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@wharfkit/session';
import { generateKey, saveContact, saveKey, encryptMemo } from '@/lib/cheeseCrypt';
import { encodeReply } from '@/lib/cryptReply';
import { createGroup, saveGroups } from '@/lib/cryptGroups';
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
    localStorage.setItem('cheesecrypt-read-alice', JSON.stringify({ bob: 0 }));
    const { unmount } = mount();
    await screen.findByRole('button', { name: /^bob/ });
    fireEvent.click(screen.getByRole('button', { name: 'Hide groups and friends' }));
    expect(screen.getByRole('button', { name: 'Show groups and friends' })).toHaveAttribute('aria-expanded', 'false');
    const listBob = () => screen.getAllByRole('button', { name: /^bob/ }).find(b => !b.closest('nav'))!;
    expect(listBob().closest('.overflow-y-auto')).toHaveClass('hidden');
    // The collapsed strip shows bob's avatar with his unread count and opens his chat.
    const strip = screen.getByRole('navigation', { name: 'Chats' });
    const railBob = strip.querySelector('button[title="bob"]') as HTMLElement;
    await waitFor(() => expect(railBob).toHaveAttribute("aria-label", "bob, 1 unread"));
    fireEvent.click(railBob);
    expect(railBob).toHaveAttribute('aria-current', 'true');
    expect(localStorage.getItem('cheesecrypt-sidebar-collapsed-alice')).toBe('1');
    unmount(); mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Show groups and friends' }));
    expect(screen.queryByRole('navigation', { name: 'Chats' })).toBeNull();
    await waitFor(() => expect(listBob().closest('.overflow-y-auto')).not.toHaveClass('hidden'));
    expect(localStorage.getItem('cheesecrypt-sidebar-collapsed-alice')).toBe('0');
  });

  it('splits the collapsed strip into Groups and Friends sections', async () => {
    const carol = generateKey('carol');
    saveContact('alice', 'carol', carol.publicKey);
    saveGroups('alice', [createGroup('alice', ['bob', 'carol'])]);
    mount();
    await screen.findByRole('button', { name: /^bob/ });
    fireEvent.click(screen.getByRole('button', { name: 'Hide groups and friends' }));
    const strip = screen.getByRole('navigation', { name: 'Chats' });
    const groups = within(strip).getByRole('group', { name: 'Groups' });
    const friends = within(strip).getByRole('group', { name: 'Friends' });
    expect(within(groups).getByText('Groups')).toBeInTheDocument();
    expect(within(friends).getByText('Friends')).toBeInTheDocument();
    expect(groups.querySelector('button[title="Group · 3 people"]')).not.toBeNull();
    expect(friends.querySelector('button[title="bob"]')).not.toBeNull();
    // Each avatar sits in its own section only, and Groups sits above Friends.
    expect(within(groups).queryByRole('button', { name: /^bob/ })).toBeNull();
    expect(within(friends).queryByRole('button', { name: /Group ·/ })).toBeNull();
    expect(groups.compareDocumentPosition(friends) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows no Groups section in the strip while there are no groups', async () => {
    mount();
    await screen.findByRole('button', { name: /^bob/ });
    fireEvent.click(screen.getByRole('button', { name: 'Hide groups and friends' }));
    const strip = screen.getByRole('navigation', { name: 'Chats' });
    expect(within(strip).queryByRole('group', { name: 'Groups' })).toBeNull();
    expect(within(strip).getByRole('group', { name: 'Friends' })).toBeInTheDocument();
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
    expect(screen.getByRole('checkbox', { name: /I have read and agree/ }).closest('.order-last')).toBe(line);
    expect(line?.querySelector('button.bg-cheese')).not.toBeNull();
    expect(line?.querySelector('.ml-auto')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Hide groups and friends' }));
    expect(screen.getByRole('checkbox', { name: /I have read and agree/ }).closest('.order-last')).toBeNull();
  });

  it('shows separate yellow unread and blue reply badges that stay on the open room and count down with the read marker', async () => {
    const alice = generateKey('alice'), bob = generateKey('bob');
    saveKey(alice); saveContact('alice', 'bob', bob.publicKey);
    const msg = (time: number, text: string) => ({ txId: `t${time}`, time, from: 'bob', to: 'alice', quantity: '0.0010 CHEESE', memo: encryptMemo(text, alice.publicKey, bob.secretKey) });
    calls.fetch.mockResolvedValue([
      msg(1, 'one'), msg(2, 'two'),
      msg(3, encodeReply({ author: 'alice', time: 1, quote: 'q' }, 'reply one')),
      msg(4, encodeReply({ author: 'alice', time: 2, quote: 'q' }, 'reply two')),
    ]);
    localStorage.setItem('cheesecrypt-read-alice', JSON.stringify({ bob: 0 }));
    const { unmount } = mount();
    const room = await screen.findByRole('button', { name: /^bob/ });
    expect(room.querySelector('[aria-label="4 unread"]')).not.toBeNull();
    expect(room.querySelector('[aria-label="2 replies to you"]')).not.toBeNull();
    fireEvent.click(room);
    // Opening the room keeps both badges; they count down as messages are read.
    expect(room.querySelector('[aria-label="4 unread"]')).not.toBeNull();
    expect(room.querySelector('[aria-label="2 replies to you"]')).not.toBeNull();
    unmount();
    localStorage.setItem('cheesecrypt-read-alice', JSON.stringify({ bob: 3 }));
    mount();
    const roomAgain = await screen.findByRole('button', { name: /^bob/ });
    expect(roomAgain.querySelector('[aria-label="1 unread"]')).not.toBeNull();
    expect(roomAgain.querySelector('[aria-label="1 reply to you"]')).not.toBeNull();
    expect(roomAgain.querySelector('[aria-label="4 unread"]')).toBeNull();
  });
});
