import { useState, useEffect } from 'react';
import { getCheeseStats, type CheeseStats } from '@/lib/cheeseStats';

export function useCheeseStats() {
  const [stats, setStats] = useState<CheeseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadStats() {
      try {
        const data = await getCheeseStats();
        if (mounted) {
          setStats(data);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch stats');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadStats();
    const interval = setInterval(loadStats, 60000); // Refresh every minute

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return { stats, loading, error };
}
