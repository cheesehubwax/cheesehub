import { useState, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pause, Play, Loader2 } from 'lucide-react';
import { IpfsImage } from '@/components/shared/IpfsImage';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { fetchAssetById } from '@/services/atomicApi';
import { cryptAudio } from '@/lib/cryptAudio';
import { formatTime } from '@/lib/musicPlayer';

function TrackControl({ trackKey, url, label }: { trackKey: string; url: string; label?: string }) {
  const s = useSyncExternalStore(cryptAudio.subscribe, cryptAudio.getState);
  const mine = s.key === trackKey;
  if (s.failedKeys.has(trackKey)) return <span className="text-xs italic opacity-80">🔇 Sound unavailable{label ? ` (${label})` : ''}</span>;
  const pct = mine && s.duration ? Math.min(100, (s.time / s.duration) * 100) : 0;
  return (
    <span className="flex items-center gap-2 min-w-[160px]">
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

/** Message keys whose sound effect already autoplayed this session (never replay on re-render or poll). */
const autoplayed = new Set<string>();

/** `autoplayKey` is set only for messages that arrived while the chat was open; sound-effect NFTs then play once. */
export function CryptNftCard({ assetId, autoplayKey }: { assetId: string; autoplayKey?: string }) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['crypt-nft', assetId], queryFn: () => fetchAssetById(assetId), staleTime: 3600_000 });
  const tracks = data?.tracks ?? [];
  useEffect(() => {
    if (!autoplayKey || !data?.isSfx || !tracks.length || autoplayed.has(autoplayKey)) return;
    autoplayed.add(autoplayKey);
    cryptAudio.toggle(`${assetId}:0`, tracks[0].url);
  }, [autoplayKey, data, tracks, assetId]);
  const heading = data ? (data.title || data.name) : '';
  const details = data
    ? `${heading}${data.artist ? `\n${data.artist}` : ''}\n${data.collection}${data.mint ? ` · #${data.mint}` : ''}\nID ${assetId}`
    : `${isLoading ? 'Loading NFT…' : 'NFT not found'}\nID ${assetId}`;
  const meta = data ? `${data.artist ? `${data.artist} · ` : ''}${data.collection}${data.mint ? ` · #${data.mint}` : ''} · ID ${assetId}` : '';
  const hasImage = !!data?.image && data.image !== '/placeholder.svg';
  return <>
    <span className={tracks.length ? 'block w-56 my-1 space-y-1' : 'contents'}>
      <button type="button" onClick={() => setOpen(true)} disabled={!data}
        title={details} aria-label={`View larger: ${details.replace(/\n/g, ' · ')}`}
        className={`block ${tracks.length ? 'w-full' : 'w-44 my-1'} overflow-hidden rounded-md cursor-zoom-in disabled:cursor-default`}>
        {hasImage ? <IpfsImage src={data!.image} alt={data!.name} className="w-full h-auto object-contain" />
          : <div className="aspect-square w-full flex items-center justify-center text-2xl">{isLoading ? '⏳' : tracks.length ? '🎵' : '🖼️'}</div>}
      </button>
      {tracks.length > 0 && <TrackControl trackKey={`${assetId}:0`} url={tracks[0].url} />}
    </span>
    {data && <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-3xl p-4 max-h-[90dvh] overflow-y-auto">
        <DialogTitle className="text-primary">{heading}</DialogTitle>
        <DialogDescription>{meta}</DialogDescription>
        {hasImage && <IpfsImage src={data.image} alt={data.name} className="w-full max-h-[60vh] object-contain rounded-md" />}
        {tracks.length > 0 && <div className="space-y-1">
          {tracks.map((t, i) => <TrackControl key={i} trackKey={`${assetId}:${i}`} url={t.url} label={tracks.length > 1 ? (i === 0 ? 'Main' : t.label) : undefined} />)}
        </div>}
      </DialogContent>
    </Dialog>}
  </>;
}
