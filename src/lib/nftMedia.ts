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

/** An NFT counts as playable media when it carries an audio, clip or video field. */
export function isMusicNFT(data: Record<string, unknown>): boolean {
  return !!(data.audio || data.clip || data.video);
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
