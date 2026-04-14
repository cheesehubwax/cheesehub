import React, { useState, useMemo, useCallback, useEffect } from "react";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { Check, Loader2, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

import { IPFS_GATEWAYS, extractIpfsHash } from "@/lib/ipfsGateways";

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
}

export const NFTGridCard = React.memo(function NFTGridCard({
  nft,
  isSelected,
  onToggle,
  disabled,
  extraBadge,
  extraHoverContent,
  borderClass,
}: NFTGridCardProps) {
  const [gatewayIndex, setGatewayIndex] = useState(0);
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const ipfsHash = extractIpfsHash(nft.image);
  const hasValidImage = Boolean(nft.image && nft.image !== "/placeholder.svg");

  const currentImageUrl = useMemo(() => {
    if (!nft.image || nft.image === "/placeholder.svg") return "/placeholder.svg";
    if (ipfsHash) {
      const baseUrl = `${IPFS_GATEWAYS[gatewayIndex]}${ipfsHash}`;
      return retryCount > 0 ? `${baseUrl}?retry=${retryCount}` : baseUrl;
    }
    const sep = nft.image.includes("?") ? "&" : "?";
    return retryCount > 0 ? `${nft.image}${sep}retry=${retryCount}` : nft.image;
  }, [nft.image, ipfsHash, gatewayIndex, retryCount]);

  const handleImageError = useCallback(() => {
    if (ipfsHash && gatewayIndex < IPFS_GATEWAYS.length - 1) {
      setGatewayIndex((p) => p + 1);
      setImgLoaded(false);
    } else {
      setImgError(true);
    }
  }, [ipfsHash, gatewayIndex]);

  // Timeout fallback – try next gateway after 10s
  useEffect(() => {
    if (!hasValidImage || imgError || imgLoaded) return;
    const t = setTimeout(() => {
      if (!imgLoaded && !imgError) handleImageError();
    }, 10000);
    return () => clearTimeout(t);
  }, [hasValidImage, imgError, imgLoaded, currentImageUrl, handleImageError]);

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImgError(false);
    setImgLoaded(false);
    setGatewayIndex(0);
    setRetryCount((p) => p + 1);
  };

  const showErrorState = !hasValidImage || imgError;

  const card = (
    <div
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
        ) : (
          <>
            {!imgLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted">
                <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
              </div>
            )}
            <img
              src={currentImageUrl}
              alt={nft.name}
              className={cn(
                "w-full h-full object-cover transition-opacity",
                imgLoaded ? "opacity-100" : "opacity-0"
              )}
              loading="lazy"
              onError={handleImageError}
              onLoad={(e) => {
                const t = e.target as HTMLImageElement;
                if (t.naturalWidth === 0) handleImageError();
                else setImgLoaded(true);
              }}
            />
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