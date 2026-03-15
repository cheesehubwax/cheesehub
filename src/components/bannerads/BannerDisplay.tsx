import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Megaphone } from "lucide-react";
import { useBannerSlots, BannerSlotGroup } from "@/hooks/useBannerSlots";
import { IPFS_GATEWAYS } from "@/lib/ipfsGateways";
import { sanitizeUrl } from "@/lib/sanitizeUrl";
import { logger } from "@/lib/logger";

interface ActiveBanner {
  ipfsHash: string;
  websiteUrl: string;
  user: string;
}

function extractActiveBanners(group: BannerSlotGroup): ActiveBanner[] {
  const banners: ActiveBanner[] = [];

  for (const slot of group.slots) {
    // Skip only if truly available (no renter) or suspended
    if (slot.suspended) continue;

    // Primary renter banner
    if (!slot.isAvailable && slot.ipfsHash) {
      banners.push({
        ipfsHash: slot.ipfsHash,
        websiteUrl: slot.websiteUrl,
        user: slot.user,
      });
    }

    // Shared renter banner
    if (slot.rentalType === "shared" && slot.sharedUser && slot.sharedIpfsHash) {
      banners.push({
        ipfsHash: slot.sharedIpfsHash,
        websiteUrl: slot.sharedWebsiteUrl || "#",
        user: slot.sharedUser,
      });
    }
  }

  return banners;
}

export function BannerDisplay() {
  const { slotGroups } = useBannerSlots();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [gatewayIndex, setGatewayIndex] = useState(0);

  const activeBanners = useMemo(() => {
    const nowSec = Math.floor(Date.now() / 1000);

    // Only use the most recent group that has started (today's group)
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

  useEffect(() => {
    if (activeBanners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((index) => (index + 1) % activeBanners.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [activeBanners.length]);

  const current = activeBanners[currentIndex];
  const currentGateway = IPFS_GATEWAYS[gatewayIndex] ?? IPFS_GATEWAYS[0];

  return (
    <div className="w-full flex flex-col items-center gap-1 pt-8 pb-2">
      {activeBanners.length > 0 && current ? (
        <a
          href={sanitizeUrl(current.websiteUrl)}
          target="_blank"
          rel="noopener noreferrer"
          className="relative block max-w-[580px] w-full"
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
        </a>
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
        className="flex items-center gap-1 text-xs text-cheese hover:text-cheese transition-colors"
      >
        <Megaphone className="h-3 w-3" />
        Advertise with CHEESEHub
      </Link>
    </div>
  );
}
