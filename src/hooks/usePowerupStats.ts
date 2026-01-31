import { useState, useEffect, useCallback } from 'react';

const HYPERION_ENDPOINTS = [
  'https://wax.eosusa.io',
  'https://api.wax.alohaeos.com',
  'https://wax.eosphere.io',
];

export interface PowerupStats {
  totalPowerups: number;
  totalWaxSpent: number;
  uniqueUsers: number;
  last24hPowerups: number;
  averageCost: number;
}

interface HyperionAction {
  timestamp: string;
  act: {
    authorization: { actor: string }[];
    data: { max_payment?: string };
  };
}

async function fetchHyperionActions(): Promise<HyperionAction[]> {
  for (const baseUrl of HYPERION_ENDPOINTS) {
    try {
      const response = await fetch(
        `${baseUrl}/v2/history/get_actions?account=eosio&filter=eosio:powerup&limit=100`
      );
      if (!response.ok) continue;
      const data = await response.json();
      return data.actions || [];
    } catch (err) {
      console.warn(`Hyperion ${baseUrl} failed:`, err);
    }
  }
  return [];
}

export function usePowerupStats() {
  const [stats, setStats] = useState<PowerupStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const actions = await fetchHyperionActions();

      if (actions.length > 0) {
        const uniqueUsers = new Set(actions.map((a) => 
          a.act?.authorization?.[0]?.actor
        )).size;

        const now = Date.now();
        const oneDayAgo = now - 24 * 60 * 60 * 1000;

        const last24h = actions.filter((a) => 
          new Date(a.timestamp).getTime() > oneDayAgo
        );

        // Calculate total WAX spent
        let totalWax = 0;
        actions.forEach((a) => {
          const payment = a.act?.data?.max_payment;
          if (payment) {
            const amount = parseFloat(payment.split(' ')[0]);
            if (!isNaN(amount)) totalWax += amount;
          }
        });

        setStats({
          totalPowerups: actions.length,
          totalWaxSpent: totalWax,
          uniqueUsers,
          last24hPowerups: last24h.length,
          averageCost: actions.length > 0 ? totalWax / actions.length : 0,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 300000); // Refresh every 5 minutes
    return () => clearInterval(interval);
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}
