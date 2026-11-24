import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditedMessagesDialog } from '@/components/crypt/EditedMessagesDialog';
import { MessageRequests } from '@/components/crypt/PublicInbox';
import type { ConversationEntry } from '@/lib/cryptGroups';

vi.mock('@/components/crypt/CryptTrustBadge', () => ({ CryptTrustBadge: () => null }));
vi.mock('@/components/crypt/CryptNftCard', () => ({ CryptNftCard: () => { throw new Error('Synthetic NFT preview failure'); } }));
vi.mock('@/components/crypt/CryptInboxPreview', () => ({ CryptInboxPreview: () => { throw new Error('Synthetic inbox preview failure'); } }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const original: ConversationEntry = { key: 'original', txId: 'tx', time: 1, from: 'bob', to: 'alice', text: '[nft:123]', parts: 1, missing: 0, group: null };
describe('alternate message previews', () => {
  it('keeps the edit log open and the replacement readable if old NFT content fails', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const close = vi.fn();
    render(<EditedMessagesDialog nameFor={a => a} onClose={close} entries={[{ original, previous: original, replacement: { ...original, text: 'Replacement remains readable' }, at: 2 }]} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Replacement remains readable')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(close).toHaveBeenCalled();
  });
  it('keeps inbox accept/decline/block available when a preview fails', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const accept = vi.fn(), decline = vi.fn();
    render(<MessageRequests requests={[{ from: 'bob', publicKey: 'scoped-test-key', time: 1, messages: [original] }]}
      onAccept={accept} onDecline={decline} onBlock={vi.fn()} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Accept request from bob' }));
    expect(accept).toHaveBeenCalledWith('bob');
    fireEvent.click(screen.getByRole('button', { name: 'Decline request from bob' }));
    expect(decline).toHaveBeenCalledWith('bob');
    expect(screen.getByRole('button', { name: 'Block request from bob' })).toBeInTheDocument();
  });
});