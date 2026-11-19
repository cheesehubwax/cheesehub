// On-chain swap.alcor reads (blockchain fallback, incentives, pools).
import { waxRpcCall, fetchTableRows } from '../waxRpcFallback';
import { positionRawAmounts } from '../alcorV3Amounts';
import { fetchActionsUnion } from '../hyperionHistory';
import { mapLimit } from '../chainRequest';
import { ALCOR_SWAP_CONTRACT } from './constants';
import { parseAsset } from './parse';
import type { AlcorApiFarmPosition, AlcorApiPosition, AlcorPool, OnChainPool, OnChainPosition, OnChainStake } from './types';

// ============= Caches for blockchain data =============

// Pool details cache (5 minute TTL - rarely changes)
export const poolCache = new Map<number, { data: OnChainPool; timestamp: number }>();
const POOL_CACHE_TTL = 5 * 60 * 1000;

// User positions cache (30 second TTL)
export const positionsCache = new Map<string, { data: OnChainPosition[]; timestamp: number }>();
const POSITIONS_CACHE_TTL = 30 * 1000;

// ============= On-Chain Query Functions (Blockchain Fallback) =============

/**
 * Pools the account ever added liquidity to, from its `swap.alcor::addliquid`
 * history (union of Hyperion providers). Positions are stored per pool on
 * chain, so this is how the fallback knows which pools to look in.
 */
export async function fetchUserPoolIdsFromHistory(accountName: string): Promise<number[]> {
  const { actions } = await fetchActionsUnion(
    `account=${encodeURIComponent(accountName)}&filter=swap.alcor:addliquid`,
    { timeoutMs: 15000 },
  );
  const ids = new Set<number>();
  for (const a of actions) {
    const data = a.act?.data as { poolId?: unknown; owner?: unknown } | undefined;
    if (data?.owner !== accountName) continue;
    const id = Number(data.poolId);
    if (Number.isInteger(id) && id >= 0) ids.add(id);
  }
  return [...ids].sort((x, y) => x - y);
}

/**
 * Fetch user's LP positions directly from blockchain. `swap.alcor::positions`
 * is scoped per pool and indexed by owner (index 3), so each pool the account
 * used is read on its own.
 */
export async function fetchUserPositionsOnChain(accountName: string): Promise<AlcorApiPosition[]> {
  const cached = positionsCache.get(accountName);
  if (cached && Date.now() - cached.timestamp < POSITIONS_CACHE_TTL) {
    return enrichOnChainPositions(cached.data);
  }

  const poolIds = await fetchUserPoolIdsFromHistory(accountName);
  const perPool = await mapLimit(poolIds, 6, async (poolId) => {
    const rows: OnChainPosition[] = [];
    let lower = accountName;
    for (let page = 0; page < 20; page++) {
      const result = await fetchTableRows<Omit<OnChainPosition, 'pool'>>({
        code: ALCOR_SWAP_CONTRACT,
        scope: String(poolId),
        table: 'positions',
        index_position: 3,
        key_type: 'name',
        lower_bound: lower,
        upper_bound: accountName,
        limit: 100,
      });
      const got = result?.rows ?? [];
      for (const r of got) if (r.owner === accountName) rows.push({ ...r, pool: poolId });
      if (!result?.more || !result.next_key || got.length === 0) break;
      lower = String(result.next_key);
    }
    return rows;
  });
  const allPositions = perPool.flat().filter((p) => Number(p.liquidity) > 0);

  positionsCache.set(accountName, { data: allPositions, timestamp: Date.now() });
  return enrichOnChainPositions(allPositions);
}

/**
 * Enrich on-chain positions with their token amounts at the pool's current
 * price. Uncollected fees aren't computed here and stay at zero.
 */
export async function enrichOnChainPositions(positions: OnChainPosition[]): Promise<AlcorApiPosition[]> {
  if (positions.length === 0) return [];

  const uniquePoolIds = [...new Set(positions.map(p => p.pool))];
  await Promise.all(
    uniquePoolIds.map(async (poolId) => {
      try {
        await fetchPoolDetailsOnChain(poolId);
      } catch {
        console.warn(`[Alcor] Failed to fetch pool ${poolId} for position enrichment`);
      }
    })
  );

  return positions.map(pos => {
    const pool = poolCache.get(pos.pool)?.data;
    let amountA = '0 TOKEN';
    let amountB = '0 TOKEN';
    let inRange = true;

    if (pool) {
      const a = parseAsset(pool.tokenA.quantity);
      const b = parseAsset(pool.tokenB.quantity);
      const tick = pool.currSlot?.tick ?? 0;
      inRange = tick >= pos.tickLower && tick < pos.tickUpper;
      const raw = positionRawAmounts(Number(pos.liquidity), pos.tickLower, pos.tickUpper, pool.currSlot?.sqrtPriceX64);
      const qty = (r: number, prec: number) => (Math.floor(r + 1e-9) / 10 ** prec).toFixed(prec);
      amountA = `${qty(raw?.rawA ?? 0, a.precision)} ${a.symbol}`;
      amountB = `${qty(raw?.rawB ?? 0, b.precision)} ${b.symbol}`;
    }

    return {
      id: pos.id,
      owner: pos.owner,
      tickLower: pos.tickLower,
      tickUpper: pos.tickUpper,
      liquidity: String(pos.liquidity),
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
export async function fetchUserStakesOnChain(accountName: string): Promise<OnChainStake[]> {
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
export async function fetchPoolDetailsOnChain(poolId: number): Promise<any | null> {
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
export function transformOnChainPool(pool: OnChainPool): any {
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
    sqrtPriceX64: pool.currSlot?.sqrtPriceX64 || '0',
  };
}

/**
 * Build farm positions from on-chain data (blockchain fallback)
 */
export async function buildFarmPositionsFromOnChain(
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


// Cache all incentives to avoid repeated full table scans
let incentivesCache: { data: any[]; timestamp: number } | null = null;
const INCENTIVES_CACHE_TTL = 60 * 1000; // 1 minute

export async function fetchAllIncentives(): Promise<any[]> {
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
