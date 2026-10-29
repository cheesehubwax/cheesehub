import { describe, expect, it, vi } from 'vitest';
import { cleanYoutubeTitle, fetchYoutubeTitle, splitYoutube, untitledYoutubeLinks, withYoutubeTitle } from '@/lib/cryptYoutube';

const URL = 'https://youtu.be/dQw4w9WgXcQ';

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
