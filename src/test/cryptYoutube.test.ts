import { describe, expect, it } from 'vitest';
import { embedUrl, nextPrivateMirror, nextTier, PRIVATE_YOUTUBE_MIRRORS, privateVideoUrl, parseYoutubeUrl, splitYoutube } from '@/lib/cryptYoutube';

describe('cryptYoutube', () => {
  it('parses common YouTube link forms', () => {
    expect(parseYoutubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')?.id).toBe('dQw4w9WgXcQ');
    expect(parseYoutubeUrl('https://youtu.be/dQw4w9WgXcQ?t=90')).toMatchObject({ id: 'dQw4w9WgXcQ', start: 90 });
    expect(parseYoutubeUrl('https://youtube.com/shorts/dQw4w9WgXcQ')?.id).toBe('dQw4w9WgXcQ');
    expect(parseYoutubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s')?.start).toBe(90);
  });
  it('rejects look-alike hosts and bad ids', () => {
    expect(parseYoutubeUrl('https://youtube.com.evil.io/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(parseYoutubeUrl('https://www.youtube.com/watch?v=short')).toBeNull();
  });
  it('keeps surrounding text', () => {
    const s = splitYoutube('look https://youtu.be/dQw4w9WgXcQ, nice');
    expect(s.map(x => x.type)).toEqual(['text', 'youtube', 'text']);
    expect(s[2]).toEqual({ type: 'text', text: ', nice' });
  });
  it('defaults to Invidious, then Piped, then direct YouTube', () => {
    const l = parseYoutubeUrl('https://youtu.be/dQw4w9WgXcQ');
    if (!l) throw new Error('Expected a valid link');
    expect(embedUrl(l, 'invidious')).toContain('invidious.tiekoetter.com/embed/dQw4w9WgXcQ');
    expect(nextTier('invidious')).toBe('piped');
    expect(embedUrl(l, 'piped')).toContain('piped.video/embed/dQw4w9WgXcQ');
    expect(nextTier('piped')).toBe('direct');
    expect(embedUrl(l, 'direct')).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ');
  });
  it('keeps mirror cycling private even after the last mirror', () => {
    expect(nextPrivateMirror(PRIVATE_YOUTUBE_MIRRORS.length - 1)).toBe(0);
    expect(PRIVATE_YOUTUBE_MIRRORS.map(m => m.tier)).not.toContain('direct');
  });
  it('requests proxied Invidious media and retains timestamps in external watch links', () => {
    const link = { id: 'dQw4w9WgXcQ', start: 90, url: '' };
    for (const mirror of PRIVATE_YOUTUBE_MIRRORS.filter(m => m.tier === 'invidious')) {
      for (const embedded of [true, false]) {
        const url = new URL(privateVideoUrl(link, mirror, embedded));
        expect(url.searchParams.get('local')).toBe('true');
        expect(url.searchParams.get('t')).toBe('90');
        if (!embedded) expect(url.searchParams.get('v')).toBe(link.id);
      }
    }
  });
});
