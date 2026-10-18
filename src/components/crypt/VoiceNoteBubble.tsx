import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { VoiceNote } from '@/lib/cryptVoice';
import { CRYPT_NOW_PLAYING, announcePlaying } from '@/lib/cryptAudio';
import { getAudioPlayer } from '@/lib/musicPlayer';

/** Plays a voice note only when every part arrived and the audio passed its integrity check. */
export function VoiceNoteBubble({ note }: { note: VoiceNote }) {
  const canPlay = useMemo(() => {
    if (!note.mime || typeof document === 'undefined') return false;
    try { return document.createElement('audio').canPlayType(note.mime) !== ''; } catch { return false; }
  }, [note.mime]);
  const url = useMemo(() => note.status === 'ready' && note.audio && canPlay ? URL.createObjectURL(new Blob([note.audio as BlobPart], { type: note.mime! })) : null, [note.status, note.audio, note.mime, canPlay]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  const id = useMemo(() => `voice-${Math.random().toString(36).slice(2)}`, []);
  useEffect(() => {
    const onOther = (e: Event) => { if ((e as CustomEvent).detail !== id) audioRef.current?.pause(); };
    window.addEventListener(CRYPT_NOW_PLAYING, onOther);
    return () => window.removeEventListener(CRYPT_NOW_PLAYING, onOther);
  }, [id]);
  const seconds = ((note.durationMs ?? 0) / 1000).toFixed(1);

  if (note.status === 'loading') return <span className="italic opacity-80">🎙️ Voice note loading ({note.received}/{note.total} parts)</span>;
  if (note.status === 'incomplete') return <span className="italic opacity-80">🎙️ Voice note incomplete ({note.received}/{note.total} parts) — it can’t be played.</span>;
  if (note.status === 'invalid') return <span className="italic opacity-80">🎙️ Voice note damaged — it failed its integrity check and won’t be played.</span>;
  if (!url) return <span className="italic opacity-80">🎙️ Voice note ({seconds} s) — not supported in this browser.</span>;

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) { getAudioPlayer().pause(); announcePlaying(id); } if (el.paused) void el.play().catch(() => setPlaying(false)); else el.pause();
  };
  const total = (note.durationMs ?? 0) / 1000 || 1;
  return (
    <span className="flex items-center gap-2 min-w-[180px]">
      <audio ref={audioRef} src={url} preload="auto" className="hidden"
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setAt(0); }} onTimeUpdate={e => setAt(e.currentTarget.currentTime)} />
      <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-cheese" onClick={toggle} aria-label={playing ? 'Pause voice note' : 'Play voice note'}>
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <span className="h-1.5 flex-1 rounded-full bg-background/60 overflow-hidden" aria-hidden>
        <span className="block h-full bg-cheese" style={{ width: `${Math.min(100, (at / total) * 100)}%` }} />
      </span>
      <span className="text-[11px] tabular-nums opacity-80">🎙️ {seconds} s</span>
    </span>
  );
}
