import { describe, expect, it } from 'vitest';
import { embedUrl, nextTier, parseYoutubeUrl, splitYoutube } from '@/lib/cryptYoutube';

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
    const l = parseYoutubeUrl('https://youtu.be/dQw4w9WgXcQ')!;
    expect(embedUrl(l, 'invidious')).toContain('yewtu.be/embed/dQw4w9WgXcQ');
    expect(nextTier('invidious')).toBe('piped');
    expect(embedUrl(l, 'piped')).toContain('piped.video/embed/dQw4w9WgXcQ');
    expect(nextTier('piped')).toBe('direct');
    expect(embedUrl(l, 'direct')).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ');
  });
});
