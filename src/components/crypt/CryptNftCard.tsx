import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pause, Play, Loader2 } from 'lucide-react';
import { IpfsImage } from '@/components/shared/IpfsImage';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { fetchAssetById } from '@/services/atomicApi';
import { announcePlaying, cryptAudio, mediaCandidates } from '@/lib/cryptAudio';
import { formatTime, getAudioPlayer } from '@/lib/musicPlayer';

function TrackControl({ trackKey, url, label, hiddenUntilHover }: { trackKey: string; url: string; label?: string; hiddenUntilHover?: boolean }) {
  const s = useSyncExternalStore(cryptAudio.subscribe, cryptAudio.getState);
  const mine = s.key === trackKey;
  if (s.failedKeys.has(trackKey)) return <span className="text-xs italic opacity-80">🔇 Sound unavailable{label ? ` (${label})` : ''}</span>;
  const pct = mine && s.duration ? Math.min(100, (s.time / s.duration) * 100) : 0;
  const hoverHide = hiddenUntilHover && !(mine && s.playing);
  return (
    <span className={`flex items-center gap-2 min-w-[160px] transition-opacity duration-150 ${hoverHide ? 'opacity-0 group-hover:opacity-100 focus-within:opacity-100' : ''}`}>
      <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-cheese" onClick={() => cryptAudio.toggle(trackKey, url)}
        aria-label={mine && s.playing ? `Pause ${label ?? 'sound'}` : `Play ${label ?? 'sound'}`}>
        {mine && s.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : mine && s.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      {label && <span className="text-xs truncate max-w-[90px]">{label}</span>}
      <input type="range" min={0} max={mine && s.duration ? s.duration : 1} step={0.1} value={mine ? s.time : 0} disabled={!mine || !s.duration}
        onChange={e => cryptAudio.seek(trackKey, Number(e.target.value))} aria-label="Seek"
        className="h-1.5 flex-1 accent-[hsl(var(--cheese))]" style={{ backgroundSize: `${pct}% 100%` }} />
      <span className="text-[11px] tabular-nums opacity-80">{mine ? `${formatTime(s.time)}${s.duration ? ` / ${formatTime(s.duration)}` : ''}` : '🎵'}</span>
    </span>
  );
}

/**
 * Video player for NFTs whose `video` field is real video media. Cycles through the
 * direct URL and every IPFS gateway on error (same candidates as chat audio), and
 * pauses chat sounds, voice notes and CHEESEAmp when it starts playing.
 */
function CryptVideo({ url, poster, label }: { url: string; poster?: string; label: string }) {
  const candidates = useMemo(() => mediaCandidates(url), [url]);
  const [idx, setIdx] = useState(0);
  const [failed, setFailed] = useState(false);
  if (failed) return <p className="text-xs italic opacity-80">📹 Video unavailable</p>;
  return (
    <video key={candidates[idx]} src={candidates[idx]} poster={poster || undefined} controls playsInline preload="metadata"
      className="w-full max-h-[60vh] rounded-md bg-muted" aria-label={label}
      onPlay={() => { getAudioPlayer().pause(); announcePlaying('crypt-video'); }}
      onError={() => { if (idx + 1 < candidates.length) setIdx(idx + 1); else setFailed(true); }} />
  );
}

/** Message keys whose sound effect already autoplayed this session (never replay on re-render or poll). */
const autoplayed = new Set<string>();

function TxLink({ txId }: { txId: string }) {
  return <a href={`https://waxblock.io/transaction/${encodeURIComponent(txId)}`} target="_blank" rel="noreferrer"
    className="font-semibold text-cheese underline underline-offset-2 hover:text-cheese/80">Transaction {txId.slice(0, 8)}…</a>;
}

/**
 * Sound-effect NFTs: a borderless tile (25% smaller than other NFTs) — click the picture to play/stop,
 * autoplays once when it arrives while the chat is open, no caption, no dialog.
 * Video NFTs: the tile shows a ▶ overlay and the larger view plays the video; a music NFT with an
 * attached music video keeps streaming audio in the bubble and gets a "Watch video" toggle instead.
 * Every other NFT: a tile that opens a larger view with picture, name, collection, asset ID and transaction link.
 * `autoplayKey` is set only for messages that arrived while the chat was open.
 */
export function CryptNftCard({ assetId, autoplayKey, txId }: { assetId: string; autoplayKey?: string; txId?: string }) {
  const [open, setOpen] = useState(false);
  const [watchVideo, setWatchVideo] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['crypt-nft', assetId], queryFn: () => fetchAssetById(assetId), staleTime: 3600_000 });
  const audioState = useSyncExternalStore(cryptAudio.subscribe, cryptAudio.getState);
  const tracks = data?.tracks ?? [];
  const video = data?.video;
  // Tracks that are just the video file streamed as audio stay out of the bubble for video-only NFTs.
  const audioTracks = tracks.filter(t => t.url !== video);
  const videoOnly = !!video && audioTracks.length === 0;
  const sfxKey = `${assetId}:0`;
  useEffect(() => {
    if (!autoplayKey || !data?.isSfx || !tracks.length || autoplayed.has(autoplayKey)) return;
    autoplayed.add(autoplayKey);
    cryptAudio.toggle(sfxKey, tracks[0].url);
  }, [autoplayKey, data, tracks, sfxKey]);
  const heading = data ? (data.title || data.name) : '';
  const hasImage = !!data?.image && data.image !== '/placeholder.svg';
  const picture = (cls: string) => hasImage ? <IpfsImage src={data!.image} alt={data!.name} className={cls} />
    : <div className="aspect-square w-full flex items-center justify-center text-2xl">{isLoading ? '⏳' : tracks.length ? '🎵' : video ? '🎬' : '🖼️'}</div>;

  if (!data) return <span className="block w-44 my-1 text-xs italic opacity-80">{isLoading ? '⏳ Loading NFT…' : `🖼️ NFT #${assetId} (unavailable)`}</span>;

  if (data.isSfx) {
    const playing = audioState.key === sfxKey && audioState.playing;
    const failed = audioState.failedKeys.has(sfxKey);
    return (
      <span className="block w-36 my-1">
        <button type="button" disabled={!tracks.length || failed} onClick={() => tracks[0] && cryptAudio.toggle(sfxKey, tracks[0].url)}
          aria-label={`${playing ? 'Stop' : 'Play'} sound effect ${heading}`} aria-pressed={playing}
          className={`block w-full cursor-pointer disabled:cursor-default transition-transform ${playing ? 'scale-95' : 'hover:scale-[1.03]'}`}>
          {picture('w-full h-auto object-contain')}
        </button>
        {failed && <span className="text-xs italic opacity-80">🔇 Sound unavailable</span>}
      </span>
    );
  }

  const showVideo = !!video && (videoOnly || watchVideo);
  return <>
    <span className={`group my-1 space-y-1 block ${audioTracks.length ? 'w-56' : 'w-48'}`}>
      <button type="button" onClick={() => setOpen(true)} aria-label={`View ${heading} larger`}
        className="relative block w-full cursor-zoom-in overflow-hidden rounded-md">
        {picture('w-full h-auto object-contain')}
        {video && <span className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden>
          <span className="rounded-full bg-background/70 text-cheese text-lg px-3 py-1.5">▶</span>
        </span>}
      </button>
      {audioTracks.length > 0 && <TrackControl trackKey={sfxKey} url={audioTracks[0].url} />}
    </span>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-3xl p-4 max-h-[90dvh] overflow-y-auto">
        <DialogTitle className="text-primary">{heading}</DialogTitle>
        <DialogDescription>
          {[data.artist, data.collection, data.mint && `#${data.mint}`].filter(Boolean).join(' · ')}{' · '}
          <a className="underline underline-offset-2" target="_blank" rel="noreferrer"
            href={`https://atomichub.io/explorer/asset/wax-mainnet/${encodeURIComponent(assetId)}`}>ID {assetId}</a>
        </DialogDescription>
        {showVideo
          ? <CryptVideo url={video!} poster={hasImage ? data.image : undefined} label={`Video for ${heading}`} />
          : hasImage && <IpfsImage src={data.image} alt={data.name} className="w-full max-h-[60vh] object-contain rounded-md" />}
        {video && !videoOnly && (
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 px-2 text-cheese" onClick={() => setWatchVideo(v => !v)}>
            {watchVideo ? '🎵 Back to audio' : '🎬 Watch video'}
          </Button>
        )}
        {tracks.length > 0 && <div className="space-y-1">
          {tracks.map((t, i) => ({ t, i })).filter(({ t }) => !(videoOnly && t.url === video))
            .map(({ t, i }) => <TrackControl key={i} trackKey={`${assetId}:${i}`} url={t.url} label={tracks.length > 1 ? (i === 0 ? 'Main' : t.label) : undefined} />)}
        </div>}
        {txId && <p className="text-xs"><TxLink txId={txId} /></p>}
      </DialogContent>
    </Dialog>
  </>;
}
