import { useQuery } from '@tanstack/react-query';
import { IpfsImage } from '@/components/shared/IpfsImage';
import { fetchAssetById } from '@/services/atomicApi';

export function CryptNftCard({ assetId }: { assetId: string }) {
  const { data, isLoading } = useQuery({ queryKey: ['crypt-nft', assetId], queryFn: () => fetchAssetById(assetId), staleTime: 3600_000 });
  const details = data
    ? `${data.name}\n${data.collection}${data.mint ? ` · #${data.mint}` : ''}\nID ${assetId}`
    : `${isLoading ? 'Loading NFT…' : 'NFT not found'}\nID ${assetId}`;
  return <a href={`https://waxblock.io/nft/${encodeURIComponent(assetId)}`} target="_blank" rel="noreferrer"
    title={details} aria-label={details.replace(/\n/g, ' · ')} className="block w-44 my-1 overflow-hidden rounded-md">
    {data?.image ? <IpfsImage src={data.image} alt={data.name} className="w-full h-auto object-contain" />
      : <div className="aspect-square w-full flex items-center justify-center text-2xl">{isLoading ? '⏳' : '🖼️'}</div>}
  </a>;
}
