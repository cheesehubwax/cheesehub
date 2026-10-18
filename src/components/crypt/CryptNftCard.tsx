import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { IpfsImage } from '@/components/shared/IpfsImage';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { fetchAssetById } from '@/services/atomicApi';

export function CryptNftCard({ assetId }: { assetId: string }) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['crypt-nft', assetId], queryFn: () => fetchAssetById(assetId), staleTime: 3600_000 });
  const details = data
    ? `${data.name}\n${data.collection}${data.mint ? ` · #${data.mint}` : ''}\nID ${assetId}`
    : `${isLoading ? 'Loading NFT…' : 'NFT not found'}\nID ${assetId}`;
  return <>
    <button type="button" onClick={() => setOpen(true)} disabled={!data?.image}
      title={details} aria-label={`View larger: ${details.replace(/\n/g, ' · ')}`}
      className="block w-44 my-1 overflow-hidden rounded-md cursor-zoom-in disabled:cursor-default">
      {data?.image ? <IpfsImage src={data.image} alt={data.name} className="w-full h-auto object-contain" />
        : <div className="aspect-square w-full flex items-center justify-center text-2xl">{isLoading ? '⏳' : '🖼️'}</div>}
    </button>
    {data?.image && <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-3xl p-4">
        <DialogTitle className="text-primary">{data.name}</DialogTitle>
        <DialogDescription>{data.collection}{data.mint ? ` · #${data.mint}` : ''} · ID {assetId}</DialogDescription>
        <IpfsImage src={data.image} alt={data.name} className="w-full max-h-[75vh] object-contain rounded-md" />
      </DialogContent>
    </Dialog>}
  </>;
}
