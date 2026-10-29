/**
 * YouTube links inside decrypted CHEESECrypt text. Links are only parsed locally; nothing is fetched
 * until the reader presses play. Playback tiers: Invidious (default), Piped, then direct YouTube
 * (youtube-nocookie) only after an explicit IP-exposure warning.
 *
 * Titles travel inside the encrypted message: the sender may add one right after the link as
 * ` 〔Title〕`, so readers see it without any network request. Older clients just show it as text.
 */
export type YoutubeLink = { id: string; start: number; url: string; title?: string };
export type TextSegment = { type: 'text'; text: string } | { type: 'youtube'; link: YoutubeLink };

export const MAX_YOUTUBE_TITLE = 100;
const TITLE_RE = /^ 〔([^〔〕\n]{1,100})〕/;

/** Display-only plain text: no brackets, line breaks or control characters, bounded length. */
export function cleanYoutubeTitle(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  // eslint-disable-next-line no-control-regex
  const t = raw.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069〔〕]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return null;
  return [...t].slice(0, MAX_YOUTUBE_TITLE).join('').trim();
}

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

/** Splits text into plain and YouTube segments; non-YouTube links stay as text. A title tag right after a link is consumed. */
export function splitYoutube(text: string): TextSegment[] {
  const out: TextSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const at = m.index ?? 0;
    if (at < last) continue;
    const raw = m[0].replace(/[).,!?;:]+$/, '');
    const link = parseYoutubeUrl(raw);
    if (!link) continue;
    if (at > last) out.push({ type: 'text', text: text.slice(last, at) });
    let end = at + raw.length;
    const tag = TITLE_RE.exec(text.slice(end));
    const title = tag ? cleanYoutubeTitle(tag[1]) : null;
    if (tag && title) { link.title = title; end += tag[0].length; }
    out.push({ type: 'youtube', link });
    last = end;
  }
  if (last < text.length) out.push({ type: 'text', text: text.slice(last) });
  return out.length ? out : [{ type: 'text', text }];
}

/** YouTube links in a draft that don't carry a title yet (unique by URL). */
export function untitledYoutubeLinks(text: string): YoutubeLink[] {
  const seen = new Set<string>();
  return splitYoutube(text).flatMap(s => s.type === 'youtube' && !s.link.title && !seen.has(s.link.url) && seen.add(s.link.url) ? [s.link] : []);
}

/** Inserts ` 〔title〕` after every untitled occurrence of `url`; titled links are left unchanged. */
export function withYoutubeTitle(text: string, url: string, rawTitle: string): string {
  const title = cleanYoutubeTitle(rawTitle);
  if (!title) return text;
  return splitYoutube(text).map(s => s.type === 'text' ? s.text
    : s.link.url + (s.link.title ? ` 〔${s.link.title}〕` : s.link.url === url ? ` 〔${title}〕` : '')).join('');
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

/** Proxied still picture from the default private mirror; only requested when the reader asks. */
export function privateThumbnailUrl(link: YoutubeLink): string {
  return new URL(`/vi/${encodeURIComponent(link.id)}/mqdefault.jpg`, INVIDIOUS_HOST).toString();
}

/**
 * Sender-side title lookup, only on an explicit tap. Tries the private Invidious mirrors, then
 * noembed.com (a third-party oEmbed proxy). Neither path contacts Google from the sender's browser;
 * whichever service answers sees the sender's IP. Returns null when nothing answers.
 */
export async function fetchYoutubeTitle(id: string, fetcher: typeof fetch = fetch): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
  const tryJson = async (url: string) => {
    try {
      const r = await fetcher(url, { referrerPolicy: 'no-referrer', credentials: 'omit', signal: AbortSignal.timeout(8000) });
      if (!r.ok) return null;
      const j = await r.json() as { title?: unknown };
      return cleanYoutubeTitle(j?.title);
    } catch { return null; }
  };
  for (const m of PRIVATE_YOUTUBE_MIRRORS) {
    if (m.tier !== 'invidious') continue;
    const t = await tryJson(`${m.host}/api/v1/videos/${id}?fields=title`);
    if (t) return t;
  }
  return tryJson(`https://noembed.com/embed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`);
}
