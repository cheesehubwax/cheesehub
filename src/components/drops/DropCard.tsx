import { useState, useCallback, useEffect, useRef } from "react";
import { ShoppingCart, Coins, ImageOff, Lock, RotateCw, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { NFTDrop } from "@/types/drop";
import { useCart } from "@/context/CartContext";
import { Link } from "react-router-dom";

import { isImageLoaded, isImagePreloading, waitForPreload } from "@/services/atomicApi";
import cheeseLogo from "@/assets/cheese-logo.png";
import { IPFS_GATEWAYS, IMAGE_LOAD_TIMEOUT, extractIpfsHash, isVideoUrl } from "@/lib/ipfsGateways";

const CURRENCY_LOGOS: Record<string, string> = {
  CHEESE: cheeseLogo,
};

function getCurrencyDisplay(drop: NFTDrop): { logo: string | null; symbol: string } {
  const currency = drop.currency || (drop.listingPrice?.split(' ')[1]) || 'WAX';
  return {
    logo: CURRENCY_LOGOS[currency] || null,
    symbol: currency,
  };
}

export interface DropCardProps {
  drop: NFTDrop;
  isImageCached?: boolean;
  onImageLoaded?: (dropId: string) => void;
}

export function DropCard({ drop, isImageCached, onImageLoaded }: DropCardProps) {
  const { addToCart } = useCart();
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(isImageCached ?? false);
  const [currentImageUrl, setCurrentImageUrl] = useState(drop.image);
  const [gatewayIndex, setGatewayIndex] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const racingRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mintedPercent = ((drop.totalSupply - drop.remaining) / drop.totalSupply) * 100;

  useEffect(() => {
    const isPlaceholder = !drop.image || drop.image === '/placeholder.svg' || drop.image.includes('placeholder');
    if (isPlaceholder) {
      // placeholder image, skip
      setCurrentImageUrl('/placeholder.svg');
      setImageLoaded(true);
      setImageError(false);
      return;
    }
    setImageError(false);
    setImageLoaded(isImageCached ?? false);
    setCurrentImageUrl(drop.image);
    setGatewayIndex(0);
    setRetryCount(0);
  }, [drop.image, drop.id, isImageCached]);

  useEffect(() => {
    if (imageError || imageLoaded || isImageCached) {
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
      return;
    }
    if (isImageLoaded(currentImageUrl)) { setImageLoaded(true); return; }
    if (isImagePreloading(currentImageUrl)) {
      let cancelled = false;
      waitForPreload(currentImageUrl).then(success => {
        if (!cancelled && success) setImageLoaded(true);
      });
      return () => { cancelled = true; };
    }
    const jitter = Math.random() * 3000;
    const timeout = Math.min(IMAGE_LOAD_TIMEOUT.card + jitter + (gatewayIndex * IMAGE_LOAD_TIMEOUT.increment), IMAGE_LOAD_TIMEOUT.max);
    timeoutRef.current = setTimeout(() => {
      if (!imageLoaded && !imageError) handleImageError();
    }, timeout);
    return () => { if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; } };
  }, [currentImageUrl, imageLoaded, imageError, isImageCached, gatewayIndex]);

  const handleImageError = useCallback(() => {
    const hash = extractIpfsHash(currentImageUrl);
    if (!hash) { setImageError(true); return; }
    const nextGateways = IPFS_GATEWAYS.slice(gatewayIndex + 1, gatewayIndex + 3);
    if (nextGateways.length > 0 && !racingRef.current) {
      racingRef.current = true;
      Promise.race(
        nextGateways.map((gw, i) => 
          new Promise<number>((resolve, reject) => {
            const img = new Image();
            const tid = setTimeout(() => reject(), 3000);
            img.onload = () => { clearTimeout(tid); img.naturalWidth > 0 ? resolve(gatewayIndex + 1 + i) : reject(); };
            img.onerror = () => { clearTimeout(tid); reject(); };
            img.src = `${gw}${hash}`;
          })
        )
      ).then(winnerIndex => {
        racingRef.current = false;
        setGatewayIndex(winnerIndex);
        setCurrentImageUrl(`${IPFS_GATEWAYS[winnerIndex]}${hash}`);
        setImageLoaded(false);
      }).catch(() => {
        racingRef.current = false;
        const nextIndex = gatewayIndex + nextGateways.length + 1;
        if (nextIndex < IPFS_GATEWAYS.length) {
          setGatewayIndex(nextIndex);
          setCurrentImageUrl(`${IPFS_GATEWAYS[nextIndex]}${hash}`);
          setImageLoaded(false);
        } else {
          setImageError(true);
        }
      });
    } else {
      setImageError(true);
    }
  }, [currentImageUrl, gatewayIndex, drop.id]);

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth === 0 || img.naturalHeight === 0) { handleImageError(); }
    else { setImageLoaded(true); onImageLoaded?.(drop.id); }
  }, [handleImageError, drop.id, onImageLoaded]);

  const handleRetry = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setImageError(false); setImageLoaded(false); setGatewayIndex(0);
    setRetryCount(prev => prev + 1); setCurrentImageUrl(drop.image);
  }, [drop.image]);

  const displayImageUrl = retryCount > 0 
    ? `${currentImageUrl}${currentImageUrl.includes('?') ? '&' : '?'}retry=${retryCount}` 
    : currentImageUrl;

  const isFreeAuthDrop = drop.authRequired && (drop.isFree || drop.price === 0);

  return (
    <Card className="group overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:border-primary/50 hover-cheese-glow">
      <Link to={`/drops/${drop.id}`}>
        <div className="relative aspect-square overflow-hidden bg-muted/50">
          {imageError && isVideoUrl(currentImageUrl) ? (
            <div className="flex h-full w-full flex-col items-center justify-center bg-muted/30">
              <Film className="h-12 w-12 text-muted-foreground/50" />
              <span className="mt-2 text-xs text-muted-foreground">Video NFT</span>
            </div>
          ) : imageError ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2">
              <ImageOff className="h-12 w-12 text-muted-foreground/50" />
              <Button variant="ghost" size="sm" onClick={handleRetry} className="text-xs text-muted-foreground hover:text-foreground">
                <RotateCw className="mr-1 h-3 w-3" /> Retry
              </Button>
            </div>
          ) : (
            <>
              {!imageLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              )}
              <img
                src={displayImageUrl}
                alt={drop.name}
                className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-110 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                onError={handleImageError}
                onLoad={handleImageLoad}
                loading="lazy"
              />
            </>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
          
          {drop.authRequired && (
            <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-amber-500/90 backdrop-blur-sm px-2 py-1 text-xs font-medium text-black">
              <Lock className="h-3 w-3" />
              {isFreeAuthDrop ? 'Holders Only' : 'Auth Required'}
            </div>
          )}
          
          <div className={`absolute bottom-2 right-2 flex items-center gap-1 rounded-full backdrop-blur-sm px-2.5 py-1 border shadow-lg ${
            isFreeAuthDrop ? 'bg-green-500/90 border-green-400/50' : 'bg-background/90 border-border/50'
          }`}>
            {isFreeAuthDrop ? (
              <span className="font-display text-sm font-bold text-white">FREE</span>
            ) : (
              <>
                {(() => {
                  const { logo, symbol } = getCurrencyDisplay(drop);
                  return logo ? <img src={logo} alt={symbol} className="h-4 w-4" /> : <Coins className="h-4 w-4 text-muted-foreground" />;
                })()}
                <span className="font-display text-sm font-bold text-primary">{drop.price.toLocaleString()}</span>
                <span className="text-xs text-muted-foreground">{getCurrencyDisplay(drop).symbol}</span>
              </>
            )}
          </div>
        </div>
      </Link>

      <CardContent className="p-4">
        {drop.collectionName && (
          <span className="mb-2 inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{drop.collectionName}</span>
        )}
        <Link to={`/drops/${drop.id}`}>
          <h3 className="font-display text-lg font-semibold text-foreground transition-colors hover:text-primary">{drop.name}</h3>
        </Link>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{drop.description}</p>
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Minted</span>
            <span className="font-medium text-foreground">{drop.totalSupply - drop.remaining} / {drop.totalSupply}</span>
          </div>
          <Progress value={mintedPercent} className="h-2 bg-muted" />
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-between border-t border-border/50 p-4">
        <div className="flex items-center gap-1.5">
          {(() => {
            const { logo, symbol } = getCurrencyDisplay(drop);
            return logo ? <img src={logo} alt={symbol} className="h-6 w-6" /> : <Coins className="h-5 w-5 text-muted-foreground" />;
          })()}
          <span className="font-display text-xl font-bold text-primary">{drop.price.toLocaleString()}</span>
          <span className="text-sm text-muted-foreground">{getCurrencyDisplay(drop).symbol}</span>
        </div>
        <Button
          size="sm"
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={(e) => {
            e.preventDefault();
            const primaryPrice = drop.prices?.[0];
            const selectedPrice = {
              price: primaryPrice?.price ?? drop.price,
              currency: primaryPrice?.currency ?? drop.currency ?? 'WAX',
              tokenContract: primaryPrice?.tokenContract ?? drop.tokenContract ?? 'eosio.token',
              precision: primaryPrice?.precision ?? 8,
              listingPrice: primaryPrice?.listingPrice ?? drop.listingPrice ?? `${drop.price} WAX`,
            };
            addToCart(drop, selectedPrice);
          }}
          disabled={drop.remaining === 0}
        >
          {drop.remaining === 0 ? "Sold Out" : (<><ShoppingCart className="mr-2 h-4 w-4" />Add</>)}
        </Button>
      </CardFooter>
    </Card>
  );
}
