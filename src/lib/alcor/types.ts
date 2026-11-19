// Alcor pool, position and farm shapes (API and on-chain).

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
export interface OnChainPosition {
  id: number;
  owner: string;
  pool: number;
  liquidity: string;
  tickLower: number;
  tickUpper: number;
}

// Stakes from swap.alcor::stakes table
export interface OnChainStake {
  id: number;
  owner: string;
  incentiveId: number;
  posId: number;
  rewardPerTokenPaid: string;
  rewards: string; // e.g., "7.08216192 CHEESE"
}

// Pool from swap.alcor::pools table
export interface OnChainPool {
  id: number;
  tokenA: { contract: string; quantity: string };
  tokenB: { contract: string; quantity: string };
  fee: number;
  currSlot: { sqrtPriceX64: string; tick: number };
}

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
