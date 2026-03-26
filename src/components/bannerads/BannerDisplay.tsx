import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { Megaphone } from "lucide-react";
import { useBannerSlots, BannerSlotGroup, BannerSlot } from "@/hooks/useBannerSlots";
import { IPFS_GATEWAYS } from "@/lib/ipfsGateways";
import { sanitizeUrl } from "@/lib/sanitizeUrl";
import { isDomainBlocked } from "@/lib/bannerBlocklist";
import { logger } from "@/lib/logger";
import { ExternalLinkWarning } from "./ExternalLinkWarning";
import cheeseBanner4 from "@/assets/cheese_banner4.png";

interface ActiveBanner {
  ipfsHash?: string;
  localSrc?: string;
  websiteUrl: string;
  user: string;
  isPlaceholder?: boolean;
  isShared?: boolean;
}

function extractBannersForSlot(slot: BannerSlot): ActiveBanner[] {
  const banners: ActiveBanner[] = [];
  if (slot.suspended) return banners;

  // Primary renter banner
  if (slot.user !== "cheesebannad" && slot.ipfsHash) {
    if (!isDomainBlocked(slot.websiteUrl)) {
      banners.push({
        ipfsHash: slot.ipfsHash,
        websiteUrl: slot.websiteUrl,
        user: slot.user,
        isShared: slot.rentalType === "shared",
      });
    }
  }

  // Shared renter banner
  if (slot.rentalType === "shared" && slot.sharedUser && slot.sharedIpfsHash) {
    if (!isDomainBlocked(slot.sharedWebsiteUrl || "")) {
      banners.push({
        ipfsHash: slot.sharedIpfsHash,
        websiteUrl: slot.sharedWebsiteUrl || "#",
        user: slot.sharedUser,
        isShared: true,
      });
    }
  }

  // Placeholder for unrented shared half
  if (slot.rentalType === "shared" && slot.user !== "cheesebannad" && !slot.sharedUser) {
    banners.push({
      localSrc: cheeseBanner4,
      websiteUrl: "/farm",
      user: "placeholder",
      isPlaceholder: true,
    });
  }

  return banners;
}

function BannerLayer({
  banner,
  isActive,
  onAdClick,
}: {
  banner: ActiveBanner;
  isActive: boolean;
  onAdClick: (url: string) => void;
}) {
  const [gatewayIndex, setGatewayIndex] = useState(0);
  const currentGateway = IPFS_GATEWAYS[gatewayIndex] ?? IPFS_GATEWAYS[0];

  const visibilityClass = isActive
    ? "opacity-100 pointer-events-auto z-10"
    : "opacity-0 pointer-events-none z-0";

  if (banner.localSrc) {
    return (
      <Link
        to={banner.websiteUrl}
        className={`absolute inset-0 transition-opacity duration-500 ${visibilityClass}`}
        tabIndex={isActive ? 0 : -1}
      >
        <img
          src={banner.localSrc}
          alt="CHEESEFarm Banner"
          className="w-full h-full object-contain rounded-lg"
        />
      </Link>
    );
  }

  return (
    <div
      onClick={() => isActive && onAdClick(banner.websiteUrl)}
      className={`absolute inset-0 cursor-pointer transition-opacity duration-500 ${visibilityClass}`}
      role="link"
      tabIndex={isActive ? 0 : -1}
      onKeyDown={(e) => { if (isActive && e.key === "Enter") onAdClick(banner.websiteUrl); }}
    >
      <img
        src={`${currentGateway}${banner.ipfsHash}`}
        alt="Banner Ad"
        className="w-full h-full object-contain rounded-lg"
        onError={() => {
          if (gatewayIndex < IPFS_GATEWAYS.length - 1) {
            setGatewayIndex((i) => i + 1);
          }
        }}
      />
      <span className="absolute top-1 right-1 text-[10px] font-bold text-foreground/30 bg-background/40 rounded px-1 py-0.5 leading-none pointer-events-none select-none">
        AD
      </span>
    </div>
  );
}

function PositionSlot({
  banners,
  position,
  onAdClick,
}: {
  banners: ActiveBanner[];
  position: number;
  onAdClick: (url: string) => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex >= banners.length) setCurrentIndex(0);
  }, [banners.length, currentIndex]);

  const isCurrentShared = banners[currentIndex]?.isShared ?? false;

  useEffect(() => {
    if (banners.length <= 1) return;
    const duration = isCurrentShared ? 20000 : 8000;
    const interval = setInterval(() => {
      setCurrentIndex((i) => (i + 1) % banners.length);
    }, duration);
    return () => clearInterval(interval);
  }, [banners.length, isCurrentShared]);

  if (banners.length === 0) {
    return (
      <Link
        to="/bannerads"
        className="w-[580px] h-[150px] rounded-lg border border-dashed border-cheese/40 bg-card/40 flex items-center justify-center gap-2 text-cheese/60 hover:border-cheese hover:text-cheese transition-colors"
      >
        <Megaphone className="h-4 w-4" />
        <span className="text-xs font-medium">Slot {position} — Available</span>
      </Link>
    );
  }

  return (
    <div className="relative w-[580px] h-[150px]">
      {banners.map((banner, idx) => (
        <BannerLayer
          key={`${banner.user}-${banner.ipfsHash || "local"}-${idx}`}
          banner={banner}
          isActive={idx === currentIndex}
          onAdClick={onAdClick}
        />
      ))}
    </div>
  );
}

export function BannerDisplay() {
  const { slotGroups } = useBannerSlots();
  const [warningUrl, setWarningUrl] = useState<string | null>(null);

  const { pos1Banners, pos2Banners } = useMemo(() => {
    const nowSec = Math.floor(Date.now() / 1000);

    const currentGroup = slotGroups
      .filter((group) => group.time <= nowSec)
      .sort((a, b) => b.time - a.time)[0];

    const result = { pos1Banners: [] as ActiveBanner[], pos2Banners: [] as ActiveBanner[] };

    if (!currentGroup) return result;

    for (const slot of currentGroup.slots) {
      const banners = extractBannersForSlot(slot);
      if (slot.position === 1) {
        result.pos1Banners.push(...banners);
      } else if (slot.position === 2) {
        result.pos2Banners.push(...banners);
      }
    }

    if (result.pos1Banners.length > 0 || result.pos2Banners.length > 0) {
      logger.info(`[BannerDisplay] Pos1: ${result.pos1Banners.length} banner(s), Pos2: ${result.pos2Banners.length} banner(s)`);
    }

    return result;
  }, [slotGroups]);

  const handleAdClick = useCallback((url: string) => {
    const sanitized = sanitizeUrl(url);
    if (sanitized === "#") return;
    setWarningUrl(sanitized);
  }, []);

  return (
    <div className="w-full flex flex-col items-center gap-1 pt-8 pb-2">
      <div className="flex gap-12">
        <PositionSlot banners={pos1Banners} position={1} onAdClick={handleAdClick} />
        <PositionSlot banners={pos2Banners} position={2} onAdClick={handleAdClick} />
      </div>
      <Link
        to="/bannerads"
        className="flex items-center gap-1 text-xs text-cheese hover:text-cheese transition-colors mt-3"
      >
        <Megaphone className="h-3 w-3" />
        Advertise with CHEESEHub
      </Link>

      <ExternalLinkWarning
        open={!!warningUrl}
        onOpenChange={(open) => { if (!open) setWarningUrl(null); }}
        url={warningUrl || ""}
      />
    </div>
  );
}
