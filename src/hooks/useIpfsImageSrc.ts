import { useCallback, useMemo, useState } from "react";
import { IPFS_GATEWAYS } from "@/lib/ipfsGateways";

// Shared hook: returns an image src that cycles through IPFS gateways on error.
export function useIpfsImageSrc(hash: string | undefined) {
  const [gatewayIdx, setGatewayIdx] = useState(0);

  const src = useMemo(() => {
    if (!hash) return "";
    if (hash.startsWith("http")) return hash;
    if (hash.startsWith("Qm") || hash.startsWith("bafy")) {
      return `${IPFS_GATEWAYS[gatewayIdx % IPFS_GATEWAYS.length]}${hash}`;
    }
    return hash;
  }, [hash, gatewayIdx]);

  const onError = useCallback(() => {
    setGatewayIdx(prev => (prev + 1 < IPFS_GATEWAYS.length ? prev + 1 : prev));
  }, []);

  return { src, onError };
}