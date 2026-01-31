import { useState, useEffect, useCallback } from 'react';

const ALCOR_API = 'https://wax.alcor.exchange/api';

export interface AlcorFarm {
  id: number;
  creator: string;
  poolId: number;
  rewardToken: {
    contract: string;
    symbol: string;
    quantity: string;
  };
  periodFinish: number;
  rewardRate: string;
  rewardsDuration: number;
  totalStakingWeight: string;
  stakeToken: {
    contract: string;
    symbol: string;
  };
}

export interface UserStake {
  farmId: number;
  amount: string;
  pendingReward: string;
}

export function useAlcorFarms() {
  const [farms, setFarms] = useState<AlcorFarm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFarms = useCallback(async () => {
    try {
      const response = await fetch(`${ALCOR_API}/v2/farms`);
      if (!response.ok) throw new Error('Failed to fetch farms');
      const data: AlcorFarm[] = await response.json();
      setFarms(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFarms();
    const interval = setInterval(fetchFarms, 60000);
    return () => clearInterval(interval);
  }, [fetchFarms]);

  return { farms, loading, error, refetch: fetchFarms };
}

export function useUserAlcorStakes(account: string | undefined) {
  const [stakes, setStakes] = useState<UserStake[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStakes = useCallback(async () => {
    if (!account) {
      setStakes([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${ALCOR_API}/v2/account/${account}/farms`);
      if (!response.ok) throw new Error('Failed to fetch stakes');
      const data: UserStake[] = await response.json();
      setStakes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [account]);

  useEffect(() => {
    fetchStakes();
  }, [fetchStakes]);

  return { stakes, loading, error, refetch: fetchStakes };
}
