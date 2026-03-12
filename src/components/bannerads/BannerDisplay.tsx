import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useBannerSlots } from "@/hooks/useBannerSlots";
import { getIpfsUrl } from "@/lib/ipfsGateways";
import { sanitizeUrl } from "@/lib/sanitizeUrl";
import { Megaphone } from "lucide-react";

interface ActiveBanner {
  ipfsHash: string;
  websiteUrl: string;
  user: string;
}

export function BannerDisplay() {
  const { slotGroups } = useBannerSlots();
  const [currentIndex, setCurrentIndex] = useState(0);

  const activeBanners = useMemo(() => {
    const now = new Date();
    const todayStart = Math.floor(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 1000
    );

    const todayGroup = slotGroups.find((g) => g.time === todayStart);
    if (!todayGroup) return [];

    const banners: ActiveBanner[] = [];
    for (const slot of todayGroup.slots) {
      if (slot.isAvailable || slot.suspended) continue;

      if (slot.ipfsHash) {
        banners.push({
          ipfsHash: slot.ipfsHash,
          websiteUrl: slot.websiteUrl,
          user: slot.user,
        });
      }

      if (
        slot.rentalType === "shared" &&
        slot.sharedUser &&
        slot.sharedIpfsHash
      ) {
        banners.push({
          ipfsHash: slot.sharedIpfsHash,
          websiteUrl: slot.sharedWebsiteUrl || "#",
          user: slot.sharedUser,
        });
      }
    }
    return banners;
  }, [slotGroups]);

  useEffect(() => {
    if (activeBanners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((i) => (i + 1) % activeBanners.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [activeBanners.length]);

  const current = activeBanners[currentIndex];

  return (
    <div className="w-full flex flex-col items-center gap-1 py-2">
      {current && (
        <a
          href={sanitizeUrl(current.websiteUrl)}
          target="_blank"
          rel="noopener noreferrer"
          className="block max-w-[580px] w-full"
        >
          <img
            src={getIpfsUrl(current.ipfsHash)}
            alt="Banner Ad"
            className="w-full h-auto max-h-[150px] object-contain rounded-lg"
            loading="lazy"
          />
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
