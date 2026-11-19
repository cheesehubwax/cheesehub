import type { AlcorFarmPosition, UnstakedIncentive } from '@/lib/alcorFarms';

export interface GroupedFarmPosition {
  positionId: number;
  poolId: number;
  tokenA: { contract: string; symbol: string; amount: number };
  tokenB: { contract: string; symbol: string; amount: number };
  tickLower: number;
  tickUpper: number;
  isInRange: boolean;
  incentives: AlcorFarmPosition[];
  unstakedIncentives: UnstakedIncentive[];
  usdValue: number;
}
