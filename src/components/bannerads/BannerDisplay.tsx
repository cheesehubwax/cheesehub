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

    // Prefer the most recent live group, fall back to nearest future
    const pastGroups = slotGroups
      .filter((group) => group.time <= nowSec)
      .sort((a, b) => b.time - a.time);

    const futureGroups = slotGroups
      .filter((group) => group.time > nowSec)
      .sort((a, b) => a.time - b.time);

    const candidateGroups = [...pastGroups, ...futureGroups];

    for (const group of candidateGroups) {
      const banners = extractActiveBanners(group);
      if (banners.length > 0) {
        logger.info(`[BannerDisplay] Showing ${banners.length} banner(s) from group time=${group.time}`, banners);
        return banners;
      }
    }

    // Log all slots for debugging if nothing matched
    if (slotGroups.length > 0) {
      logger.info("[BannerDisplay] No active banners found. All slot groups:", slotGroups.map(g => ({
        time: g.time,
        slots: g.slots.map(s => ({
          pos: s.position, user: s.user, ipfsHash: s.ipfsHash?.slice(0, 12),
          sharedUser: s.sharedUser, sharedIpfsHash: s.sharedIpfsHash?.slice(0, 12),
          isAvailable: s.isAvailable, suspended: s.suspended, rentalType: s.rentalType,
        })),
      })));
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
      {current && (
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
      )}
      <Link
        to="/bannerads"
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-cheese transition-colors"
      >
        <Megaphone className="h-3 w-3" />
        Advertise with CHEESEHub
      </Link>
    </div>
  );
}
