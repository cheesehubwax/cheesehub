import { useState, useEffect } from 'react';
import { fetchCheeseTotalTVL, type TVLData } from '@/lib/tvl';

export function useCheeseTVL(waxUsdPrice: number = 0, cheeseUsdPrice: number = 0) {
  const [tvlData, setTvlData] = useState<TVLData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadTVL() {
      if (waxUsdPrice <= 0) {
        setLoading(false);
        return;
      }

      try {
        const data = await fetchCheeseTotalTVL(waxUsdPrice, cheeseUsdPrice);
        if (mounted) {
          setTvlData(data);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch TVL');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadTVL();
    const interval = setInterval(loadTVL, 120000); // Refresh every 2 minutes

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [waxUsdPrice, cheeseUsdPrice]);

  return { tvlData, loading, error };
}
