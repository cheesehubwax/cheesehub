import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { Check, Loader2, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractIpfsHash, getIpfsUrl, ipfsImageCandidates, isVideoUrl } from "@/lib/ipfsGateways";
import { queueNftImage } from "@/lib/nftImageQueue";
import { observeNftVisibility } from "@/lib/nftVisibility";
import { routedImageUrl } from "@/lib/cryptMediaProxy";

// Session memory of artwork that already loaded, keyed by the NFT's image field.
// Remounted tiles (virtualized scrolling) show it instantly without re-queuing.
const loadedNftImages = new Map<string, string>();
const MAX_LOADED_NFT_IMAGES = 5000;
function rememberLoaded(key: string, url: string) {
  if (loadedNftImages.size >= MAX_LOADED_NFT_IMAGES) {
    const oldest = loadedNftImages.keys().next().value;
    if (oldest !== undefined) loadedNftImages.delete(oldest);
  }
  loadedNftImages.set(key, url);
}

export interface NFTGridCardData {
  asset_id: string;
  name: string;
  image: string;
  collection: string;
  schema?: string;
  template_id?: string;
  mint?: string;
}

interface NFTGridCardProps {
  nft: NFTGridCardData;
  isSelected: boolean;
  onToggle: () => void;
  disabled?: boolean;
  extraBadge?: React.ReactNode;
  extraHoverContent?: React.ReactNode;
  borderClass?: string;
  /** Loopback Tor helper: artwork loads only from it, never from public gateways. */
  torBase?: string;
}

export const NFTGridCard = React.memo(function NFTGridCard({
  nft,
  isSelected,
  onToggle,
  disabled,
  extraBadge,
  extraHoverContent,
  borderClass,
  torBase,
}: NFTGridCardProps) {
  // Tor-routed artwork never reuses a URL remembered from a public gateway.
  const cacheKey = torBase ? `tor|${nft.image}` : nft.image;
  const [gatewayIndex, setGatewayIndex] = useState(0);
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(() => loadedNftImages.has(cacheKey));
  const [cachedUrl, setCachedUrl] = useState<string | undefined>(() => loadedNftImages.get(cacheKey));
  // Video-only NFTs (or images that never load) fall back to a muted raw-gateway preview.
  const [videoMode, setVideoMode] = useState(() => isVideoUrl(nft.image));
  const [retryCount, setRetryCount] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    return observeNftVisibility(card, setVisible);
  }, []);

  // Bundled copies load from the app itself; other IPFS artwork goes via the helper.
  const torUrl = useMemo(() => (torBase ? routedImageUrl({ kind: 'tor', base: torBase }, nft.image) : null), [torBase, nft.image]);
  const hasValidImage = Boolean(nft.image && nft.image !== "/placeholder.svg") && (!torBase || !!torUrl);
  const ipfsHash = useMemo(() => extractIpfsHash(nft.image), [nft.image]);
  const imageCandidates = useMemo(() => {
    if (torBase) return [torUrl ?? "/placeholder.svg"];
    const hash = ipfsHash;
    return hash ? ipfsImageCandidates(hash) : [nft.image || "/placeholder.svg"];
  }, [torBase, torUrl, ipfsHash, nft.image]);

  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    const cached = loadedNftImages.get(cacheKey);
    setGatewayIndex(0);
    setImgError(false);
    setImgLoaded(Boolean(cached));
    setCachedUrl(cached);
    setVideoMode(isVideoUrl(nft.image));
    setRetryCount(0);
  }, [nft.asset_id, nft.image, cacheKey]);

  const currentImageUrl = useMemo(() => {
    if (!nft.image || nft.image === "/placeholder.svg") return "/placeholder.svg";
    if (cachedUrl) return cachedUrl;
    const baseUrl = imageCandidates[gatewayIndex] ?? imageCandidates[0];
    const sep = baseUrl.includes("?") ? "&" : "?";
    return retryCount > 0 ? `${baseUrl}${sep}retry=${retryCount}` : baseUrl;
  }, [nft.image, cachedUrl, imageCandidates, gatewayIndex, retryCount]);

  const handleImageError = useCallback(() => {
    if (cachedUrl) {
      loadedNftImages.delete(cacheKey);
      setCachedUrl(undefined);
      setImgLoaded(false);
      return;
    }
    if (gatewayIndex < imageCandidates.length - 1) {
      setGatewayIndex((p) => p + 1);
      setImgLoaded(false);
    } else if (ipfsHash && !videoMode) {
      setVideoMode(true);
    } else {
      setImgError(true);
    }
  }, [cachedUrl, cacheKey, imageCandidates.length, gatewayIndex, ipfsHash, videoMode]);

  const markLoaded = useCallback(() => {
    rememberLoaded(cacheKey, currentImageUrl);
    setImgLoaded(true);
  }, [cacheKey, currentImageUrl]);

  // The deadline starts only once a pool slot is granted, not while waiting
  // behind other tiles. Off-screen/unmounted requests release their slot.
  useEffect(() => {
    if (!visible || !hasValidImage || imgError || imgLoaded || videoMode) return;
    return queueNftImage(currentImageUrl, markLoaded, handleImageError);
  }, [visible, hasValidImage, imgError, imgLoaded, videoMode, currentImageUrl, markLoaded, handleImageError]);

  const videoUrl = useMemo(() => {
    if (!videoMode) return "";
    if (torBase) return torUrl ?? "";
    if (ipfsHash) return getIpfsUrl(ipfsHash);
    return nft.image;
  }, [videoMode, torBase, torUrl, ipfsHash, nft.image]);

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImgError(false);
    setImgLoaded(false);
    setCachedUrl(undefined);
    setVideoMode(isVideoUrl(nft.image));
    setGatewayIndex(0);
    setRetryCount((p) => p + 1);
  };

  const showErrorState = !hasValidImage || imgError;

  const card = (
    <div
      ref={cardRef}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={disabled ? undefined : onToggle}
      onKeyDown={disabled ? undefined : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
      className={cn(
        "group relative w-full aspect-square rounded-md overflow-hidden border-2 transition-all hover:opacity-90",
        disabled && "opacity-50 cursor-not-allowed grayscale-[30%]",
        isSelected
          ? "border-primary ring-1 ring-primary"
          : borderClass || "border-transparent hover:border-muted-foreground/30"
      )}
    >
      {/* Badge overlay – absolute full-card so children inherit z-30 stacking */}
      <div className="absolute inset-0 z-30 pointer-events-none">{extraBadge}</div>
      {isSelected && (
        <div className="absolute top-1 right-1 z-30 rounded-full p-0.5 bg-primary">
          <Check className="h-3 w-3 text-primary-foreground" />
        </div>
      )}
      <div className="w-full h-full bg-muted flex items-center justify-center">
        {showErrorState ? (
          <div
            role="button"
            tabIndex={0}
            className="w-full h-full flex flex-col items-center justify-center bg-muted/50 cursor-pointer hover:bg-muted/80 transition-colors z-20"
            onClick={handleRetry}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRetry(e as any); } }}
            title="Click to retry loading image"
          >
            <ImageIcon className="h-5 w-5 text-primary mb-1" />
            <span className="text-[9px] text-primary font-medium">Retry</span>
          </div>
        ) : videoMode ? (
          visible ? (
            <video
              src={videoUrl}
              className="w-full h-full object-cover pointer-events-none"
              muted
              loop
              autoPlay
              playsInline
              preload="metadata"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
            </div>
          )
        ) : (
          <>
            {!imgLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted">
                <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
              </div>
            )}
            {imgLoaded && <img
              src={currentImageUrl}
              alt={nft.name}
              className={cn(
                "w-full h-full object-cover transition-opacity",
                imgLoaded ? "opacity-100" : "opacity-0"
              )}
              onError={handleImageError}
              onLoad={(e) => {
                const t = e.target as HTMLImageElement;
                if (t.naturalWidth === 0) handleImageError();
                else markLoaded();
              }}
            />}
          </>
        )}
      </div>
    </div>
  );

  return (
    <HoverCard openDelay={300} closeDelay={100}>
      <HoverCardTrigger asChild>{card}</HoverCardTrigger>
      <HoverCardContent side="top" collisionPadding={16} align="center" className="w-64 max-w-xs p-3 text-xs space-y-1">
        <p className="font-bold text-sm break-words whitespace-normal">{nft.name}</p>
        <div className="flex justify-between"><span className="text-cheese">Asset ID</span><span className="font-mono">{nft.asset_id}</span></div>
        <div className="flex justify-between"><span className="text-cheese">Collection</span><span className="truncate ml-2">{nft.collection}</span></div>
        {nft.schema && <div className="flex justify-between"><span className="text-cheese">Schema</span><span>{nft.schema}</span></div>}
        {nft.template_id && <div className="flex justify-between"><span className="text-cheese">Template</span><span className="font-mono">{nft.template_id}</span></div>}
        {nft.mint && <div className="flex justify-between"><span className="text-cheese">Mint #</span><span>{nft.mint}</span></div>}
        {extraHoverContent}
      </HoverCardContent>
    </HoverCard>
  );
});