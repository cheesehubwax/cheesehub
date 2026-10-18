import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { IpfsImage } from '@/components/shared/IpfsImage';
import { useMusicNFTs, type MusicNFT } from '@/hooks/useMusicNFTs';

/** Lists the account's NFTs that carry sound or video (songs, clips, sound effects). */
export function MusicNftPicker({ account, onPick }: { account: string; onPick: (nft: MusicNFT) => void }) {
  const { nfts, isLoading, error, refetch } = useMusicNFTs(account);
  useEffect(() => { if (!nfts.length && !isLoading) void refetch(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (isLoading && !nfts.length) return <p className="text-sm text-muted-foreground">Loading your music NFTs…</p>;
  if (error && !nfts.length) return <p className="text-sm text-destructive">Couldn't load your NFTs. <Button variant="link" className="h-auto p-0" onClick={() => void refetch()}>Try again</Button></p>;
  if (!nfts.length) return <p className="text-sm text-muted-foreground">No NFTs with sound or video found in {account}.</p>;
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {nfts.map(n => (
        <button key={n.asset_id} type="button" onClick={() => onPick(n)}
          className="text-left rounded-md border border-border p-1 hover:border-cheese focus-visible:border-cheese outline-none">
          {n.coverArt ? <IpfsImage src={n.coverArt} alt={n.name} className="w-full aspect-square object-cover rounded" />
            : <div className="w-full aspect-square flex items-center justify-center text-2xl">🎵</div>}
          <span className="block text-xs font-medium truncate mt-1">{n.title || n.name}</span>
          <span className="block text-[10px] text-muted-foreground truncate">{n.artist || n.collection} · #{n.mint}</span>
        </button>
      ))}
    </div>
  );
}
