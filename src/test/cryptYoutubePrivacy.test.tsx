import { saveCustomEndpoint } from '@/lib/cryptNetworkPrivacy';
import { __resetMediaRouteCache } from '@/lib/cryptMediaProxy';
import { fireEvent, render, screen, cleanup, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { PRIVATE_YOUTUBE_MIRRORS } from '@/lib/cryptYoutube';

vi.mock('@/lib/musicPlayer', () => ({ getAudioPlayer: () => ({ pause: vi.fn(), subscribe: () => () => {} }) }));
vi.mock('@/lib/cryptAudio', () => ({ CRYPT_NOW_PLAYING: 'cheesecrypt-now-playing', announcePlaying: vi.fn() }));
import { CryptYoutubeEmbed } from '@/components/crypt/CryptYoutubeEmbed';

// jsdom does not implement native dialog methods; browser coverage verifies
// top-layer behavior and the iframe's actual browsing-context continuity.
beforeAll(() => {
  HTMLDialogElement.prototype.show = function () { this.open = true; };
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});
afterEach(() => { cleanup(); localStorage.clear(); __resetMediaRouteCache(); vi.unstubAllGlobals(); });
const link = { id: 'dQw4w9WgXcQ', start: 90, url: 'https://youtu.be/dQw4w9WgXcQ?t=90' };
const mount = () => render(<CryptYoutubeEmbed link={link} />);

describe('private YouTube playback consent', () => {
  it('retains the same iframe and parent through repeated expand/close cycles', () => {
    const { container } = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Play video privately' }));
    const frame = container.querySelector('iframe');
    const parent = frame?.parentElement;
    const src = frame?.getAttribute('src');
    expect(frame).not.toBeNull();
    expect(frame?.getAttribute('allow')).not.toContain('fullscreen');
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByRole('button', { name: 'Expand video' }));
      expect(container.querySelector('iframe')).toBe(frame);
      expect(frame?.parentElement).toBe(parent);
      expect(frame?.getAttribute('src')).toBe(src);
      fireEvent.click(screen.getByRole('button', { name: 'Close expanded video' }));
      expect(container.querySelector('iframe')).toBe(frame);
      expect(frame?.parentElement).toBe(parent);
    }
  });
  it('mounts no remote media before play', () => {
    const { container } = mount();
    expect(container.querySelectorAll('iframe, img, video, audio, link')).toHaveLength(0);
  });
  it('cycles only private origins and never automatically chooses Google on failure', () => {
    const { container } = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Play video privately' }));
    for (let i = 0; i <= PRIVATE_YOUTUBE_MIRRORS.length; i++) {
      const frame = container.querySelector('iframe');
      expect(frame).not.toBeNull();
      expect(new URL(frame?.getAttribute('src') ?? '').origin).toBe(PRIVATE_YOUTUBE_MIRRORS[i % PRIVATE_YOUTUBE_MIRRORS.length].host);
      if (frame) fireEvent.error(frame);
      expect(container.querySelector('iframe')?.getAttribute('src')).not.toContain('youtube-nocookie');
      fireEvent.click(screen.getByRole('button', { name: /Switch mirror/ }));
    }
  });
  it('requires explicit confirmation every time before contacting Google', () => {
    const { container } = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Play video privately' }));
    fireEvent.click(screen.getByRole('button', { name: /Last resort/ }));
    expect(container.querySelector('iframe')?.getAttribute('src')).not.toContain('youtube-nocookie');
    fireEvent.click(screen.getByRole('button', { name: 'Keep private' }));
    expect(container.querySelector('iframe')?.getAttribute('src')).not.toContain('youtube-nocookie');
    fireEvent.click(screen.getByRole('button', { name: /Last resort/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Play on YouTube anyway' }));
    expect(container.querySelector('iframe')?.getAttribute('src')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&start=90');
    fireEvent.click(screen.getByRole('button', { name: 'Stop video' }));
    expect(container.querySelector('iframe')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Play video privately' }));
    expect(container.querySelector('iframe')?.getAttribute('src')).toContain(PRIVATE_YOUTUBE_MIRRORS[0].host);
  });
  it('suppresses referrers and restricts iframe navigation permissions', () => {
    const { container } = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Play video privately' }));
    const frame = container.querySelector('iframe');
    expect(frame?.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(frame?.getAttribute('sandbox')).toBe('allow-scripts allow-same-origin allow-presentation');
    const external = screen.getByRole('link', { name: /Open private mirror/ });
    expect(external.getAttribute('rel')).toBe('noopener noreferrer');
    expect(external.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(new URL(external.getAttribute('href') ?? '').searchParams.get('local')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /Try Piped/ }));
    expect(container.querySelector('iframe')?.getAttribute('src')).toContain('https://piped.video/embed/');
  });
});
describe('protected picture interaction', () => {
  it('makes no request before preview and loads only the helper image after preview', async () => {
    saveCustomEndpoint('http://localhost:8088', true);
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ features: ['atomic', 'ipfs', 'chain', 'respect', 'prep', 'atomic-list', 'youtube'] })));
    vi.stubGlobal('fetch', fetcher);
    const { container } = mount();
    expect(fetcher).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Preview picture/ }));
    await waitFor(() => expect(container.querySelector('img')?.getAttribute('src')).toBe('http://localhost:8088/youtube/thumbnail/dQw4w9WgXcQ'));
    expect(fetcher).toHaveBeenCalledTimes(1);
    fireEvent.error(container.querySelector('img') as HTMLImageElement);
    expect(container.querySelector('img')).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('does not load a public picture if a saved old helper lacks video support', async () => {
    saveCustomEndpoint('http://localhost:8088', true);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ features: ['atomic', 'ipfs', 'chain', 'respect', 'prep', 'atomic-list'] }))));
    const { container } = mount();
    fireEvent.click(screen.getByRole('button', { name: /Preview picture/ }));
    await waitFor(() => expect(container.querySelector('img')).toBeNull());
    await waitFor(() => expect(screen.getByText('Picture unavailable')).toBeInTheDocument());
  });
});
