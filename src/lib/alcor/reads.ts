// Alcor API reads with blockchain fallback, and the combined farm view.
import { fetchTableRows } from '../waxRpcFallback';
import type { PoolSlot } from '../alcorV3Amounts';
import { ALCOR_API_BASE, ALCOR_SWAP_CONTRACT, API_TIMEOUT_MS } from './constants';
import { parseAsset, getAssetPrecision, slotFromPool } from './parse';
import {
  buildFarmPositionsFromOnChain,
  fetchIncentiveDetails,
  fetchPoolDetailsOnChain,
  fetchPoolIncentives,
  fetchUserPositionsOnChain,
  fetchUserStakesOnChain,
} from './chain';
import type { AlcorApiFarmPosition, AlcorApiPosition, AlcorFarmPosition, OnChainPool, UnstakedIncentive } from './types';

// Track data source for UI feedback - per-function tracking to avoid race conditions
let stakedFarmsDataSource: 'api' | 'blockchain' = 'api';
export function getAlcorDataSource(): 'api' | 'blockchain' {
  return stakedFarmsDataSource;
}

// ============= API Functions with Blockchain Fallback =============

/**
 * Fetch user's staked farm positions - API with blockchain fallback
 */
export async function fetchUserStakedFarms(accountName: string): Promise<AlcorApiFarmPosition[]> {
  // Try API first with timeout
  let apiData: AlcorApiFarmPosition[] | null = null;
  let apiSucceeded = false;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    const response = await fetch(`${ALCOR_API_BASE}/account/${accountName}/farms`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data)) {
        apiSucceeded = true;
        apiData = data;
      }
    }
    if (!apiSucceeded) {
      console.warn(`[Alcor] Farms API returned ${response.status}, trying blockchain...`);
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.warn('[Alcor] Farms API timeout, falling back to blockchain...');
    } else {
      console.warn('[Alcor] Farms API error:', error.message);
    }
  }

  // If API returned data with items, use it directly
  if (apiSucceeded && apiData && apiData.length > 0) {
    stakedFarmsDataSource = 'api';
    console.log('[Alcor] Farm positions from API:', apiData.length);
    return apiData;
  }

  // If API returned empty [], cross-validate with blockchain before trusting it
  if (apiSucceeded && apiData && apiData.length === 0) {
    console.log('[Alcor] API returned empty farms, cross-validating with blockchain...');
    try {
      const stakes = await fetchUserStakesOnChain(accountName);
      if (stakes.length > 0) {
        // API was stale/wrong - blockchain has stakes, use blockchain data
        console.warn('[Alcor] API returned empty but blockchain has', stakes.length, 'stakes - using blockchain data');
        stakedFarmsDataSource = 'blockchain';
        const positions = await fetchUserPositionsOnChain(accountName);
        return buildFarmPositionsFromOnChain(accountName, stakes, positions);
      } else {
        // Both agree: genuinely no stakes
        stakedFarmsDataSource = 'api';
        console.log('[Alcor] Confirmed: user has no staked farms');
        return [];
      }
    } catch (validationError) {
      // Cross-validation failed, trust API empty result
      console.warn('[Alcor] Cross-validation failed, trusting API empty result');
      stakedFarmsDataSource = 'api';
      return [];
    }
  }

  // API failed entirely - use blockchain fallback
  try {
    stakedFarmsDataSource = 'blockchain';
    console.log('[Alcor] Fetching farm data from blockchain...');

    const [stakes, positions] = await Promise.all([
      fetchUserStakesOnChain(accountName),
      fetchUserPositionsOnChain(accountName),
    ]);

    if (stakes.length === 0) {
      return [];
    }

    return buildFarmPositionsFromOnChain(accountName, stakes, positions);
  } catch (blockchainError) {
    console.error('[Alcor] Blockchain fallback also failed:', blockchainError);
    return [];
  }
}

/**
 * Fetch user's LP positions - API with blockchain fallback
 */
export async function fetchUserPositions(accountName: string): Promise<AlcorApiPosition[]> {
  // Try API first with timeout
  let apiData: AlcorApiPosition[] | null = null;
  let apiSucceeded = false;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    const response = await fetch(`${ALCOR_API_BASE}/account/${accountName}/positions`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data)) {
        apiSucceeded = true;
        apiData = data;
      }
    }
    if (!apiSucceeded) {
      console.warn(`[Alcor] Positions API returned ${response.status}, trying blockchain...`);
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.warn('[Alcor] Positions API timeout, falling back to blockchain...');
    } else {
      console.warn('[Alcor] Positions API error:', error.message);
    }
  }

  // If API returned data with items, use it
  if (apiSucceeded && apiData && apiData.length > 0) {
    console.log('[Alcor] Positions from API:', apiData.length);
    return apiData;
  }

  // If API returned empty, cross-validate with blockchain
  if (apiSucceeded && apiData && apiData.length === 0) {
    console.log('[Alcor] API returned empty positions, cross-validating with blockchain...');
    try {
      const onChainPositions = await fetchUserPositionsOnChain(accountName);
      if (onChainPositions.length > 0) {
        console.warn('[Alcor] API returned empty but blockchain has', onChainPositions.length, 'positions - using blockchain');
        return onChainPositions;
      } else {
        console.log('[Alcor] Confirmed: user has no positions');
        return [];
      }
    } catch (validationError) {
      console.warn('[Alcor] Cross-validation failed, trusting API empty result');
      return [];
    }
  }

  // API failed entirely - use blockchain fallback
  try {
    return fetchUserPositionsOnChain(accountName);
  } catch (blockchainError) {
    console.error('[Alcor] Blockchain fallback also failed:', blockchainError);
    return [];
  }
}

/**
 * Fetch pool details - API with blockchain fallback
 */
export async function fetchPoolDetails(poolId: number): Promise<any | null> {
  // Try API first with timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    const response = await fetch(`${ALCOR_API_BASE}/swap/pools/${poolId}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      return await response.json();
    }
  } catch (error: any) {
    console.warn(`[Alcor] Pool ${poolId} API error, trying blockchain...`);
  }

  // Fallback to blockchain
  try {
    return fetchPoolDetailsOnChain(poolId);
  } catch (blockchainError) {
    console.error(`[Alcor] Failed to fetch pool ${poolId}:`, blockchainError);
    return null;
  }
}

/**
 * Fetch the pool's current price slot (sqrt price + tick) plus its token order.
 * Needed to size a concentrated-liquidity deposit at the exact ratio the pool
 * will accept. Reads the chain table first and uncached: a stale price makes
 * the pool reject the deposit with "Price slippage check".
 */
export async function fetchPoolSlot(poolId: number): Promise<PoolSlot | null> {
  try {
    const result = await fetchTableRows<OnChainPool>({
      code: ALCOR_SWAP_CONTRACT,
      scope: ALCOR_SWAP_CONTRACT,
      table: 'pools',
      lower_bound: String(poolId),
      upper_bound: String(poolId),
      limit: 1,
    });
    const row = result?.rows?.[0];
    if (row) {
      const slot = slotFromPool(row);
      if (slot) return slot;
    }
  } catch (error) {
    console.warn(`[Alcor] Pool ${poolId} slot read from chain failed, trying API...`, error);
  }

  try {
    return slotFromPool(await fetchPoolDetails(poolId));
  } catch (error) {
    console.error(`[Alcor] Failed to read pool ${poolId} slot:`, error);
    return null;
  }
}

/**
 * Combine farm positions with LP position details
 */
export interface StakedFarmsWithPositions {
  farms: AlcorFarmPosition[];
  positions: AlcorApiPosition[];
}

export async function fetchUserStakedFarmsWithDetails(accountName: string): Promise<StakedFarmsWithPositions> {
  // Fetch farms and positions in parallel (single shared fetch for positions)
  const [farmPositions, lpPositions] = await Promise.all([
    fetchUserStakedFarms(accountName),
    fetchUserPositions(accountName),
  ]);

  if (farmPositions.length === 0) {
    return { farms: [], positions: lpPositions };
  }

  // Create a map of position ID to LP position details
  const positionMap = new Map<number, AlcorApiPosition>();
  lpPositions.forEach(pos => positionMap.set(pos.id, pos));

  // Fetch unique pool details and incentive details in parallel
  const uniquePoolIds = [...new Set(farmPositions.map(f => f.pool))];
  const uniqueIncentiveIds = [...new Set(farmPositions.map(f => f.incentiveId))];

  const poolDetails = new Map<number, any>();
  const incentiveDetails = new Map<number, any>();

  await Promise.all([
    // Fetch pool details
    ...uniquePoolIds.map(async (poolId) => {
      const pool = await fetchPoolDetails(poolId);
      if (pool) poolDetails.set(poolId, pool);
    }),
    // Fetch incentive details for reward token contracts
    ...uniqueIncentiveIds.map(async (incentiveId) => {
      const incentive = await fetchIncentiveDetails(incentiveId);
      if (incentive) incentiveDetails.set(incentiveId, incentive);
    }),
  ]);

  // Combine data
  const result: AlcorFarmPosition[] = [];

  for (const farm of farmPositions) {
    const lpPosition = positionMap.get(farm.posId);
    const pool = poolDetails.get(farm.pool);
    const incentive = incentiveDetails.get(farm.incentiveId);

    // Parse farmed reward (e.g., "7.0782 CHEESE")
    const farmedReward = parseAsset(farm.farmedReward);
    const dailyRewards = parseAsset(farm.dailyRewards);

    // Parse LP position amounts
    const amountA = lpPosition ? parseAsset(lpPosition.amountA) : { amount: 0, symbol: 'TOKEN A', precision: 4 };
    const amountB = lpPosition ? parseAsset(lpPosition.amountB) : { amount: 0, symbol: 'TOKEN B', precision: 4 };

    // Get token contracts from pool data
    const tokenAContract = pool?.tokenA?.contract || '';
    const tokenBContract = pool?.tokenB?.contract || '';
    // Get reward contract from incentive details
    const rewardContract = incentive?.reward?.contract || '';

    result.push({
      positionId: farm.posId,
      incentiveId: farm.incentiveId,
      poolId: farm.pool,
      liquidity: farm.stakingWeight,
      tickLower: lpPosition?.tickLower ?? 0,
      tickUpper: lpPosition?.tickUpper ?? 0,
      tokenA: {
        contract: tokenAContract,
        symbol: amountA.symbol,
        amount: amountA.amount,
      },
      tokenB: {
        contract: tokenBContract,
        symbol: amountB.symbol,
        amount: amountB.amount,
      },
      rewardToken: {
        contract: rewardContract,
        symbol: farmedReward.symbol,
        precision: farmedReward.precision,
      },
      pendingReward: farmedReward.amount,
      rewardPerSecond: dailyRewards.amount / 86400,
      rewardShare: farm.userSharePercent,
      dailyEarnRate: dailyRewards.amount,
      dailyRewardsDisplay: farm.dailyRewards,
      incentiveEndsAt: incentive?.periodFinish || 0,
      isInRange: lpPosition?.inRange ?? true,
      fee: 0,
      lastUpdate: Math.floor(Date.now() / 1000),
      farmedRewardDisplay: farm.farmedReward,
    });
  }

  return { farms: result, positions: lpPositions };
}

/**
 * Fetch unstaked incentives for a position (incentives available but not staked to)
 */
export async function fetchUnstakedIncentivesForPosition(
  positionId: number,
  poolId: number,
  stakedIncentiveIds: number[]
): Promise<UnstakedIncentive[]> {
  const allIncentives = await fetchPoolIncentives(poolId);

  // Filter out already staked incentives
  const unstakedIncentives = allIncentives.filter(
    (incentive: any) => !stakedIncentiveIds.includes(incentive.id)
  );

  return unstakedIncentives.map((incentive: any) => {
    const rewardAsset = incentive.reward?.quantity || '0.00000000 TOKEN';
    const rewardParts = rewardAsset.split(' ');
    const precision = getAssetPrecision(rewardAsset);

    return {
      incentiveId: incentive.id,
      poolId: incentive.pool || poolId,
      rewardToken: {
        contract: incentive.reward?.contract || '',
        symbol: rewardParts[1] || 'TOKEN',
        precision,
      },
      totalReward: parseFloat(rewardParts[0]) || 0,
      rewardPerDay: incentive.rewardPerDay || 0,
    };
  });
}
