import { useQuery } from "@tanstack/react-query";
import {
  fetchFarmStakers,
  fetchAssetsMetadata,
  type FarmStakerRow,
  type StakerAssetMeta,
} from "@/lib/farmStakers";

export interface UseFarmStakersResult {
  stakers: FarmStakerRow[];
  assets: Map<string, StakerAssetMeta>;
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  refetch: () => void;
}

/**
 * Loads the stakers table for a single farm, then fetches asset metadata
 * for every staked asset id (deduped) so the UI can render thumbnails.
 */
export function useFarmStakers(farmName: string | undefined, enabled: boolean): UseFarmStakersResult {
  const stakersQuery = useQuery({
    queryKey: ["farm-stakers", farmName],
    queryFn: () => fetchFarmStakers(farmName!),
    enabled: !!farmName && enabled,
    staleTime: 60_000,
  });

  const allAssetIds = (stakersQuery.data || []).flatMap(s => s.assetIds);
  // Stable cache key from sorted unique ids
  const assetsKey = Array.from(new Set(allAssetIds)).sort().join(",");

  const assetsQuery = useQuery({
    queryKey: ["farm-stakers-assets", farmName, assetsKey],
    queryFn: () => fetchAssetsMetadata(allAssetIds),
    enabled: !!farmName && enabled && allAssetIds.length > 0,
    staleTime: 5 * 60_000,
  });

  return {
    stakers: stakersQuery.data || [],
    assets: assetsQuery.data || new Map(),
    isLoading: stakersQuery.isLoading,
    isFetching: stakersQuery.isFetching || assetsQuery.isFetching,
    error: stakersQuery.error || assetsQuery.error,
    refetch: () => {
      stakersQuery.refetch();
      assetsQuery.refetch();
    },
  };
}