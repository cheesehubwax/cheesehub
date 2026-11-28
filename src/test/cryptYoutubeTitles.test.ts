import { saveCustomEndpoint } from '@/lib/cryptNetworkPrivacy';
import { __resetMediaRouteCache, decideYoutubeRoute } from '@/lib/cryptMediaProxy';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanYoutubeTitle, fetchYoutubeTitle, splitYoutube, untitledYoutubeLinks, withYoutubeTitle, routedYoutubeThumbnail } from '@/lib/cryptYoutube';

const URL = 'https://youtu.be/dQw4w9WgXcQ';

beforeEach(() => { localStorage.clear(); __resetMediaRouteCache(); });

describe('YouTube titles carried in the message', () => {
  it('reads a title tag right after the link and hides the tag', () => {
    const s = splitYoutube(`watch ${URL} 〔Never Gonna〕 now`);
    expect(s[1]).toMatchObject({ type: 'youtube', link: { id: 'dQw4w9WgXcQ', title: 'Never Gonna' } });
    expect(s[2]).toEqual({ type: 'text', text: ' now' });
  });
  it('adds a title only to untitled links and only once', () => {
    const once = withYoutubeTitle(`${URL} hi`, URL, 'Song');
    expect(once).toBe(`${URL} 〔Song〕 hi`);
    expect(untitledYoutubeLinks(once)).toEqual([]);
    expect(withYoutubeTitle(once, URL, 'Other')).toBe(once);
  });
  it('strips brackets, line breaks and caps length at 100 characters', () => {
    expect(cleanYoutubeTitle('a〕\nb')).toBe('a b');
    expect(cleanYoutubeTitle('x'.repeat(150))).toHaveLength(100);
    expect(cleanYoutubeTitle('   ')).toBeNull();
  });
  it('never asks Google directly for the title', async () => {
    const f = vi.fn(async (url: string) => {
      if (url.includes('noembed.com')) return new Response(JSON.stringify({ title: 'Song' }));
      return new Response('no', { status: 403 });
    });
    expect(await fetchYoutubeTitle('dQw4w9WgXcQ', f as unknown as typeof fetch)).toBe('Song');
    for (const [u] of f.mock.calls) expect(new globalThis.URL(u).hostname).not.toMatch(/youtube|google|ytimg/);
  });
});

describe('YouTube Tor privacy', () => {
  const helper = 'http://localhost:8088';
  const id = 'dQw4w9WgXcQ';
  it('routes title lookups exclusively through a v1.8 helper', async () => {
    saveCustomEndpoint(helper, true);
    const f = vi.fn(async (url: string) => new Response(JSON.stringify(url.endsWith('/v2/helper') ? { features: ['atomic', 'ipfs', 'chain', 'respect', 'prep', 'atomic-list', 'youtube'] } : { title: 'Song' })));
    expect(await fetchYoutubeTitle(id, f as unknown as typeof fetch)).toBe('Song');
    expect(f.mock.calls.map(c => c[0])).toEqual([`${helper}/v2/helper`, `${helper}/youtube/title/${id}`]);
  });
  it('never falls back directly when a protected title lookup fails', async () => {
    saveCustomEndpoint(helper, true);
    const f = vi.fn(async (url: string) => {
      if (url.endsWith('/v2/helper')) return new Response(JSON.stringify({ features: ['atomic', 'ipfs', 'chain', 'respect', 'prep', 'atomic-list', 'youtube'] }));
      throw new TypeError('helper stopped');
    });
    expect(await fetchYoutubeTitle(id, f as unknown as typeof fetch)).toBeNull();
    expect(f.mock.calls.map(c => c[0])).toEqual([`${helper}/v2/helper`, `${helper}/youtube/title/${id}`]);
  });
  it('blocks older and unreachable helpers without contacting video services', async () => {
    saveCustomEndpoint(helper, true);
    for (const features of [[], ['atomic', 'ipfs', 'chain', 'respect', 'prep', 'atomic-list']]) {
      __resetMediaRouteCache();
      const f = vi.fn(async () => new Response(JSON.stringify({ features })));
      expect(await fetchYoutubeTitle(id, f as unknown as typeof fetch)).toBeNull();
      expect(f).toHaveBeenCalledTimes(1);
    }
    __resetMediaRouteCache();
    const down = vi.fn().mockRejectedValue(new TypeError('down'));
    expect(await fetchYoutubeTitle(id, down)).toBeNull();
    expect(down).toHaveBeenCalledTimes(1);
  });
  it('routes pictures through Tor and blocks pictures for old, unknown or down helpers', () => {
    const link = { id, start: 0, url: URL };
    expect(routedYoutubeThumbnail(link, decideYoutubeRoute(helper, 'youtube'))).toBe(`${helper}/youtube/thumbnail/${id}`);
    for (const probe of [null, 'prep', 'down'] as const) expect(routedYoutubeThumbnail(link, decideYoutubeRoute(helper, probe))).toBeNull();
    expect(routedYoutubeThumbnail(link, decideYoutubeRoute(null, null))).toBe('https://invidious.tiekoetter.com/vi/dQw4w9WgXcQ/mqdefault.jpg');
  });
});
