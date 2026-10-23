import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ fetch: vi.fn(), toggle: vi.fn(), announce: vi.fn() }));
vi.mock('@/services/atomicApi', () => ({ fetchAssetById: h.fetch }));
vi.mock('@/components/shared/IpfsImage', () => ({ IpfsImage: ({ alt }: { alt: string }) => <img alt={alt} /> }));
vi.mock('@/lib/cryptAudio', () => {
  const state = { key: null, playing: false, loading: false, time: 0, duration: 0, failedKeys: new Set() };
  return {
    cryptAudio: { subscribe: () => () => {}, getState: () => state, toggle: h.toggle, seek: vi.fn() },
    announcePlaying: h.announce,
    mediaCandidates: (u: string) => [u, `${u}#gw2`],
  };
});
import { CryptNftCard } from '@/components/crypt/CryptNftCard';

const mount = (ui: React.ReactElement) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);
const base = { asset_id: '1099', name: 'Squeak', image: 'https://x/img.png', collection: 'cheesesounds', mint: '7' };

describe('NFT tiles in CHEESECrypt chats', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sound effects play when the picture is clicked and open no larger view', async () => {
    h.fetch.mockResolvedValue({ ...base, isSfx: true, tracks: [{ url: 'https://x/s.mp3', label: 'Main' }] });
    mount(<CryptNftCard assetId="1099" txId="abcdef1234567890" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Play sound effect Squeak' }));
    expect(h.toggle).toHaveBeenCalledWith('1099:0', 'https://x/s.mp3');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText(/cheesesounds/)).toBeNull();
  });

  it('a sound effect that arrives while the chat is open autoplays exactly once', async () => {
    h.fetch.mockResolvedValue({ ...base, isSfx: true, tracks: [{ url: 'https://x/s.mp3', label: 'Main' }] });
    const { rerender } = mount(<CryptNftCard assetId="1099" autoplayKey="msg-1:0" />);
    await screen.findByRole('button', { name: 'Play sound effect Squeak' });
    rerender(<QueryClientProvider client={new QueryClient()}><CryptNftCard assetId="1099" autoplayKey="msg-1:0" /></QueryClientProvider>);
    expect(h.toggle).toHaveBeenCalledTimes(1);
  });

  it('other NFTs open a larger view with name, collection, asset ID and transaction link', async () => {
    h.fetch.mockResolvedValue({ ...base, name: 'Cheese Wheel', isSfx: false, tracks: [] });
    mount(<CryptNftCard assetId="1099" txId="abcdef1234567890" />);
    fireEvent.click(await screen.findByRole('button', { name: 'View Cheese Wheel larger' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('cheesesounds · #7');
    expect(screen.getByRole('link', { name: 'ID 1099' }).getAttribute('href')).toBe('https://atomichub.io/explorer/asset/wax-mainnet/1099');
    expect(screen.getByRole('link', { name: /Transaction abcdef12/ }).getAttribute('href')).toBe('https://waxblock.io/transaction/abcdef1234567890');
  });
});
