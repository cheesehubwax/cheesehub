import { useQuery } from '@tanstack/react-query';
import {
  fetchBurnerConfig,
  fetchBurnerStats,
  fetchFeeFeeConfig,
  fetchBannadConfig,
  fetchBannadAdmins,
  fetchPowerzStats,
  fetchPoolReserves,
  calcPriceFromReserves,
  calcDeviation,
  type BurnerConfig,
  type BurnerStats,
  type FeeFeeConfig,
  type BannadConfig,
  type BannadAdmin,
  type PowerzStats,
} from '@/lib/adminData';

export interface PoolPriceData {
  pool1252: {
    waxPerCheese: number;
    cheesePerWax: number;
  } | null;
  pool1236: {
    waxdaoPerWax: number;
    waxPerWaxdao: number;
  } | null;
}

export interface ContractConfigsData {
  burnerConfig: BurnerConfig | null;
  burnerStats: BurnerStats | null;
  feefeeConfig: FeeFeeConfig | null;
  bannadConfig: BannadConfig | null;
  bannadAdmins: BannadAdmin[];
  powerzStats: PowerzStats | null;
  poolPrices: PoolPriceData;
  deviations: {
    cheeseWax: number | null;
    waxdaoWax: number | null;
    bannadCheese: number | null;
  };
}

async function fetchAllConfigs(): Promise<ContractConfigsData> {
  const [
    burnerConfig,
    burnerStats,
    feefeeConfig,
    bannadConfig,
    bannadAdmins,
    powerzStats,
    pool1252,
    pool1236,
  ] = await Promise.all([
    fetchBurnerConfig().catch(() => null),
    fetchBurnerStats().catch(() => null),
    fetchFeeFeeConfig().catch(() => null),
    fetchBannadConfig().catch(() => null),
    fetchBannadAdmins().catch(() => [] as BannadAdmin[]),
    fetchPowerzStats().catch(() => null),
    fetchPoolReserves(1252).catch(() => null),
    fetchPoolReserves(1236).catch(() => null),
  ]);

  // Pool 1252: CHEESE/WAX
  let pool1252Prices: PoolPriceData['pool1252'] = null;
  if (pool1252) {
    const prices = calcPriceFromReserves(pool1252);
    const aIsWax = pool1252.tokenA.contract === 'eosio.token';
    if (aIsWax) {
      pool1252Prices = { waxPerCheese: prices.priceBinA, cheesePerWax: prices.priceAinB };
    } else {
      pool1252Prices = { waxPerCheese: prices.priceAinB, cheesePerWax: prices.priceBinA };
    }
  }

  // Pool 1236: WAX/WAXDAO
  let pool1236Prices: PoolPriceData['pool1236'] = null;
  if (pool1236) {
    const prices = calcPriceFromReserves(pool1236);
    const aIsWax = pool1236.tokenA.contract === 'eosio.token';
    if (aIsWax) {
      pool1236Prices = { waxdaoPerWax: prices.priceAinB, waxPerWaxdao: prices.priceBinA };
    } else {
      pool1236Prices = { waxdaoPerWax: prices.priceBinA, waxPerWaxdao: prices.priceAinB };
    }
  }

  // Calculate deviations
  const cheeseWaxDev = feefeeConfig && pool1252Prices
    ? calcDeviation(pool1252Prices.waxPerCheese, Number(feefeeConfig.wax_per_cheese_baseline))
    : null;
  const waxdaoWaxDev = feefeeConfig && pool1236Prices
    ? calcDeviation(pool1236Prices.waxdaoPerWax, Number(feefeeConfig.waxdao_per_wax_baseline))
    : null;
  const bannadDev = bannadConfig && pool1252Prices
    ? calcDeviation(pool1252Prices.waxPerCheese, Number(bannadConfig.wax_per_cheese_baseline))
    : null;

  return {
    burnerConfig,
    burnerStats,
    feefeeConfig,
    bannadConfig,
    bannadAdmins,
    powerzStats,
    poolPrices: { pool1252: pool1252Prices, pool1236: pool1236Prices },
    deviations: {
      cheeseWax: cheeseWaxDev,
      waxdaoWax: waxdaoWaxDev,
      bannadCheese: bannadDev,
    },
  };
}

export function useContractConfigs(enabled: boolean) {
  return useQuery<ContractConfigsData>({
    queryKey: ['admin-contract-configs'],
    queryFn: fetchAllConfigs,
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
