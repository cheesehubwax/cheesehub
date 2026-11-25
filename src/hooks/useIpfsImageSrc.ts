import { useCallback, useMemo, useState } from "react";
import { ipfsImageCandidates } from "@/lib/ipfsGateways";

// Shared hook for farm/DAO logos and banners: AtomicHub mirrors first, then
// public IPFS gateways, advancing one candidate on each load error.
export function useIpfsImageSrc(hash: string | undefined) {
  const [idx, setIdx] = useState(0);

  const candidates = useMemo(() => {
    if (!hash) return [] as string[];
    if (hash.startsWith("http")) return [hash];
    if (hash.startsWith("Qm") || hash.startsWith("baf")) return ipfsImageCandidates(hash);
    return [hash];
  }, [hash]);

  const src = candidates.length ? candidates[Math.min(idx, candidates.length - 1)] : "";

  const onError = useCallback(() => {
    setIdx(prev => (prev + 1 < candidates.length ? prev + 1 : prev));
  }, [candidates.length]);

  return { src, onError };
}
