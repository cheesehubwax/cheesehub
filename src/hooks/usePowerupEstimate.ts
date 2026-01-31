import { useState, useEffect, useCallback } from 'react';
import { fetchTableRows } from '@/lib/waxRpcFallback';

export interface PowerupEstimate {
  cpuUs: number;
  netBytes: number;
  cpuFrac: number;
  netFrac: number;
}

export interface PowerupState {
  version: number;
  cpu: {
    weight: string;
    weight_ratio: string;
    assumed_stake_weight: string;
    initial_weight_ratio: string;
    target_weight_ratio: string;
    initial_timestamp: string;
    target_timestamp: string;
    exponent: string;
    decay_secs: number;
    min_price: string;
    max_price: string;
    utilization: string;
    adjusted_utilization: string;
    utilization_timestamp: string;
  };
  net: {
    weight: string;
    weight_ratio: string;
    assumed_stake_weight: string;
    initial_weight_ratio: string;
    target_weight_ratio: string;
    initial_timestamp: string;
    target_timestamp: string;
    exponent: string;
    decay_secs: number;
    min_price: string;
    max_price: string;
    utilization: string;
    adjusted_utilization: string;
    utilization_timestamp: string;
  };
  powerup_days: number;
  min_powerup_fee: string;
}

export function usePowerupEstimate(waxAmount: number) {
  const [estimate, setEstimate] = useState<PowerupEstimate | null>(null);
  const [powerupState, setPowerupState] = useState<PowerupState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPowerupState = useCallback(async () => {
    try {
      const response = await fetchTableRows<PowerupState>({
        code: 'eosio',
        scope: '0',
        table: 'powup.state',
        limit: 1,
      });

      if (response.rows.length > 0) {
        setPowerupState(response.rows[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch powerup state');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPowerupState();
  }, [fetchPowerupState]);

  useEffect(() => {
    if (!powerupState || waxAmount <= 0) {
      setEstimate(null);
      return;
    }

    // Calculate CPU and NET fractions based on WAX amount
    // This is a simplified calculation - actual values depend on current state
    const cpuWeight = parseFloat(powerupState.cpu.weight);
    const netWeight = parseFloat(powerupState.net.weight);

    // Estimate resources (simplified calculation)
    const waxInUnits = waxAmount * 10000; // Convert to units
    const cpuFrac = Math.min(waxInUnits / 100, 1); // Simplified fraction
    const netFrac = Math.min(waxInUnits / 100, 1);

    // Estimate microseconds and bytes (rough approximation)
    const cpuUs = Math.floor(cpuWeight * cpuFrac * 1000000);
    const netBytes = Math.floor(netWeight * netFrac);

    setEstimate({
      cpuUs,
      netBytes,
      cpuFrac,
      netFrac,
    });
  }, [powerupState, waxAmount]);

  return { estimate, powerupState, loading, error, refetch: fetchPowerupState };
}
