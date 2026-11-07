import { useState, useEffect, useCallback } from "react";
import { chainPost } from "@/lib/chainRequest";

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

    try {
        const data = await chainPost<{ rows: { total_powerups: number; total_wax_spent: string; total_cheese_received: string }[] }>("/v1/chain/get_table_rows", {
          code: "cheesepowerz", scope: "cheesepowerz", table: "stats", json: true, limit: 1,
        }, { timeoutMs: 3_500 });

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
        console.error("Failed to fetch contract stats:", err);
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
