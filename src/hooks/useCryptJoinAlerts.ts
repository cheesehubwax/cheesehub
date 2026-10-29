import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { JoinRequest } from '@/lib/cryptRooms';

export const joinAlertId = (account: string, r: JoinRequest) => `crypt-join:${account}:${r.groupId}:${r.from}:${r.time}`;

/** Local synthesized sound: no media request, and no bypass of browser audio consent. */
export function playJoinChime() {
  if (typeof AudioContext === 'undefined') return;
  const audio = new AudioContext();
  if (audio.state !== 'running') { void audio.close().catch(() => {}); return; }
  const tone = audio.createOscillator(), gain = audio.createGain();
  tone.connect(gain); gain.connect(audio.destination);
  tone.frequency.setValueAtTime(660, audio.currentTime);
  tone.frequency.setValueAtTime(880, audio.currentTime + 0.12);
  gain.gain.setValueAtTime(0.04, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.3);
  tone.start(); tone.stop(audio.currentTime + 0.3);
  tone.onended = () => { void audio.close().catch(() => {}); };
}

/** Toasts mirror the canonical pending list; reviewing never resolves a request. */
export function useCryptJoinAlerts(account: string, requests: JoinRequest[], ready: boolean,
  describe: (r: JoinRequest) => string, review: (r: JoinRequest) => void) {
  const seen = useRef(new Set<string>());
  const shown = useRef(new Set<string>());
  useEffect(() => {
    if (!ready) return;
    const pending = new Set(requests.map(r => joinAlertId(account, r)));
    for (const id of shown.current) if (!pending.has(id)) { toast.dismiss(id); shown.current.delete(id); }
    let arrived = false;
    for (const r of requests) {
      const id = joinAlertId(account, r);
      if (seen.current.has(id)) continue;
      seen.current.add(id); shown.current.add(id); arrived = true;
      toast(describe(r), { id, duration: Infinity, action: { label: 'Review', onClick: () => review(r) } });
    }
    if (arrived) { try { playJoinChime(); } catch { /* Audio permission is optional. */ } }
  }, [account, requests, ready, describe, review]);
  useEffect(() => () => { for (const id of shown.current) toast.dismiss(id); shown.current.clear(); }, [account]);
}