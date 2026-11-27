import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { WalletAvatarPicker } from '@/components/crypt/AvatarEditor';

const renderQ = (ui: ReactElement) => render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);

const h = vi.hoisted(() => {
  const nfts = Array.from({ length: 364 }, (_, i) => ({ asset_id: String(i), name: `Artwork ${i}`, image: `https://example.test/${i}.png`, collection: i % 2 ? 'odd' : 'even', schema: 'art', template_id: '', mint: '' }));
  const virtualizer = {
    getTotalSize: () => 560,
    getVirtualItems: () => [{ key: 0, index: 0, start: 0 }],
    measure: vi.fn(), scrollToOffset: vi.fn(),
  };
  return { nfts, virtualizer };
});
vi.mock('@/hooks/useUserNFTs', () => ({ useUserNFTs: () => ({ nfts: h.nfts, collections: [{ name: 'odd' }, { name: 'even' }], isLoading: false, refetch: vi.fn() }) }));
vi.mock('@tanstack/react-virtual', () => ({ useVirtualizer: () => h.virtualizer }));
vi.mock('@/components/shared/NFTGridCard', () => ({ NFTGridCard: ({ nft, onToggle, disabled }: { nft: { name: string }; onToggle: () => void; disabled: boolean }) => <button disabled={disabled} onClick={onToggle}>{nft.name}</button> }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  h.virtualizer.scrollToOffset.mockClear();
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('Crypt NFT picker interactions', () => {
  it('debounces search, resets the scroll position and selects the original NFT beyond item 100', () => {
    const onPick = vi.fn();
    renderQ(<WalletAvatarPicker account="alice.wam" busy={false} fillHeight onPick={onPick} />);
    h.virtualizer.scrollToOffset.mockClear();
    fireEvent.change(screen.getByLabelText('Search NFTs'), { target: { value: 'Artwork 150' } });
    act(() => vi.advanceTimersByTime(299));
    expect(h.virtualizer.scrollToOffset).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(h.virtualizer.scrollToOffset).toHaveBeenCalledWith(0);
    fireEvent.click(screen.getByRole('button', { name: 'Artwork 150' }));
    expect(onPick).toHaveBeenCalledWith(h.nfts[150]);
  });

  it('resets scroll when filtering collections and prevents selection while busy', () => {
    const onPick = vi.fn();
    renderQ(<WalletAvatarPicker account="alice.wam" busy fillHeight onPick={onPick} />);
    h.virtualizer.scrollToOffset.mockClear();
    fireEvent.change(screen.getByLabelText('NFT collection'), { target: { value: 'odd' } });
    expect(h.virtualizer.scrollToOffset).toHaveBeenCalledWith(0);
    fireEvent.click(screen.getByRole('button', { name: 'Artwork 1' }));
    expect(onPick).not.toHaveBeenCalled();
  });
});