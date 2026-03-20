import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NFTDrop } from '@/types/drop';
import { fetchRawDrops } from '@/services/atomicApi';

const DROPS_CACHE_KEY = 'cheesehub_drops_cache_v4';
const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheData {
  drops: NFTDrop[];
  timestamp: number;
}

function loadCachedDrops(): NFTDrop[] | null {
  try {
    const cached = localStorage.getItem(DROPS_CACHE_KEY);
    if (!cached) return null;
    
    const data: CacheData = JSON.parse(cached);
    const age = Date.now() - data.timestamp;
    
    if (age > CACHE_TTL_MS) {
      localStorage.removeItem(DROPS_CACHE_KEY);
      return null;
    }
    
    return data.drops;
  } catch {
    return null;
  }
}

function saveCacheDrops(drops: NFTDrop[]) {
  try {
    const data: CacheData = {
      drops,
      timestamp: Date.now(),
    };
    localStorage.setItem(DROPS_CACHE_KEY, JSON.stringify(data));
  } catch {
    // localStorage might be full
  }
}

export function clearDropsCache() {
  try {
    localStorage.removeItem(DROPS_CACHE_KEY);
  } catch {
    // ignore
  }
}

export interface DropsLoaderState {
  drops: NFTDrop[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Simplified drops loader - fetches raw drops only.
 * Template enrichment is now handled at the page level by useEnrichDrops.
 */
export function useDropsLoader(): DropsLoaderState {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const initialCacheRef = useRef<NFTDrop[] | null>(null);

  useEffect(() => {
    initialCacheRef.current = loadCachedDrops();
  }, []);

  const { data: rawDrops, isLoading, error, refetch } = useQuery({
    queryKey: ['drops-raw'],
    queryFn: async () => {
      const drops = await fetchRawDrops();
      saveCacheDrops(drops);
      return drops;
    },
    staleTime: 1000 * 60 * 2,
    refetchInterval: 1000 * 60 * 5,
    placeholderData: () => initialCacheRef.current || undefined,
  });

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    clearDropsCache();
    initialCacheRef.current = null;
    
    await queryClient.invalidateQueries({ queryKey: ['drops-raw'] });
    await refetch();
    setIsRefreshing(false);
  }, [queryClient, refetch]);

  const displayDrops = rawDrops || initialCacheRef.current || [];

  return {
    drops: displayDrops,
    isLoading: isLoading && !initialCacheRef.current,
    isRefreshing,
    error: error as Error | null,
    refresh,
  };
}
