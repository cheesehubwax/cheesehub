import { memo, useEffect, useMemo, useState } from "react";
import { Image as ImageIcon } from "lucide-react";
import { extractIpfsHash, ipfsImageCandidates } from "@/lib/ipfsGateways";

/** Candidate URLs for a raw NFT img value: AtomicHub cache, then IPFS gateways. */
export function nftImageCandidates(image: string | undefined): string[] {
  if (!image) return [];
  const hash = extractIpfsHash(image);
  return hash ? ipfsImageCandidates(hash) : [image];
}

/** NFT tile picture that walks the shared gateway list on error, then shows a placeholder. */
export const TreasuryNftImage = memo(function TreasuryNftImage({ image, name }: { image?: string; name: string }) {
  const candidates = useMemo(() => nftImageCandidates(image), [image]);
  const [idx, setIdx] = useState(0);
  useEffect(() => setIdx(0), [candidates]);

  if (idx >= candidates.length) {
    return (
      <div className="w-full h-full bg-muted flex items-center justify-center">
        <ImageIcon className="h-4 w-4 text-muted-foreground" />
      </div>
    );
  }
  return (
    <img src={candidates[idx]} alt={name} loading="lazy" className="w-full h-full object-cover" onError={() => setIdx(i => i + 1)} />
  );
});
