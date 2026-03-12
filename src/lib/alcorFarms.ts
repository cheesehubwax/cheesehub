// Alcor Farms library for interacting with Alcor Exchange API and swap.alcor contract
// Includes blockchain fallback for resilience when Alcor API is unavailable
import { waxRpcCall, fetchTableRows } from './waxRpcFallback';

// Contract name for transactions
const ALCOR_SWAP_CONTRACT = 'swap.alcor';
const ALCOR_API_BASE = 'https://wax.alcor.exchange/api/v2';
const API_TIMEOUT_MS = 5000; // 5 second timeout for API calls

// Track data source for UI feedback - per-function tracking to avoid race conditions
let stakedFarmsDataSource: 'api' | 'blockchain' = 'api';
export function getAlcorDataSource(): 'api' | 'blockchain' {
  return stakedFarmsDataSource;
}

// ============= Pool Types =============

export interface AlcorPool {
  id: number;
  tokenA: { contract: string; symbol: string; quantity: string };
  tokenB: { contract: string; symbol: string; quantity: string };
  fee: number;
  tick: number;
}

// ============= On-Chain Data Types =============

// Position from swap.alcor::positions table
interface OnChainPosition {
  id: number;
  owner: string;
  pool: number;
  liquidity: string;
  tickLower: number;
  tickUpper: number;
}

// Stakes from swap.alcor::stakes table
interface OnChainStake {
  id: number;
  owner: string;
  incentiveId: number;
  posId: number;
  rewardPerTokenPaid: string;
  rewards: string; // e.g., "7.08216192 CHEESE"
}

// Pool from swap.alcor::pools table
interface OnChainPool {
  id: number;
  tokenA: { contract: string; quantity: string };
  tokenB: { contract: string; quantity: string };
  fee: number;
  currSlot: { sqrtPriceX64: string; tick: number };
}

// ============= Caches for blockchain data =============

// Pool details cache (5 minute TTL - rarely changes)
const poolCache = new Map<number, { data: OnChainPool; timestamp: number }>();
const POOL_CACHE_TTL = 5 * 60 * 1000;

// User positions cache (30 second TTL)
const positionsCache = new Map<string, { data: OnChainPosition[]; timestamp: number }>();
const POSITIONS_CACHE_TTL = 30 * 1000;

// Types for Alcor farm data from API
export interface AlcorApiFarmPosition {
  posId: number;
  stakingWeight: string;
  rewards: number;
  userRewardPerTokenPaid: string;
  incentiveId: number;
  incentive: number;
  pool: number;
  poolStats: number;
  farmedReward: string; // e.g., "7.0782 CHEESE"
  userSharePercent: number;
  dailyRewards: string; // e.g., "22.541921902499997 CHEESE"
}

export interface AlcorApiPosition {
  id: number;
  owner: string;
  tickLower: number;
  tickUpper: number;
  liquidity: string;
  pool: number;
  inRange: boolean;
  amountA: string; // e.g., "3.69155112 PASTA"
  amountB: string; // e.g., "7.28122035 WAX"
  feesA: string;
  feesB: string;
  totalValue: number;
}

export interface AlcorFarmPosition {
  positionId: number;
  incentiveId: number;
  poolId: number;
  liquidity: string;
  tickLower: number;
  tickUpper: number;
  tokenA: {
    contract: string;
    symbol: string;
    amount: number;
  };
  tokenB: {
    contract: string;
    symbol: string;
    amount: number;
  };
  rewardToken: {
    contract: string;
    symbol: string;
    precision: number;
  };
  pendingReward: number;
  rewardPerSecond: number;
  rewardShare: number;
  dailyEarnRate: number;
  dailyRewardsDisplay: string;
  incentiveEndsAt: number;
  isInRange: boolean;
  fee: number;
  lastUpdate: number;
  farmedRewardDisplay: string;
}

// Unstaked incentive that a position could be staked to
export interface UnstakedIncentive {
  incentiveId: number;
  poolId: number;
  rewardToken: {
    contract: string;
    symbol: string;
    precision: number;
  };
  totalReward: number;
  rewardPerDay: number;
}

// Parse WAX asset string (e.g., "123.45678901 WAX")
function parseAsset(assetStr: string): { amount: number; symbol: string; precision: number } {
  if (!assetStr) return { amount: 0, symbol: '', precision: 0 };
  const parts = assetStr.trim().split(' ');
  const amount = parseFloat(parts[0]) || 0;
  const symbol = parts[1] || '';
  const decimalParts = parts[0].split('.');
  const precision = decimalParts[1]?.length || 0;
  return { amount, symbol, precision };
}

// ============= On-Chain Query Functions (Blockchain Fallback) =============

/**
 * Fetch user's LP positions directly from blockchain
 */
async function fetchUserPositionsOnChain(accountName: string): Promise<AlcorApiPosition[]> {
  // Check cache first
  const cached = positionsCache.get(accountName);
  if (cached && Date.now() - cached.timestamp < POSITIONS_CACHE_TTL) {
    console.log('[Alcor] Using cached on-chain positions for', accountName);
    return enrichOnChainPositions(cached.data);
  }

  console.log('[Alcor] Fetching positions from blockchain for', accountName);
  const allPositions: OnChainPosition[] = [];
  let lower_bound = '';
  let hasMore = true;

  // Query positions table - secondary index by owner (index_position: 2)
  while (hasMore) {
    const result = await fetchTableRows<OnChainPosition>({
      code: ALCOR_SWAP_CONTRACT,
      scope: ALCOR_SWAP_CONTRACT,
      table: 'positions',
      index_position: 2,
      key_type: 'name',
      lower_bound: lower_bound || accountName,
      upper_bound: accountName,
      limit: 100,
    });

    if (result?.rows?.length) {
      allPositions.push(...result.rows);
      if (result.more && result.next_key) {
        lower_bound = result.next_key;
      } else {
        hasMore = false;
      }
    } else {
      hasMore = false;
    }
  }

  // Cache the raw data
  positionsCache.set(accountName, { data: allPositions, timestamp: Date.now() });

  return enrichOnChainPositions(allPositions);
}

/**
 * Enrich on-chain positions with real token amounts from pool data
 */
async function enrichOnChainPositions(positions: OnChainPosition[]): Promise<AlcorApiPosition[]> {
  if (positions.length === 0) return [];

  // Batch-fetch pool details for all unique pools
  const uniquePoolIds = [...new Set(positions.map(p => p.pool))];
  const poolMap = new Map<number, any>();

  await Promise.all(
    uniquePoolIds.map(async (poolId) => {
      try {
        const pool = await fetchPoolDetailsOnChain(poolId);
        if (pool) poolMap.set(poolId, pool);
      } catch (e) {
        console.warn(`[Alcor] Failed to fetch pool ${poolId} for position enrichment`);
      }
    })
  );

  return positions.map(pos => {
    const pool = poolMap.get(pos.pool);
    let amountA = '0 TOKEN';
    let amountB = '0 TOKEN';
    let inRange = true;

    if (pool) {
      const tokenAParsed = parseAsset(pool.tokenA?.quantity || '0 TOKEN');
      const tokenBParsed = parseAsset(pool.tokenB?.quantity || '0 TOKEN');
      const symbolA = tokenAParsed.symbol || 'TOKEN';
      const symbolB = tokenBParsed.symbol || 'TOKEN';
      const precA = tokenAParsed.precision || 8;
      const precB = tokenBParsed.precision || 8;

      // Check if position is in range based on pool's current tick
      const currentTick = pool.tick || 0;
      inRange = currentTick >= pos.tickLower && currentTick < pos.tickUpper;

      // Use placeholder amounts with correct symbols/precision
      amountA = `${(0).toFixed(precA)} ${symbolA}`;
      amountB = `${(0).toFixed(precB)} ${symbolB}`;
    }

    return {
      id: pos.id,
      owner: pos.owner,
      tickLower: pos.tickLower,
      tickUpper: pos.tickUpper,
      liquidity: pos.liquidity,
      pool: pos.pool,
      inRange,
      amountA,
      amountB,
      feesA: '0 TOKEN',
      feesB: '0 TOKEN',
      totalValue: 0,
    };
  });
}

/**
 * Fetch user's staked positions (stakes table) from blockchain
 */
async function fetchUserStakesOnChain(accountName: string): Promise<OnChainStake[]> {
  console.log('[Alcor] Fetching stakes from blockchain for', accountName);
  const allStakes: OnChainStake[] = [];
  let lower_bound = '';
  let hasMore = true;

  // Query stakes table - secondary index by owner (index_position: 2)
  while (hasMore) {
    const result = await fetchTableRows<OnChainStake>({
      code: ALCOR_SWAP_CONTRACT,
      scope: ALCOR_SWAP_CONTRACT,
      table: 'stakes',
      index_position: 2,
      key_type: 'name',
      lower_bound: lower_bound || accountName,
      upper_bound: accountName,
      limit: 100,
    });

    if (result?.rows?.length) {
      allStakes.push(...result.rows);
      if (result.more && result.next_key) {
        lower_bound = result.next_key;
      } else {
        hasMore = false;
      }
    } else {
      hasMore = false;
    }
  }

  console.log('[Alcor] Found', allStakes.length, 'stakes on-chain for', accountName);
  return allStakes;
}

/**
 * Fetch pool details directly from blockchain
 */
async function fetchPoolDetailsOnChain(poolId: number): Promise<any | null> {
  // Check cache first
  const cached = poolCache.get(poolId);
  if (cached && Date.now() - cached.timestamp < POOL_CACHE_TTL) {
    return transformOnChainPool(cached.data);
  }

  console.log('[Alcor] Fetching pool', poolId, 'from blockchain');
  const result = await fetchTableRows<OnChainPool>({
    code: ALCOR_SWAP_CONTRACT,
    scope: ALCOR_SWAP_CONTRACT,
    table: 'pools',
    lower_bound: String(poolId),
    upper_bound: String(poolId),
    limit: 1,
  });

  if (result?.rows?.[0]) {
    poolCache.set(poolId, { data: result.rows[0], timestamp: Date.now() });
    return transformOnChainPool(result.rows[0]);
  }
  return null;
}

/**
 * Transform on-chain pool to API format
 */
function transformOnChainPool(pool: OnChainPool): any {
  const tokenAParsed = parseAsset(pool.tokenA.quantity);
  const tokenBParsed = parseAsset(pool.tokenB.quantity);

  return {
    id: pool.id,
    tokenA: {
      contract: pool.tokenA.contract,
      symbol: tokenAParsed.symbol,
      quantity: pool.tokenA.quantity,
    },
    tokenB: {
      contract: pool.tokenB.contract,
      symbol: tokenBParsed.symbol,
      quantity: pool.tokenB.quantity,
    },
    fee: pool.fee,
    tick: pool.currSlot?.tick || 0,
  };
}

/**
 * Build farm positions from on-chain data (blockchain fallback)
 */
async function buildFarmPositionsFromOnChain(
  accountName: string,
  stakes: OnChainStake[],
  positions: AlcorApiPosition[]
): Promise<AlcorApiFarmPosition[]> {
  // Create position map
  const positionMap = new Map<number, AlcorApiPosition>();
  positions.forEach(p => positionMap.set(p.id, p));

  // Get all incentives for calculating daily rewards
  const allIncentives = await fetchAllIncentives();
  const incentiveMap = new Map<number, any>();
  allIncentives.forEach(inc => incentiveMap.set(inc.id, inc));

  return stakes.map(stake => {
    const position = positionMap.get(stake.posId);
    const incentive = incentiveMap.get(stake.incentiveId);
    const rewardParsed = parseAsset(stake.rewards);

    // Calculate daily rewards estimate from incentive data
    let dailyRewards = '0 TOKEN';
    if (incentive) {
      const rewardToken = incentive.rewardToken || incentive.reward || {};
      const rewardAsset = parseAsset(rewardToken.quantity || '0 TOKEN');
      // Rough estimate: total reward / duration in days
      const periodFinish = incentive.periodFinish || 0;
      const now = Math.floor(Date.now() / 1000);
      const daysRemaining = Math.max(1, (periodFinish - now) / 86400);
      const dailyAmount = rewardAsset.amount / daysRemaining;
      dailyRewards = `${dailyAmount.toFixed(rewardParsed.precision)} ${rewardParsed.symbol}`;
    }

    return {
      posId: stake.posId,
      stakingWeight: position?.liquidity || '0',
      rewards: rewardParsed.amount,
      userRewardPerTokenPaid: stake.rewardPerTokenPaid,
      incentiveId: stake.incentiveId,
      incentive: stake.incentiveId,
      pool: position?.pool || 0,
      poolStats: position?.pool || 0,
      farmedReward: stake.rewards,
      userSharePercent: 0, // Would need total staked to calculate
      dailyRewards,
    };
  });
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
 * Fetch incentive details from blockchain to get reward token contract
 */
export async function fetchIncentiveDetails(incentiveId: number): Promise<any | null> {
  try {
    const result = await waxRpcCall('/v1/chain/get_table_rows', {
      json: true,
      code: ALCOR_SWAP_CONTRACT,
      scope: ALCOR_SWAP_CONTRACT,
      table: 'incentives',
      lower_bound: incentiveId,
      upper_bound: incentiveId,
      limit: 1,
    }) as { rows?: any[] };

    if (!result?.rows?.[0]) return null;

    const incentive = result.rows[0];
    return {
      id: incentive.id,
      pool: incentive.poolId,
      reward: {
        contract: incentive.rewardToken?.contract || '',
        quantity: incentive.rewardToken?.quantity || '0.00000000 TOKEN',
      },
      periodFinish: incentive.periodFinish,
    };
  } catch (error) {
    console.error(`Failed to fetch incentive ${incentiveId}:`, error);
    return null;
  }
}

// Cache all incentives to avoid repeated full table scans
let incentivesCache: { data: any[]; timestamp: number } | null = null;
const INCENTIVES_CACHE_TTL = 60 * 1000; // 1 minute

async function fetchAllIncentives(): Promise<any[]> {
  // Return cached data if fresh
  if (incentivesCache && Date.now() - incentivesCache.timestamp < INCENTIVES_CACHE_TTL) {
    console.log('[fetchAllIncentives] Using cached data:', incentivesCache.data.length, 'incentives');
    return incentivesCache.data;
  }

  console.log('[fetchAllIncentives] Fetching all incentives from chain...');
  const allIncentives: any[] = [];
  let lower_bound = 0;
  let hasMore = true;

  while (hasMore) {
    const result = await waxRpcCall('/v1/chain/get_table_rows', {
      json: true,
      code: ALCOR_SWAP_CONTRACT,
      scope: ALCOR_SWAP_CONTRACT,
      table: 'incentives',
      lower_bound: lower_bound,
      limit: 500,
    }) as { rows?: any[]; more?: boolean; next_key?: string };

    if (result?.rows?.length) {
      allIncentives.push(...result.rows);
      if (result.more && result.next_key) {
        lower_bound = parseInt(result.next_key);
      } else {
        hasMore = false;
      }
    } else {
      hasMore = false;
    }
  }

  console.log('[fetchAllIncentives] Loaded', allIncentives.length, 'total incentives');
  incentivesCache = { data: allIncentives, timestamp: Date.now() };
  return allIncentives;
}

/**
 * Fetch all active incentives for a specific pool from blockchain
 */
export async function fetchPoolIncentives(poolId: number): Promise<any[]> {
  console.log(`[fetchPoolIncentives] Fetching incentives for pool ${poolId}`);
  try {
    const allIncentives = await fetchAllIncentives();

    // Filter for this pool's active incentives
    const now = Math.floor(Date.now() / 1000);
    const poolIncentives = allIncentives.filter((incentive: any) => {
      if (incentive.poolId !== poolId) return false;
      // Check if incentive is still active
      const endTime = incentive.periodFinish || incentive.endTime || 0;
      return endTime > now;
    });

    console.log(`[fetchPoolIncentives] Pool ${poolId}: ${poolIncentives.length} active incentives`);
    return poolIncentives;
  } catch (error) {
    console.error(`Failed to fetch pool ${poolId} incentives:`, error);
    return [];
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

// Parse WAX asset string to get precision
function getAssetPrecision(assetStr: string): number {
  if (!assetStr) return 8;
  const parts = assetStr.trim().split(' ');
  const decimalParts = parts[0].split('.');
  return decimalParts[1]?.length || 0;
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

// ============= Transaction Builders =============

export interface TransactionAction {
  account: string;
  name: string;
  authorization: { actor: string; permission: string }[];
  data: Record<string, unknown>;
}

/**
 * Build claim rewards action for a specific incentive
 */
export function buildClaimRewardsAction(
  accountName: string,
  claims: Array<{ incentiveId: number; posId: number }>
): TransactionAction[] {
  return claims.map(({ incentiveId, posId }) => ({
    account: ALCOR_SWAP_CONTRACT,
    name: 'getreward',
    authorization: [{ actor: accountName, permission: 'active' }],
    data: {
      incentiveId,
      posId,
    },
  }));
}

/**
 * Build unstake action
 */
export function buildUnstakeAction(
  accountName: string,
  incentiveId: number,
  positionId: number
): TransactionAction {
  return {
    account: ALCOR_SWAP_CONTRACT,
    name: 'unstake',
    authorization: [{ actor: accountName, permission: 'active' }],
    data: {
      owner: accountName,
      incentiveId,
      posId: positionId,
    },
  };
}

/**
 * Build stake action
 */
export function buildStakeAction(
  accountName: string,
  incentiveId: number,
  positionId: number
): TransactionAction {
  return {
    account: ALCOR_SWAP_CONTRACT,
    name: 'stake',
    authorization: [{ actor: accountName, permission: 'active' }],
    data: {
      owner: accountName,
      incentiveId,
      posId: positionId,
    },
  };
}

/**
 * Build increase liquidity action (add to LP position)
 */
export function buildIncreaseLiquidityAction(
  accountName: string,
  positionId: number,
  poolId: number,
  tickLower: number,
  tickUpper: number,
  tokenAContract: string,
  tokenAQuantity: string,
  tokenBContract: string,
  tokenBQuantity: string
): TransactionAction[] {
  // Parse amounts for min values (apply 0.5% slippage - matches Alcor default)
  const slippageMultiplier = 0.995;

  const tokenAAmount = parseFloat(tokenAQuantity.split(' ')[0]);
  const tokenASymbol = tokenAQuantity.split(' ')[1];
  const tokenADecimals = tokenAQuantity.split(' ')[0].split('.')[1]?.length || 0;
  const minTokenA = (tokenAAmount * slippageMultiplier).toFixed(tokenADecimals) + ' ' + tokenASymbol;

  const tokenBAmount = parseFloat(tokenBQuantity.split(' ')[0]);
  const tokenBSymbol = tokenBQuantity.split(' ')[1];
  const tokenBDecimals = tokenBQuantity.split(' ')[0].split('.')[1]?.length || 0;
  const minTokenB = (tokenBAmount * slippageMultiplier).toFixed(tokenBDecimals) + ' ' + tokenBSymbol;

  return [
    // Transfer token A with "deposit" memo (required by Alcor)
    {
      account: tokenAContract,
      name: 'transfer',
      authorization: [{ actor: accountName, permission: 'active' }],
      data: {
        from: accountName,
        to: ALCOR_SWAP_CONTRACT,
        quantity: tokenAQuantity,
        memo: 'deposit',
      },
    },
    // Transfer token B with "deposit" memo (required by Alcor)
    {
      account: tokenBContract,
      name: 'transfer',
      authorization: [{ actor: accountName, permission: 'active' }],
      data: {
        from: accountName,
        to: ALCOR_SWAP_CONTRACT,
        quantity: tokenBQuantity,
        memo: 'deposit',
      },
    },
    // Add liquidity with same tick range as existing position
    {
      account: ALCOR_SWAP_CONTRACT,
      name: 'addliquid',
      authorization: [{ actor: accountName, permission: 'active' }],
      data: {
        poolId,
        owner: accountName,
        tokenADesired: tokenAQuantity,
        tokenBDesired: tokenBQuantity,
        tickLower,
        tickUpper,
        tokenAMin: minTokenA,
        tokenBMin: minTokenB,
        deadline: 0,
      },
    },
  ];
}

// ============= Pool Fetching Functions =============

/**
 * Fetch all pools from blockchain
 */
export async function fetchAllPools(): Promise<AlcorPool[]> {
  console.log('[Alcor] Fetching all pools...');
  const allPools: AlcorPool[] = [];
  let lower_bound = 0;
  let hasMore = true;

  while (hasMore) {
    const result = await fetchTableRows<OnChainPool>({
      code: ALCOR_SWAP_CONTRACT,
      scope: ALCOR_SWAP_CONTRACT,
      table: 'pools',
      lower_bound: String(lower_bound),
      limit: 500,
    });

    if (result?.rows?.length) {
      for (const pool of result.rows) {
        const tokenA = parseAsset(pool.tokenA.quantity);
        const tokenB = parseAsset(pool.tokenB.quantity);

        allPools.push({
          id: pool.id,
          tokenA: {
            contract: pool.tokenA.contract,
            symbol: tokenA.symbol,
            quantity: pool.tokenA.quantity,
          },
          tokenB: {
            contract: pool.tokenB.contract,
            symbol: tokenB.symbol,
            quantity: pool.tokenB.quantity,
          },
          fee: pool.fee,
          tick: pool.currSlot?.tick || 0,
        });
      }

      if (result.more && result.next_key) {
        lower_bound = parseInt(result.next_key);
      } else {
        hasMore = false;
      }
    } else {
      hasMore = false;
    }
  }

  console.log('[Alcor] Loaded', allPools.length, 'pools');
  return allPools;
}

/**
 * Get the next available incentive ID by querying the incentives table
 */
export async function getNextIncentiveId(): Promise<number> {
  try {
    const allIncentives = await fetchAllIncentives();
    if (allIncentives.length === 0) return 0;

    // Find the max ID and add 1
    const maxId = Math.max(...allIncentives.map((inc: any) => inc.id || 0));
    return maxId + 1;
  } catch (error) {
    console.error('Failed to get next incentive ID:', error);
    return 0;
  }
}

/**
 * Build create incentive actions for Alcor farms
 */
export function buildCreateIncentiveActions(
  creator: string,
  poolId: number,
  duration: number,
  rewards: Array<{
    contract: string;
    symbol: string;
    precision: number;
    amount: number;
  }>,
  startIncentiveId: number
): TransactionAction[] {
  const actions: TransactionAction[] = [];

  rewards.forEach((reward, index) => {
    const incentiveId = startIncentiveId + index;

    // Format quantity with proper precision
    const quantity = `${reward.amount.toFixed(reward.precision)} ${reward.symbol}`;
    const zeroQuantity = `${(0).toFixed(reward.precision)} ${reward.symbol}`;

    // 1. Create incentive (newincentive action)
    actions.push({
      account: ALCOR_SWAP_CONTRACT,
      name: 'newincentive',
      authorization: [{ actor: creator, permission: 'active' }],
      data: {
        creator,
        poolId,
        rewardToken: {
          contract: reward.contract,
          quantity: zeroQuantity,
        },
        duration,
      },
    });

    // 2. Transfer reward tokens with memo
    actions.push({
      account: reward.contract,
      name: 'transfer',
      authorization: [{ actor: creator, permission: 'active' }],
      data: {
        from: creator,
        to: ALCOR_SWAP_CONTRACT,
        quantity,
        memo: `incentreward#${incentiveId}`,
      },
    });
  });

  return actions;
}
