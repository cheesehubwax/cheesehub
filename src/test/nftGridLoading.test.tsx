import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NFTGridCard } from '@/components/shared/NFTGridCard';

const h = vi.hoisted(() => ({ queue: vi.fn() }));
vi.mock('@/lib/nftImageQueue', () => ({ queueNftImage: h.queue }));
const nft = { asset_id: '99', name: 'Artwork', collection: 'cheese', image: 'ipfs://QmcyKFxZWFMFJAmjuowJ4F1DUzGGUpEFDV6Co4mV9Dx5ND' };
let notify: (visible: boolean) => void;
let cancel: ReturnType<typeof vi.fn>;
beforeEach(() => {
  h.queue.mockReset();
  cancel = vi.fn();
  h.queue.mockReturnValue(cancel);
  vi.stubGlobal('IntersectionObserver', class {
    constructor(private callback: (entries: { target: Element; isIntersecting: boolean }[]) => void) {
    }
    observe(target: Element) { notify = visible => this.callback([{ target, isIntersecting: visible }]); }
    unobserve() {}
    disconnect() {}
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('viewport-only NFT tiles', () => {
  it('never queues artwork until visible and cancels when scrolled away', () => {
    const { unmount } = render(<NFTGridCard nft={nft} isSelected={false} onToggle={() => {}} />);
    expect(h.queue).not.toHaveBeenCalled();
    act(() => notify(true));
    expect(h.queue).toHaveBeenCalledTimes(1);
    act(() => notify(false));
    expect(cancel).toHaveBeenCalledTimes(1);
    act(() => notify(true));
    expect(h.queue).toHaveBeenCalledTimes(2);
    unmount();
    expect(cancel).toHaveBeenCalledTimes(2);
  });

  it('walks all gateway fallbacks then restarts from AtomicHub on manual retry', () => {
    render(<NFTGridCard nft={nft} isSelected={false} onToggle={() => {}} />);
    act(() => notify(true));
    for (let i = 0; i < 6; i++) act(() => h.queue.mock.calls[i][2]());
    const video = document.querySelector('video');
    expect(video?.getAttribute('src')).toContain('QmcyKFxZ');
    fireEvent.error(video!);
    expect(screen.getByText('Retry')).toBeTruthy();
    fireEvent.click(screen.getByText('Retry'));
    expect(h.queue.mock.calls[6][0]).toContain('resizer.atomichub.io');
    expect(h.queue.mock.calls[6][0]).toContain('retry=1');
    act(() => h.queue.mock.calls[6][1]());
    expect(screen.getByAltText('Artwork').getAttribute('src')).toContain('retry=1');
  });

  it('shows remounted artwork from the session cache without re-queuing', () => {
    const cachedNft = { ...nft, asset_id: '100', image: 'ipfs://QmCacheTestHash11111111111111111111111111111111' };
    const first = render(<NFTGridCard nft={cachedNft} isSelected={false} onToggle={() => {}} />);
    act(() => notify(true));
    act(() => h.queue.mock.calls[0][1]());
    first.unmount();
    h.queue.mockClear();
    render(<NFTGridCard nft={cachedNft} isSelected={false} onToggle={() => {}} />);
    act(() => notify(true));
    expect(h.queue).not.toHaveBeenCalled();
    expect(screen.getByAltText('Artwork').getAttribute('src')).toContain('resizer.atomichub.io');
  });

  it('renders video-only NFTs as a muted video preview', () => {
    render(<NFTGridCard nft={{ ...nft, image: 'ipfs://QmVideoHash/clip.mp4' }} isSelected={false} onToggle={() => {}} />);
    act(() => notify(true));
    expect(h.queue).not.toHaveBeenCalled();
    const video = document.querySelector('video');
    expect(video?.muted).toBe(true);
  });

  it('does not download missing placeholder artwork', () => {
    render(<NFTGridCard nft={{ ...nft, image: '/placeholder.svg' }} isSelected={false} onToggle={() => {}} />);
    act(() => notify(true));
    expect(h.queue).not.toHaveBeenCalled();
  });
});