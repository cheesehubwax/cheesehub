import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchFarmStakers,
  fetchAssetsMetadata,
  getCachedAssets,
  type FarmStakerRow,
  type StakerAssetMeta,
} from "@/lib/farmStakers";

export interface UseFarmStakersResult {
  stakers: FarmStakerRow[];
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  refetch: () => void;
}

/**
 * Loads the stakers table for a single farm. Cheap — one paginated RPC.
 * Asset metadata is loaded lazily per row via `useStakerAssetMeta`.
 */
export function useFarmStakers(farmName: string | undefined, enabled: boolean): UseFarmStakersResult {
  const stakersQuery = useQuery({
    queryKey: ["farm-stakers", farmName],
    queryFn: () => fetchFarmStakers(farmName!),
    enabled: !!farmName && enabled,
    staleTime: 60_000,
  });

  return {
    stakers: stakersQuery.data || [],
    isLoading: stakersQuery.isLoading,
    isFetching: stakersQuery.isFetching,
    error: stakersQuery.error,
    refetch: () => {
      stakersQuery.refetch();
    },
  };
}

export interface UseStakerAssetMetaResult {
  assets: Map<string, StakerAssetMeta>;
  isLoading: boolean;
}

/**
 * Lazily resolve metadata for a slice of asset ids. The fetch only runs when
 * `enabled` is true (typically: the row has scrolled into view). Already-cached
 * ids resolve instantly without hitting the network.
 */
export function useStakerAssetMeta(assetIds: string[], enabled: boolean): UseStakerAssetMetaResult {
  const key = useMemo(
    () => Array.from(new Set(assetIds)).sort().join(","),
    [assetIds]
  );

  const query = useQuery({
    queryKey: ["staker-asset-meta", key],
    queryFn: () => fetchAssetsMetadata(assetIds),
    enabled: enabled && assetIds.length > 0,
    staleTime: 5 * 60_000,
  });

  // Prefer fresh query data; fall back to the module memo so already-cached
  // ids show through immediately even before the query is enabled.
  const assets = query.data ?? getCachedAssets(assetIds);

  return {
    assets,
    isLoading: query.isLoading && enabled,
  };
}