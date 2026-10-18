import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { detectMime, recordingMime, VOICE_BITRATE, VOICE_MAX_BYTES, VOICE_MAX_MS, type VoiceClip } from '@/lib/cryptVoice';

/** Records one voice note (max 10 s / 12 KB) in memory. Nothing leaves the browser until the user sends. */
export function VoiceRecorder({ clip, onChange, disabled }: { clip: VoiceClip | null; onChange: (clip: VoiceClip | null) => void; disabled?: boolean }) {
  const mime = useMemo(recordingMime, []);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timers = useRef<number[]>([]);

  const url = useMemo(() => clip ? URL.createObjectURL(new Blob([clip.bytes as BlobPart], { type: clip.mime })) : null, [clip]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  const cleanup = () => {
    timers.current.forEach(t => { clearInterval(t); clearTimeout(t); }); timers.current = [];
    streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null;
  };
  useEffect(() => () => { if (recRef.current?.state === 'recording') recRef.current.stop(); cleanup(); }, []);

  const stop = () => { if (recRef.current?.state === 'recording') recRef.current.stop(); };

  const start = async () => {
    if (!mime) return;
    setError(null); onChange(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: VOICE_BITRATE });
      recRef.current = rec;
      const chunks: Blob[] = [];
      let size = 0, tooBig = false;
      const startedAt = Date.now();
      rec.ondataavailable = e => {
        if (!e.data.size) return;
        chunks.push(e.data); size += e.data.size;
        if (size > VOICE_MAX_BYTES) { tooBig = true; stop(); }
      };
      rec.onstop = async () => {
        const durationMs = Math.min(Date.now() - startedAt, VOICE_MAX_MS);
        cleanup(); setRecording(false);
        const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
        if (tooBig || bytes.length > VOICE_MAX_BYTES) setError('That recording is over 12 KB. Try a shorter note.');
        else if (!bytes.length) setError('Nothing was recorded.');
        else if (detectMime(bytes) !== mime) setError('This browser recorded an unsupported audio format.');
        else onChange({ bytes, mime, durationMs });
      };
      rec.start(250);
      setElapsed(0); setRecording(true);
      timers.current.push(window.setInterval(() => setElapsed(Date.now() - startedAt), 100));
      timers.current.push(window.setTimeout(stop, VOICE_MAX_MS));
    } catch {
      cleanup(); setRecording(false);
      setError('Microphone access was blocked or is unavailable.');
    }
  };

  if (!mime) return <Button size="sm" variant="outline" className="h-7 text-xs" disabled title="Voice notes are not supported in this browser">🎙️ Voice (not supported here)</Button>;

  const left = Math.max(0, Math.ceil((VOICE_MAX_MS - elapsed) / 1000));
  return (
    <span className="flex flex-wrap items-center gap-2">
      {recording ? (
        <Button size="sm" variant="outline" className="h-7 text-xs border-destructive text-destructive" onClick={stop} aria-label="Stop recording">
          <span className="relative mr-1 inline-block h-3 w-3 rounded-full bg-destructive animate-pulse" />⏹ Stop · {left}s
        </Button>
      ) : clip ? (
        <>
          {url && <audio src={url} controls className="h-8 max-w-[220px]" aria-label="Recorded voice note preview" />}
          <span className="text-muted-foreground">{(clip.durationMs / 1000).toFixed(1)} s · {(clip.bytes.length / 1024).toFixed(1)} KB</span>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onChange(null)} disabled={disabled}>🗑️ Discard</Button>
        </>
      ) : (
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={start} disabled={disabled}>🎙️ Voice</Button>
      )}
      {recording && <span className="h-1.5 w-20 rounded-full bg-muted overflow-hidden" aria-hidden><span className="block h-full bg-cheese transition-[width]" style={{ width: `${Math.min(100, (elapsed / VOICE_MAX_MS) * 100)}%` }} /></span>}
      {error && <span className="text-destructive">{error}</span>}
    </span>
  );
}
