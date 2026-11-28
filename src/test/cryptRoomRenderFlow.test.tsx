import { saveKey } from './cryptLockedFixture';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@wharfkit/session';
import { encryptMemo, generateKey, saveContact } from '@/lib/cheeseCrypt';
import { encodeGroupText, loadInvites, saveDecision, saveInvites } from '@/lib/cryptInviteGroups';
import { encodeReply } from '@/lib/cryptReply';
import { saveReadMarks } from '@/lib/cryptUnread';
import { Messenger } from '@/pages/CheeseCrypt';

const calls = vi.hoisted(() => ({ fetch: vi.fn(), transact: vi.fn() }));
vi.mock('@/context/WaxContext', () => ({ useWax: vi.fn() }));
vi.mock('@/hooks/useWaxTransaction', () => ({ useWaxTransaction: () => ({ executeTransaction: calls.transact }) }));
vi.mock('@/lib/cheeseCrypt', async original => ({ ...await original<typeof import('@/lib/cheeseCrypt')>(), fetchMessages: calls.fetch,
  fetchContractStream: async (_: string, cursor: number) => ({ rows: await calls.fetch(), cursor, complete: true }),
  fetchRoomMemos: async () => [], lookupPublishedKey: async () => null }));
vi.mock('@/lib/cryptVault', async original => ({ ...await original<typeof import('@/lib/cryptVault')>(), recallVault: async () => null }));
vi.mock('@/components/crypt/CryptTrustBadge', async original => ({ ...await original<typeof import('@/components/crypt/CryptTrustBadge')>(), CryptTrustBadge: () => null }));
vi.mock('@/components/crypt/CryptNftCard', () => ({ CryptNftCard: () => { throw new Error('Synthetic NFT failure'); } }));
vi.mock('@/components/crypt/ChatMessageItem', async original => {
  const actual = await original<typeof import('@/components/crypt/ChatMessageItem')>();
  return { ChatMessageItem: (props: Parameters<typeof actual.ChatMessageItem>[0]) => {
    if (props.m.text === 'synthetic broken row') throw new Error('Synthetic row failure');
    return <actual.ChatMessageItem {...props} />;
  } };
});

const alice = generateKey('alice'), bob = generateKey('bob');
const id = '0123456789abcdef';
const memo = (text: string, i: number, group = true) => ({ txId: `room-${i}`, time: 100 + i, from: 'bob', to: 'alice', quantity: '0.0001 CHEESE',
  memo: encryptMemo(group ? encodeGroupText(id, text) : text, alice.publicKey, bob.secretKey) });
beforeEach(async () => {
  localStorage.clear(); vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
  await saveKey(alice); saveContact('alice', 'bob', bob.publicKey);
  saveInvites('alice', { [id]: { id, name: 'Public cheese room', creator: 'bob', created: 1, publicRoom: true,
    members: [alice, bob].map(k => ({ account: k.account, publicKey: k.publicKey })) } });
  saveDecision('alice', id, 'joined', 2);
  saveReadMarks('alice', { [`group:${id}`]: 1, bob: 1 });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const mount = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
  <Messenger account="alice" session={{ actor: 'alice', walletPlugin: { id: 'anchor' }, permissionLevel: { actor: 'alice', permission: 'active' } } as unknown as Session} />
</QueryClientProvider>);

describe('authenticated public-room rendering', () => {
  it('opens 757 mixed history rows, skipping malformed controls while preserving 20 replies and an unsent draft', async () => {
    const badPayloads = ['\u0002CG2:msg:{"i":"0123456789abcdef","t":{}}', '\u0002CG2:invite:null', '\u0002CP1:{"avatar":null}', '\u0002CG1:{"id":"0123456789abcdef","members":[null]}'];
    const rows = [...Array.from({ length: 737 }, (_, i) => memo(badPayloads[i % badPayloads.length], i, false)),
      ...Array.from({ length: 20 }, (_, i) => memo(encodeReply({ author: 'alice', time: 1, quote: 'original' }, `busy answer ${i}`), 737 + i))];
    expect(rows).toHaveLength(757);
    calls.fetch.mockResolvedValue(rows);
    mount();
    await waitFor(() => expect(screen.getByLabelText('20 unread')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Public cheese room/ }));
    const list = await screen.findByRole('list', { name: 'Chat messages' });
    expect(within(list).getByText('busy answer 19')).toBeInTheDocument();
    const draft = screen.getByPlaceholderText('Message group');
    fireEvent.change(draft, { target: { value: 'Retain my unsent text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Jump to earliest unseen reply (20 remaining)' }));
    expect(screen.getByRole('button', { name: 'Jump to earliest unseen reply (19 remaining)' })).toBeInTheDocument();
    expect(draft).toHaveValue('Retain my unsent text');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(calls.transact).not.toHaveBeenCalled();
  }, 20_000);
  it('keeps an unlocked room and its draft usable after an asynchronous visibility failure', async () => {
    calls.fetch.mockResolvedValue([memo(encodeReply({ author: 'alice', time: 1, quote: 'original' }, 'Incoming reply'), 0)]);
    mount();
    fireEvent.click(await screen.findByRole('button', { name: /Public cheese room/ }));
    const list = await screen.findByRole('list', { name: 'Chat messages' });
    const draft = screen.getByPlaceholderText('Message group');
    fireEvent.change(draft, { target: { value: 'Keep this unsent draft' } });
    vi.spyOn(list, 'getBoundingClientRect').mockReturnValue({ top: 100, bottom: 500, height: 400 } as DOMRect);
    const measure = vi.spyOn(within(list).getByText('Incoming reply').closest('li') as HTMLLIElement, 'getBoundingClientRect')
      .mockImplementation(() => { throw new Error('Synthetic visibility failure'); });
    fireEvent.scroll(list);
    await screen.findByRole('button', { name: 'Retry navigation' });
    expect(draft).toHaveValue('Keep this unsent draft');
    expect(within(list).getByText('Incoming reply')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Jump to earliest unseen reply (1 remaining)' })).toBeInTheDocument();
    measure.mockReturnValue({ top: 200, bottom: 260, height: 60 } as DOMRect);
    fireEvent.click(screen.getByRole('button', { name: 'Retry navigation' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Jump to earliest unseen reply (1 remaining)' })).not.toBeInTheDocument());
    expect(draft).toHaveValue('Keep this unsent draft');
    expect(calls.transact).not.toHaveBeenCalled();
  });
  it('opens 92 encrypted incoming replies, navigates/searches their wire keys, switches to DM and returns', async () => {
    calls.fetch.mockResolvedValue([...Array.from({ length: 92 }, (_, i) => memo(encodeReply({ author: 'alice', time: 1, quote: 'original' }, `answer ${i}`), i)), memo('Private conversation', 93, false)]);
    mount();
    await waitFor(() => expect(screen.getByLabelText('92 unread')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Public cheese room/ }));
    const list = await screen.findByRole('list', { name: 'Chat messages' });
    expect(within(list).getByText('answer 91')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Jump to earliest unseen reply (92 remaining)' }));
    expect(screen.getByRole('button', { name: 'Jump to earliest unseen reply (91 remaining)' })).toBeInTheDocument();
    expect(within(list).getByText('answer 0').closest('li')?.dataset.replyHighlighted).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Search chat' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Search this chat' }), { target: { value: 'answer 91' } });
    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /^bob.*1 unread$/ }));
    expect(await screen.findByText('Private conversation')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Public cheese room/ }));
    expect(await screen.findByText('answer 91')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(calls.transact).not.toHaveBeenCalled();
  }, 20_000);

  it('keeps the room and composer open when one decrypted row fails to render', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    calls.fetch.mockResolvedValue([memo('Before', 0), memo('synthetic broken row', 1), memo('After', 2)]);
    mount();
    fireEvent.click(await screen.findByRole('button', { name: /Public cheese room/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to display this message.');
    expect(screen.getByText('Before')).toBeInTheDocument();
    expect(screen.getByText('After')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Message group')).toBeInTheDocument();
    expect(calls.transact).not.toHaveBeenCalled();
  });
  it('uses the same protected feed for a private invite group', async () => {
    const held = loadInvites('alice');
    saveInvites('alice', { [id]: { ...held[id], publicRoom: false, name: 'Private invite room' } });
    calls.fetch.mockResolvedValue([memo(encodeReply({ author: 'alice', time: 1, quote: 'original' }, 'Private group reply'), 0)]);
    mount();
    fireEvent.click(await screen.findByRole('button', { name: /Private invite room/ }));
    expect(await screen.findByText('Private group reply')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Jump to earliest unseen reply (1 remaining)' }));
    expect(screen.queryByRole('button', { name: /Jump to earliest unseen reply/ })).not.toBeInTheDocument();
    expect(calls.transact).not.toHaveBeenCalled();
  });
  it('contains a quoted NFT failure inside the quote dialog while keeping the chat and composer usable', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    calls.fetch.mockResolvedValue([memo('[nft:123]', 0), memo(encodeReply({ author: 'bob', time: 100, quote: 'NFT' }, 'Reply to NFT'), 1)]);
    mount();
    fireEvent.click(await screen.findByRole('button', { name: /Public cheese room/ }));
    await screen.findByText('Reply to NFT');
    fireEvent.click(screen.getByRole('button', { name: 'Show the message from bob this replies to' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Unable to display this message.');
    expect(screen.getByPlaceholderText('Message group')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.getByText('Reply to NFT')).toBeInTheDocument();
    expect(calls.transact).not.toHaveBeenCalled();
  });
});