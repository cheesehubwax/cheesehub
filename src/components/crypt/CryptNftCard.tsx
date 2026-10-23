import { useEffect, useState, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pause, Play, Loader2 } from 'lucide-react';
import { IpfsImage } from '@/components/shared/IpfsImage';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { fetchAssetById } from '@/services/atomicApi';
import { cryptAudio } from '@/lib/cryptAudio';
import { formatTime } from '@/lib/musicPlayer';

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

/** Message keys whose sound effect already autoplayed this session (never replay on re-render or poll). */
const autoplayed = new Set<string>();

function TxLink({ txId }: { txId: string }) {
  return <a href={`https://waxblock.io/transaction/${encodeURIComponent(txId)}`} target="_blank" rel="noreferrer"
    className="font-semibold text-cheese underline underline-offset-2 hover:text-cheese/80">Transaction {txId.slice(0, 8)}…</a>;
}

/**
 * Sound-effect NFTs: a borderless tile (25% smaller than other NFTs) — click the picture to play/stop,
 * autoplays once when it arrives while the chat is open, no caption, no dialog.
 * Every other NFT: a tile that opens a larger view with picture, name, collection, asset ID and transaction link.
 * `autoplayKey` is set only for messages that arrived while the chat was open.
 */
export function CryptNftCard({ assetId, autoplayKey, txId }: { assetId: string; autoplayKey?: string; txId?: string }) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['crypt-nft', assetId], queryFn: () => fetchAssetById(assetId), staleTime: 3600_000 });
  const audioState = useSyncExternalStore(cryptAudio.subscribe, cryptAudio.getState);
  const tracks = data?.tracks ?? [];
  const sfxKey = `${assetId}:0`;
  useEffect(() => {
    if (!autoplayKey || !data?.isSfx || !tracks.length || autoplayed.has(autoplayKey)) return;
    autoplayed.add(autoplayKey);
    cryptAudio.toggle(sfxKey, tracks[0].url);
  }, [autoplayKey, data, tracks, sfxKey]);
  const heading = data ? (data.title || data.name) : '';
  const hasImage = !!data?.image && data.image !== '/placeholder.svg';
  const picture = (cls: string) => hasImage ? <IpfsImage src={data!.image} alt={data!.name} className={cls} />
    : <div className="aspect-square w-full flex items-center justify-center text-2xl">{isLoading ? '⏳' : tracks.length ? '🎵' : '🖼️'}</div>;

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

  return <>
    <span className={`group my-1 space-y-1 block ${tracks.length ? 'w-56' : 'w-48'}`}>
      <button type="button" onClick={() => setOpen(true)} aria-label={`View ${heading} larger`}
        className="block w-full cursor-zoom-in overflow-hidden rounded-md">
        {picture('w-full h-auto object-contain')}
      </button>
      {tracks.length > 0 && <TrackControl trackKey={sfxKey} url={tracks[0].url} />}
    </span>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-3xl p-4 max-h-[90dvh] overflow-y-auto">
        <DialogTitle className="text-primary">{heading}</DialogTitle>
        <DialogDescription>
          {[data.artist, data.collection, data.mint && `#${data.mint}`].filter(Boolean).join(' · ')}{' · '}
          <a className="underline underline-offset-2" target="_blank" rel="noreferrer"
            href={`https://atomichub.io/explorer/asset/wax-mainnet/${encodeURIComponent(assetId)}`}>ID {assetId}</a>
        </DialogDescription>
        {hasImage && <IpfsImage src={data.image} alt={data.name} className="w-full max-h-[60vh] object-contain rounded-md" />}
        {tracks.length > 0 && <div className="space-y-1">
          {tracks.map((t, i) => <TrackControl key={i} trackKey={`${assetId}:${i}`} url={t.url} label={tracks.length > 1 ? (i === 0 ? 'Main' : t.label) : undefined} />)}
        </div>}
        {txId && <p className="text-xs"><TxLink txId={txId} /></p>}
      </DialogContent>
    </Dialog>
  </>;
}
