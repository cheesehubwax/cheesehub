import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchFarmCapacityConfig, type FarmInfo } from '@/lib/farm';
import { farmCapacitySummary } from '@/lib/farmCapacity';

export function useFarmCapacity(farm: FarmInfo | undefined, enabled = true) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 30_000);
    return () => clearInterval(timer);
  }, [enabled]);
  const query = useQuery({
    queryKey: ['farmCapacityConfig', farm?.farm_name, farm?.farm_type],
    queryFn: () => {
      if (!farm) throw new Error('Farm unavailable');
      return fetchFarmCapacityConfig(farm.farm_name, farm.farm_type);
    },
    enabled: enabled && !!farm && farm.status === 1 && farm.expiration > now,
    staleTime: 30_000,
    refetchInterval: enabled ? 30_000 : false,
    retry: 1,
  });
  return { ...query, now, summary: farm ? farmCapacitySummary(farm, query.data, now) : 'unknown' as const };
}