import { useState, useEffect, useCallback } from "react";
import { useDebounce } from "@/hooks/useDebounce";

export interface PowerUpEstimate {
  cheesePriceInWax: number;
  cheeseUsdPrice: number;
  waxUsdPrice: number;
  cpuWaxAmount: number;
  netWaxAmount: number;
  estimatedCpuMs: number;
  estimatedNetBytes: number;
  cpuUtilization: number;
  netUtilization: number;
  powerupDays: number;
}

interface UsePowerupEstimateResult {
  estimate: PowerUpEstimate | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

interface PowerUpStateRow {
  version: number;
  net: {
    weight: string;
    weight_ratio: string;
    assumed_stake_weight: string;
    initial_weight_ratio: string;
    target_weight_ratio: string;
    initial_timestamp: string;
    target_timestamp: string;
    exponent: number;
    decay_secs: number;
    min_price: string;
    max_price: string;
    utilization: string;
    adjusted_utilization: string;
    utilization_timestamp: string;
  };
  cpu: {
    weight: string;
    weight_ratio: string;
    assumed_stake_weight: string;
    initial_weight_ratio: string;
    target_weight_ratio: string;
    initial_timestamp: string;
    target_timestamp: string;
    exponent: number;
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

const WAX_ENDPOINTS = [
  "https://wax.eosusa.io",
  "https://api.waxsweden.org",
  "https://wax.greymass.com",
];

const POWERUP_FRAC = 1e15;

const CPU_MS_PER_FRAC = 78.45 / 3.45e9;
const NET_BYTES_PER_FRAC = 1.4e9 / 4.2e9;

export const parsePriceWax = (priceStr: string): number => {
  const match = priceStr.match(/^([\d.]+)/);
  return match ? parseFloat(match[1]) * 1e8 : 0;
};

export async function fetchPowerupState(): Promise<PowerUpStateRow | null> {
  for (const baseUrl of WAX_ENDPOINTS) {
    try {
      const response = await fetch(`${baseUrl}/v1/chain/get_table_rows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: "eosio",
          scope: "0",
          table: "powup.state",
          json: true,
          limit: 1,
        }),
      });
      if (!response.ok) continue;
      const data = await response.json();
      if (data.rows && data.rows.length > 0) {
        return data.rows[0] as PowerUpStateRow;
      }
    } catch (err) {
      console.error(`Failed to fetch powerup state from ${baseUrl}:`, err);
      continue;
    }
  }
  return null;
}

const estimatePowerupFee = (
  frac: number,
  weight: number,
  adjustedUtil: number,
  minPrice: number,
  maxPrice: number,
  exponent: number
): number => {
  if (frac <= 0) return 0;
  const amount = (frac * weight) / POWERUP_FRAC;
  if (amount <= 0) return 0;
  const startU = adjustedUtil / weight;
  const endU = (adjustedUtil + amount) / weight;
  const coefficient = (maxPrice - minPrice) / exponent;
  const fee = minPrice * (endU - startU) +
              coefficient * (Math.pow(endU, exponent) - Math.pow(startU, exponent));
  return Math.ceil(fee);
};

export const findFracForWax = (
  targetWax: number,
  weight: number,
  adjustedUtil: number,
  minPrice: number,
  maxPrice: number,
  exponent: number
): number => {
  const targetFee = targetWax * 1e8;
  if (targetFee <= 0) return 0;

  let low = 0;
  let high = POWERUP_FRAC;

  while (low < high) {
    const mid = low + Math.floor((high - low + 1) / 2);
    const estimatedFee = estimatePowerupFee(mid, weight, adjustedUtil, minPrice, maxPrice, exponent);
    if (estimatedFee <= targetFee) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  return Math.floor(low * 0.95);
};

/** Cheese price can be passed in from useCheesePriceData to avoid a separate API call */
interface CheesePriceInput {
  priceInWax: number;
  usdPrice: number;
}

export const usePowerupEstimate = (
  cpuAmount: number,
  netAmount: number,
  isWaxMode: boolean = false,
  cheesePrice?: CheesePriceInput
): UsePowerupEstimateResult => {
  const [estimate, setEstimate] = useState<PowerUpEstimate | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedCpu = useDebounce(cpuAmount, 500);
  const debouncedNet = useDebounce(netAmount, 500);

  const cheesePriceInWax = cheesePrice?.priceInWax ?? 0;
  const cheeseUsdPrice = cheesePrice?.usdPrice ?? 0;

  const fetchEstimate = useCallback(async () => {
    if (debouncedCpu <= 0 && debouncedNet <= 0) {
      setEstimate(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const priceInWax = isWaxMode ? 1 : cheesePriceInWax;
      const usdPrice = isWaxMode ? 0 : cheeseUsdPrice;
      const waxUsdPrice = priceInWax > 0 ? usdPrice / priceInWax : 0;

      const powerupState = await fetchPowerupState();

      if (!powerupState) {
        throw new Error("Failed to fetch PowerUp state");
      }

      const cpuWaxAmount = isWaxMode ? (debouncedCpu || 0) : (debouncedCpu || 0) * priceInWax;
      const netWaxAmount = isWaxMode ? (debouncedNet || 0) : (debouncedNet || 0) * priceInWax;

      const cpuWeight = parseFloat(powerupState.cpu.weight);
      const netWeight = parseFloat(powerupState.net.weight);
      const cpuAdjustedUtil = parseFloat(powerupState.cpu.adjusted_utilization);
      const netAdjustedUtil = parseFloat(powerupState.net.adjusted_utilization);

      const cpuMinPrice = parsePriceWax(powerupState.cpu.min_price);
      const cpuMaxPrice = parsePriceWax(powerupState.cpu.max_price);
      const netMinPrice = parsePriceWax(powerupState.net.min_price);
      const netMaxPrice = parsePriceWax(powerupState.net.max_price);
      const cpuExponent = powerupState.cpu.exponent;
      const netExponent = powerupState.net.exponent;

      const cpuU0 = cpuWeight > 0 ? cpuAdjustedUtil / cpuWeight : 0;
      const netU0 = netWeight > 0 ? netAdjustedUtil / netWeight : 0;
      const cpuUtilization = cpuU0 * 100;
      const netUtilization = netU0 * 100;

      const cpuFrac = findFracForWax(cpuWaxAmount, cpuWeight, cpuAdjustedUtil, cpuMinPrice, cpuMaxPrice, cpuExponent);
      const netFrac = findFracForWax(netWaxAmount, netWeight, netAdjustedUtil, netMinPrice, netMaxPrice, netExponent);

      const estimatedCpuMs = cpuFrac * CPU_MS_PER_FRAC;
      const estimatedNetBytes = netFrac * NET_BYTES_PER_FRAC;

      setEstimate({
        cheesePriceInWax: priceInWax,
        cheeseUsdPrice: usdPrice,
        waxUsdPrice,
        cpuWaxAmount,
        netWaxAmount,
        estimatedCpuMs,
        estimatedNetBytes,
        cpuUtilization,
        netUtilization,
        powerupDays: powerupState.powerup_days,
      });
    } catch (err) {
      console.error("Error fetching estimate:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch estimate");
      setEstimate(null);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedCpu, debouncedNet, isWaxMode, cheesePriceInWax, cheeseUsdPrice]);

  useEffect(() => {
    fetchEstimate();
  }, [fetchEstimate]);

  return {
    estimate,
    isLoading,
    error,
    refetch: fetchEstimate,
  };
};
