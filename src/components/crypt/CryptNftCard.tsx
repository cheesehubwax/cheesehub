import { useQuery } from '@tanstack/react-query';
import { IpfsImage } from '@/components/shared/IpfsImage';
import { fetchAssetById } from '@/services/atomicApi';

export function CryptNftCard({ assetId }: { assetId: string }) {
  const { data, isLoading } = useQuery({ queryKey: ['crypt-nft', assetId], queryFn: () => fetchAssetById(assetId), staleTime: 3600_000 });
  return <a href={`https://waxblock.io/nft/${encodeURIComponent(assetId)}`} target="_blank" rel="noreferrer"
    className="block w-44 rounded-md border border-cheese/30 bg-background/60 overflow-hidden my-1 hover:border-cheese/60">
    <div className="aspect-square bg-muted">
      {data?.image ? <IpfsImage src={data.image} alt={data.name} className="h-full w-full object-contain" />
        : <div className="h-full w-full flex items-center justify-center text-2xl">{isLoading ? '⏳' : '🖼️'}</div>}
    </div>
    <div className="px-2 py-1 text-[11px] leading-tight">
      <span className="block font-semibold truncate">{data?.name ?? (isLoading ? 'Loading NFT…' : 'NFT not found')}</span>
      <span className="block text-muted-foreground truncate">{data ? `${data.collection}${data.mint ? ` · #${data.mint}` : ''}` : ''}</span>
      <span className="block text-muted-foreground truncate">ID {assetId}</span>
    </div>
  </a>;
}
