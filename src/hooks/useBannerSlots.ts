import { useQuery } from "@tanstack/react-query";
import { fetchTableRows } from "@/lib/waxRpcFallback";
import { logger } from "@/lib/logger";

const BANNER_CONTRACT = "cheesebannad";

interface BannerAdRow {
  time: number;
  position: number;
  user: string;
  ipfs_hash: string;
  website_url: string;
  rental_type: number;
  shared_user: string;
  shared_ipfs_hash: string;
  shared_website_url: string;
  suspended: boolean;
}

interface BannerConfig {
  id: number;
  wax_price_per_day: string;
  wax_per_cheese_baseline: number;
}

export interface BannerSlot {
  time: number;
  position: number;
  user: string;
  ipfsHash: string;
  websiteUrl: string;
  rentalType: "exclusive" | "shared";
  sharedUser?: string;
  sharedIpfsHash?: string;
  sharedWebsiteUrl?: string;
  isAvailable: boolean;
  isOnChain: boolean;
  suspended: boolean;
}

export interface BannerSlotGroup {
  time: number;
  date: Date;
  slots: BannerSlot[];
}

export interface BannerPricing {
  waxPerDay: number;
  waxPerCheeseBaseline: number;
}

const DEFAULT_PRICING: BannerPricing = { waxPerDay: 100, waxPerCheeseBaseline: 1.5 };

function isAccountMissingError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes("account_query_exception") || msg.includes("fail to retrieve account");
  }
  return false;
}

async function fetchBannerTable<T>(table: string, limit: number): Promise<T[]> {
  try {
    const result = await fetchTableRows<T>(
      { code: BANNER_CONTRACT, scope: BANNER_CONTRACT, table, limit },
      5000
    );
    return result.rows;
  } catch (error) {
    if (isAccountMissingError(error)) {
      logger.warn(`[BannerAds] Contract account "${BANNER_CONTRACT}" not found on-chain — returning empty`);
    } else {
      logger.warn(`[BannerAds] Failed to fetch ${table}:`, error);
    }
    return [];
  }
}

export function useBannerSlots() {
  const slotsQuery = useQuery({
    queryKey: ["bannerSlots", "all"],
    queryFn: async (): Promise<BannerSlotGroup[]> => {
      const rows = await fetchBannerTable<BannerAdRow>("bannerads", 1000);

      if (rows.length === 0) return [];

      const grouped = new Map<number, BannerSlot[]>();
       for (const row of rows) {
         const slot: BannerSlot = {
           time: row.time,
           position: row.position,
           user: row.user,
           ipfsHash: row.ipfs_hash,
           websiteUrl: row.website_url,
           rentalType: row.rental_type === 1 ? "shared" : "exclusive",
           sharedUser: row.shared_user && row.shared_user !== BANNER_CONTRACT ? row.shared_user : undefined,
           sharedIpfsHash: row.shared_ipfs_hash,
           sharedWebsiteUrl: row.shared_website_url,
           isAvailable: row.user === BANNER_CONTRACT || (row.rental_type === 1 && (!row.shared_user || row.shared_user === BANNER_CONTRACT)),
           isOnChain: true,
           suspended: !!(row.suspended),
         };

         const existing = grouped.get(row.time) || [];
         existing.push(slot);
         grouped.set(row.time, existing);
       }

      return Array.from(grouped.entries())
        .sort(([a], [b]) => a - b)
        .map(([time, slots]) => ({
          time,
          date: new Date(time * 1000),
          slots: slots.sort((a, b) => a.position - b.position),
        }));
    },
    staleTime: 30_000,
    gcTime: 120_000,
    retry: (failureCount, error) => {
      if (isAccountMissingError(error)) return false;
      return failureCount < 1;
    },
  });

  const configQuery = useQuery({
    queryKey: ["bannerConfig"],
    queryFn: async (): Promise<BannerPricing> => {
      const rows = await fetchBannerTable<BannerConfig>("config", 1);

      if (rows.length > 0) {
        const amount = parseFloat(rows[0].wax_price_per_day.split(" ")[0]);
        return {
          waxPerDay: amount,
          waxPerCheeseBaseline: rows[0].wax_per_cheese_baseline,
        };
      }

      return DEFAULT_PRICING;
    },
    staleTime: 120_000,
    gcTime: 300_000,
    retry: (failureCount, error) => {
      if (isAccountMissingError(error)) return false;
      return failureCount < 1;
    },
  });

  return {
    slotGroups: slotsQuery.data ?? [],
    pricing: configQuery.data ?? DEFAULT_PRICING,
    isLoading: slotsQuery.isLoading || configQuery.isLoading,
    refetch: () => {
      slotsQuery.refetch();
      configQuery.refetch();
    },
  };
}
