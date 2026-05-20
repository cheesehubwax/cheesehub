import { useState, useEffect, useRef, useCallback } from 'react';
import { getAudioPlayer } from '@/lib/musicPlayer';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Disc3, Video, Music2, Maximize2, Minimize2, X, Image, ImageIcon } from 'lucide-react';

const IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://dweb.link/ipfs/',
];

function extractIpfsHash(url: string): string | null {
  if (!url) return null;
  if (url.startsWith('Qm') || url.startsWith('bafy')) return url;
  const match = url.match(/ipfs[:/]+(.+)/);
  return match ? match[1] : null;
}

export type DisplayMode = 'cover' | 'video' | 'front' | 'back';

interface MediaDisplayProps {
  coverArt: string;
  videoUrl?: string;
  frontArt?: string;
  backArt?: string;
  alt: string;
  isPlaying: boolean;
  isVideo: boolean;
  hasVideo: boolean;
  displayMode: DisplayMode;
  onToggleVideo?: () => void;
  isTheaterMode?: boolean;
  onToggleTheater?: () => void;
  onExpandArt?: (src: string) => void;
  trackId?: string;
  videoAspectRatio?: number | null;
  videoFailed?: boolean;
}

export function MediaDisplay({ 
  coverArt, 
  videoUrl,
  frontArt,
  backArt,
  alt, 
  isPlaying, 
  isVideo,
  hasVideo,
  displayMode,
  onToggleVideo,
  isTheaterMode = false,
  onToggleTheater,
  onExpandArt,
  trackId,
  videoAspectRatio,
  videoFailed,
}: MediaDisplayProps) {
  const showingArt = displayMode === 'front' || displayMode === 'back';
  const artSrc = displayMode === 'back' ? backArt : (displayMode === 'front' ? (frontArt || coverArt) : coverArt);

  const [imgSrc, setImgSrc] = useState(artSrc || coverArt);
  const [gatewayIndex, setGatewayIndex] = useState(0);
  const [hasError, setHasError] = useState(false);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    const newSrc = showingArt ? (artSrc || coverArt) : coverArt;
    setImgSrc(newSrc);
    setGatewayIndex(0);
    setHasError(false);
  }, [coverArt, artSrc, showingArt]);

  useEffect(() => {
    const audioPlayer = getAudioPlayer();
    if (isVideo && !showingArt && videoContainerRef.current) {
      audioPlayer.mountVideo(videoContainerRef.current, isTheaterMode ? 'cover' : 'contain');
    } else if (isVideo && !showingArt) {
      audioPlayer.setVideoFit(isTheaterMode ? 'cover' : 'contain');
    }
    return () => {};
  }, [isVideo, showingArt, trackId, isTheaterMode]);

  const handleFullscreen = useCallback(() => {
    if (videoContainerRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoContainerRef.current.requestFullscreen();
      }
    }
  }, []);

  const handleError = useCallback(() => {
    const currentSrc = showingArt ? (artSrc || coverArt) : coverArt;
    const hash = extractIpfsHash(currentSrc);
    if (hash && gatewayIndex < IPFS_GATEWAYS.length - 1) {
      const nextIndex = gatewayIndex + 1;
      setGatewayIndex(nextIndex);
      setImgSrc(`${IPFS_GATEWAYS[nextIndex]}${hash}`);
    } else {
      setHasError(true);
    }
  }, [coverArt, artSrc, showingArt, gatewayIndex]);

  const handleImageClick = useCallback(() => {
    if (onExpandArt && imgSrc) {
      onExpandArt(imgSrc);
    }
  }, [onExpandArt, imgSrc]);

  const FallbackDisc = () => (
    <div className="w-full h-full bg-muted/50 flex items-center justify-center">
      <Disc3 className={cn(
        "h-16 w-16 text-cheese/50",
        isPlaying && "animate-spin"
      )} style={{ animationDuration: '3s' }} />
    </div>
  );

  const showVideo = isVideo && !showingArt;

  return (
    <div 
      className={cn(
        "relative w-full h-full",
        isTheaterMode && "fixed inset-0 z-50 bg-black"
      )}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {showVideo && (
        <div 
          ref={videoContainerRef}
          className={cn(
            "absolute inset-0 overflow-hidden bg-black",
            isTheaterMode ? "rounded-none" : "rounded-lg"
          )}
        />
      )}
      
      {!showVideo && (
        hasError || !imgSrc ? (
          <FallbackDisc />
        ) : (
          <img
            src={imgSrc}
            alt={alt}
            className={cn(
              "w-full h-full object-cover",
              showingArt && onExpandArt && "cursor-zoom-in"
            )}
            onError={handleError}
            onClick={showingArt ? handleImageClick : undefined}
          />
        )
      )}

      {videoFailed && !showVideo && hasVideo && (
        <div className="absolute top-2 left-2 text-[10px] bg-black/60 text-white/80 px-2 py-1 rounded">
          Video unavailable — playing audio
        </div>
      )}

      {(isHovering || isTheaterMode) && (
        <div className={cn(
          "absolute inset-x-0 bottom-0 flex items-center justify-end gap-1 p-2",
          isTheaterMode && "bg-gradient-to-t from-black/60 to-transparent"
        )}>
          {hasVideo && onToggleVideo && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon"
                    className={cn(
                      "h-8 w-8 bg-background/80 backdrop-blur-sm hover:bg-background/90",
                      isVideo && "text-cheese"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleVideo();
                    }}
                  >
                    {isVideo ? (
                      <Music2 className="h-4 w-4" />
                    ) : (
                      <Video className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {isVideo ? 'Switch to audio' : 'Watch music video'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {showVideo && (
            <>
              {onToggleTheater && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-8 w-8 bg-background/80 backdrop-blur-sm hover:bg-background/90"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleTheater();
                        }}
                      >
                        {isTheaterMode ? (
                          <Minimize2 className="h-4 w-4" />
                        ) : (
                          <Maximize2 className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      {isTheaterMode ? 'Exit theater mode' : 'Theater mode'}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </>
          )}

          {showingArt && onExpandArt && imgSrc && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8 bg-background/80 backdrop-blur-sm hover:bg-background/90"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleImageClick();
                    }}
                  >
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Expand artwork</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )}

      {isTheaterMode && isHovering && (
        <div className="absolute top-4 left-4 text-white/60 text-xs bg-black/40 px-2 py-1 rounded">
          Press ESC or click ✕ to exit
        </div>
      )}
    </div>
  );
}

// Lightbox overlay for expanded art
interface ArtLightboxProps {
  src: string;
  alt: string;
  onClose: () => void;
}

export function ArtLightbox({ src, alt, onClose }: ArtLightboxProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div 
      className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center cursor-zoom-out"
      onClick={onClose}
    >
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 text-white/70 hover:text-white hover:bg-white/10 z-10"
        onClick={onClose}
      >
        <X className="h-6 w-6" />
      </Button>
      <img
        src={src}
        alt={alt}
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

// Media selector buttons row
interface MediaSelectorProps {
  hasAudio: boolean;
  hasVideo: boolean;
  hasFrontArt: boolean;
  hasBackArt: boolean;
  displayMode: DisplayMode;
  onSelect: (mode: DisplayMode) => void;
  extraAudioUrls?: { label: string; url: string; key: string }[];
  activeExtraAudioKey?: string | null;
  onSelectExtraAudio?: (url: string, key: string) => void;
}

export function MediaSelector({ hasAudio, hasVideo, hasFrontArt, hasBackArt, displayMode, onSelect, extraAudioUrls, activeExtraAudioKey, onSelectExtraAudio }: MediaSelectorProps) {
  const hasExtraAudio = extraAudioUrls && extraAudioUrls.length > 0;
  const audioLabel = hasExtraAudio ? 'Sample' : 'Audio';
  const buttons: { mode: DisplayMode; label: string; icon: React.ReactNode; available: boolean }[] = [
    { mode: 'cover', label: audioLabel, icon: <Music2 className="h-3.5 w-3.5" />, available: hasAudio },
    { mode: 'video', label: 'Video', icon: <Video className="h-3.5 w-3.5" />, available: hasVideo },
    { mode: 'front', label: 'Front Art', icon: <Image className="h-3.5 w-3.5" />, available: hasFrontArt },
    { mode: 'back', label: 'Back Art', icon: <ImageIcon className="h-3.5 w-3.5" />, available: hasBackArt },
  ];

  const availableButtons = buttons.filter(b => b.available);
  const hasExtraAudioForFilter = extraAudioUrls && extraAudioUrls.length > 0;
  if (availableButtons.length <= 1 && !hasExtraAudioForFilter) return null;

  return (
    <div className="flex items-center gap-1 mt-2 flex-wrap">
      {availableButtons.map(({ mode, label, icon }) => (
        <TooltipProvider key={mode}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={displayMode === mode && !activeExtraAudioKey ? 'secondary' : 'ghost'}
                size="sm"
                className={cn(
                  "h-7 text-xs gap-1 px-2",
                  displayMode === mode && !activeExtraAudioKey && "text-cheese bg-cheese/10"
                )}
                onClick={() => {
                  onSelect(mode);
                }}
              >
                {icon}
                {label}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{label}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}
      {hasExtraAudio && extraAudioUrls.map(({ label, url, key }) => (
        <TooltipProvider key={key}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={activeExtraAudioKey === key ? 'secondary' : 'ghost'}
                size="sm"
                className={cn(
                  "h-7 text-xs gap-1 px-2",
                  activeExtraAudioKey === key && "text-cheese bg-cheese/10"
                )}
                onClick={() => onSelectExtraAudio?.(url, key)}
              >
                <Music2 className="h-3.5 w-3.5" />
                {label}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{label}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}
    </div>
  );
}

// Small video indicator for track list
interface VideoIndicatorProps {
  hasVideo: boolean;
}

export function VideoIndicator({ hasVideo }: VideoIndicatorProps) {
  if (!hasVideo) return null;
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Video className="h-3 w-3 text-muted-foreground shrink-0" />
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>This track has a music video</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
