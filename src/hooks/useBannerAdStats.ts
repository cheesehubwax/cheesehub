import { useQuery } from '@tanstack/react-query';
import { fetchBannerAdStats, type BannerAdStats } from '@/lib/bannerAdStats';

export function useBannerAdStats() {
  return useQuery<BannerAdStats>({
    queryKey: ['bannerAdStats'],
    queryFn: fetchBannerAdStats,
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: 1,
  });
}
