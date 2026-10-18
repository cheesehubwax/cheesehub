// One shared player for music/sound NFTs inside CHEESECrypt chats.
// Only one sound plays at a time across chat NFTs, voice notes and CHEESEAmp.
import { getAudioPlayer } from '@/lib/musicPlayer';
import { IPFS_GATEWAYS, extractIpfsHash } from '@/lib/ipfsGateways';

export const CRYPT_NOW_PLAYING = 'cheesecrypt-now-playing';

export interface CryptAudioState {
  key: string | null;
  playing: boolean;
  loading: boolean;
  time: number;
  duration: number;
  failedKeys: ReadonlySet<string>;
}

/** Direct URL first, then every gateway for its IPFS hash (deduplicated). */
export function mediaCandidates(url: string): string[] {
  const out = [url];
  const hash = extractIpfsHash(url);
  if (hash) for (const g of IPFS_GATEWAYS) out.push(`${g}${hash}`);
  return [...new Set(out)];
}

let audio: HTMLAudioElement | null = null;
let state: CryptAudioState = { key: null, playing: false, loading: false, time: 0, duration: 0, failedKeys: new Set() };
const listeners = new Set<() => void>();
let candidates: string[] = [];
let attempt = 0;

const set = (patch: Partial<CryptAudioState>) => { state = { ...state, ...patch }; listeners.forEach(l => l()); };

/** Tell voice notes (and other listeners) that something else started playing. */
export function announcePlaying(source: string) {
  window.dispatchEvent(new CustomEvent(CRYPT_NOW_PLAYING, { detail: source }));
}

function element(): HTMLAudioElement {
  if (audio) return audio;
  const el = new Audio();
  el.preload = 'auto';
  el.addEventListener('playing', () => set({ playing: true, loading: false }));
  el.addEventListener('pause', () => set({ playing: false }));
  el.addEventListener('ended', () => set({ playing: false, time: 0 }));
  el.addEventListener('timeupdate', () => set({ time: el.currentTime }));
  el.addEventListener('durationchange', () => set({ duration: isFinite(el.duration) ? el.duration : 0 }));
  el.addEventListener('error', () => {
    if (!state.key || !el.getAttribute('src')) return;
    attempt += 1;
    if (attempt < candidates.length) { el.src = candidates[attempt]; void el.play().catch(() => {}); return; }
    const failed = new Set(state.failedKeys); failed.add(state.key);
    set({ playing: false, loading: false, failedKeys: failed });
  });
  window.addEventListener(CRYPT_NOW_PLAYING, (e) => { if ((e as CustomEvent).detail !== 'crypt-nft') el.pause(); });
  // CHEESEAmp starting playback pauses chat sounds.
  getAudioPlayer().subscribe(s => { if (s.isPlaying && !el.paused) el.pause(); });
  audio = el;
  return el;
}

export const cryptAudio = {
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
  getState: () => state,
  /** Press play/pause on a track identified by `key`; switching keys restarts from the start. */
  toggle(key: string, url: string) {
    const el = element();
    if (state.key === key && el.getAttribute('src')) {
      if (el.paused) { getAudioPlayer().pause(); announcePlaying('crypt-nft'); void el.play().catch(() => {}); }
      else el.pause();
      return;
    }
    getAudioPlayer().pause();
    announcePlaying('crypt-nft');
    candidates = mediaCandidates(url); attempt = 0;
    const failed = new Set(state.failedKeys); failed.delete(key);
    set({ key, playing: false, loading: true, time: 0, duration: 0, failedKeys: failed });
    el.src = candidates[0];
    void el.play().catch(() => {});
  },
  seek(key: string, time: number) {
    if (audio && state.key === key) audio.currentTime = time;
  },
};
