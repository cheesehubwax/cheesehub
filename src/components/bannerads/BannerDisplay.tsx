import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Megaphone } from "lucide-react";
import { useBannerSlots, BannerSlotGroup } from "@/hooks/useBannerSlots";
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

function extractActiveBanners(group: BannerSlotGroup): ActiveBanner[] {
  const banners: ActiveBanner[] = [];

  for (const slot of group.slots) {
    if (slot.suspended) continue;

    // Primary renter banner
    if (!slot.isAvailable && slot.ipfsHash) {
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
    if (slot.rentalType === "shared" && !slot.suspended && !slot.isAvailable && !slot.sharedUser) {
      banners.push({
        localSrc: cheeseBanner4,
        websiteUrl: "/farm",
        user: "placeholder",
        isPlaceholder: true,
      });
    }
  }

  return banners;
}

export function BannerDisplay() {
  const { slotGroups } = useBannerSlots();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [gatewayIndex, setGatewayIndex] = useState(0);
  const [warningUrl, setWarningUrl] = useState<string | null>(null);

  const activeBanners = useMemo(() => {
    const nowSec = Math.floor(Date.now() / 1000);

    const currentGroup = slotGroups
      .filter((group) => group.time <= nowSec)
      .sort((a, b) => b.time - a.time)[0];

    if (currentGroup) {
      const banners = extractActiveBanners(currentGroup);
      if (banners.length > 0) {
        logger.info(`[BannerDisplay] Showing ${banners.length} banner(s) from group time=${currentGroup.time}`, banners);
        return banners;
      }
    }

    return [];
  }, [slotGroups]);

  useEffect(() => {
    if (currentIndex >= activeBanners.length) setCurrentIndex(0);
  }, [activeBanners.length, currentIndex]);

  useEffect(() => {
    setGatewayIndex(0);
  }, [currentIndex, activeBanners.length]);

  const isCurrentShared = activeBanners[currentIndex]?.isShared ?? false;

  useEffect(() => {
    if (activeBanners.length <= 1) return;
    const duration = isCurrentShared ? 20000 : 8000;
    const interval = setInterval(() => {
      setCurrentIndex((index) => (index + 1) % activeBanners.length);
    }, duration);
    return () => clearInterval(interval);
  }, [activeBanners.length, isCurrentShared]);

  const current = activeBanners[currentIndex];
  const currentGateway = IPFS_GATEWAYS[gatewayIndex] ?? IPFS_GATEWAYS[0];

  const handleAdClick = (url: string) => {
    const sanitized = sanitizeUrl(url);
    if (sanitized === "#") return;
    setWarningUrl(sanitized);
  };

  return (
    <div className="w-full flex flex-col items-center gap-1 pt-8 pb-2">
      {activeBanners.length > 0 && current ? (
        current.localSrc ? (
          <Link
            to={current.websiteUrl}
            className="relative block max-w-[580px] w-full"
          >
            <img
              src={current.localSrc}
              alt="CHEESEFarm Banner"
              className="w-full h-auto max-h-[150px] object-contain rounded-lg"
              loading="lazy"
            />
          </Link>
        ) : (
          <div
            onClick={() => handleAdClick(current.websiteUrl)}
            className="relative block max-w-[580px] w-full cursor-pointer"
            role="link"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdClick(current.websiteUrl); }}
          >
            <img
              src={`${currentGateway}${current.ipfsHash}`}
              alt="Banner Ad"
              className="w-full h-auto max-h-[150px] object-contain rounded-lg"
              loading="lazy"
              onError={() => {
                if (gatewayIndex < IPFS_GATEWAYS.length - 1) {
                  setGatewayIndex((index) => index + 1);
                }
              }}
            />
            <span className="absolute top-1 right-1 text-[10px] font-bold text-foreground/30 bg-background/40 rounded px-1 py-0.5 leading-none pointer-events-none select-none">
              AD
            </span>
          </div>
        )
      ) : (
        <div className="flex gap-12">
          {[1, 2].map((slot) => (
            <Link
              key={slot}
              to="/bannerads"
              className="w-[580px] h-[150px] rounded-lg border border-dashed border-cheese/40 bg-card/40 flex items-center justify-center gap-2 text-cheese/60 hover:border-cheese hover:text-cheese transition-colors"
            >
              <Megaphone className="h-4 w-4" />
              <span className="text-xs font-medium">Slot {slot} — Available</span>
            </Link>
          ))}
        </div>
      )}
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
