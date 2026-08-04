import { useCallback, useEffect, useMemo, useState } from "react";
import { IPFS_IMAGE_SOURCES, buildIpfsImageUrl, extractIpfsHash } from "@/lib/ipfsGateways";

interface IpfsImageProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackSrc?: string;
}

const SOURCE_TIMEOUT_MS = 6000;

/**
 * Image that walks the full IPFS source chain (public gateways, then the
 * AtomicHub image cache) before giving up on a placeholder.
 */
export function IpfsImage({ src, alt, className, fallbackSrc = "/placeholder.svg" }: IpfsImageProps) {
  const hash = useMemo(() => (src ? extractIpfsHash(src) : null), [src]);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setSourceIndex(0);
    setFailed(false);
    setLoaded(false);
  }, [src]);

  const currentSrc = useMemo(() => {
    if (failed || !src) return fallbackSrc;
    if (!hash) return src;
    return buildIpfsImageUrl(sourceIndex, hash);
  }, [failed, src, hash, sourceIndex, fallbackSrc]);

  const handleError = useCallback(() => {
    if (hash && sourceIndex < IPFS_IMAGE_SOURCES.length - 1) {
      setSourceIndex((prev) => prev + 1);
    } else {
      setFailed(true);
    }
  }, [hash, sourceIndex]);

  // Some gateways hang instead of returning an error, so advance on a timeout too.
  useEffect(() => {
    if (!hash || loaded || failed) return;
    const timer = setTimeout(handleError, SOURCE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [hash, loaded, failed, sourceIndex, handleError]);

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      onError={handleError}
      onLoad={(e) => {
        if ((e.currentTarget as HTMLImageElement).naturalWidth === 0) handleError();
        else setLoaded(true);
      }}
    />
  );
}
