import { describe, it, expect } from "vitest";
import { extractBannersForSlot, placeholderBanner } from "@/components/bannerads/BannerDisplay";
import type { BannerSlot } from "@/hooks/useBannerSlots";

function sharedSlotWithOpenHalf(position: number): BannerSlot {
  return {
    time: 0,
    position,
    user: "renter1.wam",
    ipfsHash: "qmrenter",
    websiteUrl: "https://example.com",
    rentalType: "shared",
    isAvailable: false,
    isOnChain: true,
    suspended: false,
  };
}

describe("banner standby placeholders", () => {
  it("assigns the WaxEDGE banner to an open shared half in position 1", () => {
    const banners = extractBannersForSlot(sharedSlotWithOpenHalf(1));
    const placeholder = banners.find((b) => b.isPlaceholder);
    expect(placeholder?.websiteUrl).toBe("https://waxedge.app");
    expect(placeholder?.user).toBe("placeholder-waxedge");
  });

  it("assigns the GPK Collection Manager banner to an open shared half in position 2", () => {
    const banners = extractBannersForSlot(sharedSlotWithOpenHalf(2));
    const placeholder = banners.find((b) => b.isPlaceholder);
    expect(placeholder?.websiteUrl).toBe("https://gpkonwax.github.io/collection-manager/");
    expect(placeholder?.user).toBe("placeholder-gpk-collection-manager");
  });

  it("gives each position its own placeholder independently of the other slot", () => {
    expect(placeholderBanner(1).user).toBe("placeholder-waxedge");
    expect(placeholderBanner(2).user).toBe("placeholder-gpk-collection-manager");
  });

  it("adds no placeholder when the shared half is rented", () => {
    const slot = {
      ...sharedSlotWithOpenHalf(2),
      sharedUser: "renter2.wam",
      sharedIpfsHash: "qmshared",
      sharedWebsiteUrl: "https://shared.example.com",
    };
    const banners = extractBannersForSlot(slot);
    expect(banners.some((b) => b.isPlaceholder)).toBe(false);
    expect(banners).toHaveLength(2);
  });

  it("adds no placeholder for exclusive rentals or suspended slots", () => {
    const exclusive: BannerSlot = { ...sharedSlotWithOpenHalf(1), rentalType: "exclusive" };
    expect(extractBannersForSlot(exclusive).some((b) => b.isPlaceholder)).toBe(false);
    const suspended: BannerSlot = { ...sharedSlotWithOpenHalf(1), suspended: true };
    expect(extractBannersForSlot(suspended)).toHaveLength(0);
  });
});
