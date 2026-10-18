// Shared music/sound NFT field detection (CHEESEAmp and CHEESECrypt).

export interface ExtraAudioEntry {
  label: string;
  url: string;
  key: string;
}

export interface NftMediaTrack {
  label: string;
  url: string;
}

type Resolve = (field: string) => string;

/** Canonical fields win; sound aliases must be references, not category tags. */
export function normalizeNftMedia(data: Record<string, unknown>): Record<string, unknown> {
  const normalized = { ...data };
  const value = (key: string) => {
    const v = data[key];
    return typeof v === 'string' && v.trim() ? v.trim() : undefined;
  };
  for (const field of ['audio', 'clip', 'video']) {
    const matchingKey = Object.keys(data).find(key => key.trim().toLowerCase() === field && value(key));
    normalized[field] = value(field) ?? (matchingKey ? value(matchingKey) : undefined);
  }
  if (!normalized.audio) {
    for (const alias of ['sound', 'mp3', 'sfx']) {
      const key = Object.keys(data).find(k => k.trim().toLowerCase() === alias && value(k));
      const reference = key ? value(key) : undefined;
      if (reference && /^(https?:\/\/|ipfs:\/\/|Qm|bafy|bafk)/.test(reference)) {
        normalized.audio = reference;
        break;
      }
    }
  }
  return normalized;
}

/** Only nonempty media fields count as playable. */
export function isMusicNFT(data: Record<string, unknown>): boolean {
  const normalized = normalizeNftMedia(data);
  return !!(normalized.audio || normalized.clip || normalized.video);
}

const EXTRA_AUDIO_PATTERN = /^(audio\s*\d+|track\s*\d+|fulltrack|full_audio|full_song|bonus_track)$/i;

export function extractExtraAudioUrls(allData: Record<string, unknown>, resolve: Resolve): ExtraAudioEntry[] {
  const entries: ExtraAudioEntry[] = [];
  const keys = Object.keys(allData).filter(k => EXTRA_AUDIO_PATTERN.test(k) && allData[k] && typeof allData[k] === 'string');
  keys.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  for (const key of keys) {
    const url = resolve(allData[key] as string);
    if (!url) continue;
    const num = key.match(/\d+/);
    const lower = key.toLowerCase();
    let label: string;
    if ((lower.startsWith('audio') || lower.startsWith('track')) && num) label = `Track ${num[0]}`;
    else if (lower.includes('full')) label = 'Full Track';
    else if (lower.includes('bonus')) label = 'Bonus Track';
    else label = key;
    entries.push({ label, url, key });
  }
  return entries;
}

/** Every playable track in preference order: main (audio → clip → video), video as Full Track when distinct, then extras. */
export function nftMediaTracks(allData: Record<string, unknown>, resolve: Resolve): NftMediaTrack[] {
  allData = normalizeNftMedia(allData);
  if (!isMusicNFT(allData)) return [];
  const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
  const main = str(allData.audio) ?? str(allData.clip) ?? str(allData.video);
  const tracks: NftMediaTrack[] = [];
  const add = (label: string, url: string) => { if (url && !tracks.some(t => t.url === url)) tracks.push({ label, url }); };
  if (main) add('Main', resolve(main));
  const video = str(allData.video);
  if (video) add('Full Track', resolve(video));
  for (const e of extractExtraAudioUrls(allData, resolve)) add(e.label, e.url);
  return tracks;
}
