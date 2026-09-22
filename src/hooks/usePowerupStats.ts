import { useState, useEffect, useCallback } from "react";
import { resolveEndpoints } from "@/lib/endpointHealth";

export interface PowerupStats {
  totalPowerups: number;
  waxBurnt: number;
  cheeseNulled: number;
}

interface UsePowerupStatsResult {
  stats: PowerupStats | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

const WAX_FALLBACK = [
  "https://wax.hivebp.io",
  "https://api.wax.alohaeos.com",
  "https://wax.eosusa.io",
  "https://api.waxsweden.org",
  "https://wax.greymass.com",
];

const parseAsset = (assetStr: string): number => {
  if (!assetStr) return 0;
  const parts = assetStr.split(" ");
  return parseFloat(parts[0]) || 0;
};

export const usePowerupStats = (): UsePowerupStatsResult => {
  const [stats, setStats] = useState<PowerupStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    for (const base of await resolveEndpoints("chain-api", WAX_FALLBACK)) {
      try {
        const response = await fetch(`${base}/v1/chain/get_table_rows`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: "cheesepowerz",
            scope: "cheesepowerz",
            table: "stats",
            json: true,
            limit: 1,
          }),
        });

        if (!response.ok) continue;

        const data = await response.json();

        if (data.rows && data.rows.length > 0) {
          const row = data.rows[0];
          setStats({
            totalPowerups: row.total_powerups || 0,
            waxBurnt: parseAsset(row.total_wax_spent),
            cheeseNulled: parseAsset(row.total_cheese_received),
          });
          setIsLoading(false);
          return;
        } else {
          setStats({ totalPowerups: 0, waxBurnt: 0, cheeseNulled: 0 });
          setIsLoading(false);
          return;
        }
      } catch (err) {
        console.error(`Failed to fetch from ${endpoint}:`, err);
        continue;
      }
    }

    setError("Failed to fetch contract stats");
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    isLoading,
    error,
    refetch: fetchStats,
  };
};
