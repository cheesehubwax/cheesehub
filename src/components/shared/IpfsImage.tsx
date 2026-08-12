import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { extractIpfsHash, preferredIpfsImageUrl, raceIpfsImage } from "@/lib/ipfsGateways";

interface IpfsImageProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackSrc?: string;
}

const WATCHDOG_MS = 3500;
const RACE_TIMEOUT_MS = 8000;

/**
 * Image that races the full IPFS source chain (public gateways plus the
 * AtomicHub image cache) in parallel and renders the first source that decodes.
 */
export function IpfsImage({ src, alt, className, fallbackSrc = "/placeholder.svg" }: IpfsImageProps) {
  const hash = useMemo(() => (src ? extractIpfsHash(src) : null), [src]);
  const preferredSrc = useMemo(() => (src ? preferredIpfsImageUrl(src) : null), [src]);
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const racingRef = useRef(false);

  useEffect(() => {
    setResolvedSrc(null);
    setFailed(false);
    setLoaded(false);
    racingRef.current = false;
  }, [src]);

  const currentSrc = useMemo(() => {
    if (failed || !src) return fallbackSrc;
    return resolvedSrc ?? preferredSrc ?? src;
  }, [failed, src, resolvedSrc, preferredSrc, fallbackSrc]);

  const startRace = useCallback(() => {
    if (!hash || racingRef.current) {
      if (!hash) setFailed(true);
      return;
    }
    racingRef.current = true;
    raceIpfsImage(hash, RACE_TIMEOUT_MS).then((winner) => {
      racingRef.current = false;
      if (winner) {
        setResolvedSrc(winner.url);
        setFailed(false);
      } else {
        setFailed(true);
      }
    });
  }, [hash]);

  // Some gateways hang instead of returning an error, so kick off the parallel
  // race on a short watchdog as well as on an explicit error.
  useEffect(() => {
    if (!hash || loaded || failed || resolvedSrc) return;
    const timer = setTimeout(startRace, WATCHDOG_MS);
    return () => clearTimeout(timer);
  }, [hash, loaded, failed, resolvedSrc, startRace]);

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      onError={startRace}
      onLoad={(e) => {
        if ((e.currentTarget as HTMLImageElement).naturalWidth === 0) startRace();
        else setLoaded(true);
      }}
    />
  );
}
