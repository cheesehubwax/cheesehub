/**
 * YouTube links inside decrypted CHEESECrypt text. Links are only parsed locally; nothing is fetched
 * until the reader presses play. Playback tiers: Invidious (default), Piped, then direct YouTube
 * (youtube-nocookie) only after an explicit IP-exposure warning.
 */
export type YoutubeLink = { id: string; start: number; url: string };
export type TextSegment = { type: 'text'; text: string } | { type: 'youtube'; link: YoutubeLink };

const ID = /^[A-Za-z0-9_-]{11}$/;
const HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com', 'youtu.be']);
const URL_RE = /https?:\/\/[^\s<>"']+/g;

/** Parses "120", "90s", "1m30s", "1h2m3s" into whole seconds (0 when invalid). */
export function parseStart(v: string | null): number {
  if (!v) return 0;
  if (/^\d+$/.test(v)) return Math.min(Number(v), 86_400);
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(v);
  if (!m || !(m[1] || m[2] || m[3])) return 0;
  return Math.min(Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0), 86_400);
}

export function parseYoutubeUrl(raw: string): YoutubeLink | null {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const host = u.hostname.toLowerCase();
  if (!HOSTS.has(host)) return null;
  let id: string | null = null;
  const path = u.pathname.split('/').filter(Boolean);
  if (host === 'youtu.be') id = path[0] ?? null;
  else if (path[0] === 'watch') id = u.searchParams.get('v');
  else if (['shorts', 'embed', 'live', 'v'].includes(path[0] ?? '')) id = path[1] ?? null;
  if (!id || !ID.test(id)) return null;
  return { id, start: parseStart(u.searchParams.get('t') ?? u.searchParams.get('start')), url: raw };
}

/** Splits text into plain and YouTube segments; non-YouTube links stay as text. */
export function splitYoutube(text: string): TextSegment[] {
  const out: TextSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const raw = m[0].replace(/[).,!?;:]+$/, '');
    const link = parseYoutubeUrl(raw);
    if (!link) continue;
    const at = m.index ?? 0;
    if (at > last) out.push({ type: 'text', text: text.slice(last, at) });
    out.push({ type: 'youtube', link });
    last = at + raw.length;
  }
  if (last < text.length) out.push({ type: 'text', text: text.slice(last) });
  return out.length ? out : [{ type: 'text', text }];
}

export type YoutubeTier = 'invidious' | 'piped' | 'direct';
export const YOUTUBE_TIERS: YoutubeTier[] = ['invidious', 'piped', 'direct'];
/** Curated origins only: never take a mirror host from message content. Public availability varies. */
export const PRIVATE_YOUTUBE_MIRRORS = [
  { id: 'tiekoetter', tier: 'invidious', host: 'https://invidious.tiekoetter.com' },
  { id: 'yewtu', tier: 'invidious', host: 'https://yewtu.be' },
  { id: 'piped', tier: 'piped', host: 'https://piped.video' },
] as const;
export type YoutubeMirror = (typeof PRIVATE_YOUTUBE_MIRRORS)[number];
export const INVIDIOUS_HOST = PRIVATE_YOUTUBE_MIRRORS[0].host;
export const PIPED_HOST = 'https://piped.video';

export function privateVideoUrl(link: YoutubeLink, mirror: YoutubeMirror, embedded: boolean): string {
  const url = new URL(embedded ? `/embed/${encodeURIComponent(link.id)}` : '/watch', mirror.host);
  if (!embedded) url.searchParams.set('v', link.id);
  // Invidious must proxy media too, not just the player page.
  if (mirror.tier === 'invidious') url.searchParams.set('local', 'true');
  if (embedded) url.searchParams.set('autoplay', '1');
  if (link.start > 0) url.searchParams.set('t', String(link.start));
  return url.toString();
}

/** Cycling stays private, including when wrapping back to the first mirror. */
export function nextPrivateMirror(index: number): number {
  return (index + 1) % PRIVATE_YOUTUBE_MIRRORS.length;
}

export function embedUrl(link: YoutubeLink, tier: YoutubeTier): string {
  const id = encodeURIComponent(link.id);
  const s = link.start > 0 ? link.start : 0;
  const mirror = PRIVATE_YOUTUBE_MIRRORS.find(m => m.tier === tier);
  if (mirror) return privateVideoUrl(link, mirror, true);
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1${s ? `&start=${s}` : ''}`;
}

/** The next tier to try; direct YouTube is never chosen without the reader's confirmation. */
export function nextTier(t: YoutubeTier): YoutubeTier | null {
  const i = YOUTUBE_TIERS.indexOf(t);
  return YOUTUBE_TIERS[i + 1] ?? null;
}
