// swap.alcor transaction builders (pure).
import { ALCOR_SWAP_CONTRACT } from './constants';

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

/** Default deposit slippage tolerance (0.5%) — matches Alcor's own default. */
export const DEFAULT_DEPOSIT_SLIPPAGE = 0.005;

/**
 * Build increase liquidity action (add to LP position)
 *
 * `slippageTolerance` sets how far below the desired amounts the pool may end up
 * using before it rejects the deposit with "Price slippage check". Automated
 * flows (Compound All) pass a wider tolerance because the pool price can move
 * between reading it and signing.
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
  tokenBQuantity: string,
  slippageTolerance: number = DEFAULT_DEPOSIT_SLIPPAGE
): TransactionAction[] {
  const tolerance = Number.isFinite(slippageTolerance)
    ? Math.min(Math.max(slippageTolerance, 0), 0.5)
    : DEFAULT_DEPOSIT_SLIPPAGE;

  // Work the minimum out in raw units of the token's own precision. The
  // allowance is the slippage share OR two raw units, whichever is larger: on
  // large deposits that is effectively the percentage, and on tiny deposits it
  // leaves room for the pool's integer rounding, which a percentage of a few
  // raw units cannot. Never rounds up above what the pool can actually use.
  const minQuantity = (quantity: string): string => {
    const [rawAmount, symbol] = quantity.split(' ');
    const decimals = rawAmount.split('.')[1]?.length || 0;
    const factor = 10 ** decimals;
    const desiredRaw = Math.round(parseFloat(rawAmount) * factor);
    const allowance = Math.max(Math.ceil(desiredRaw * tolerance), 2);
    const minRaw = Math.max(desiredRaw - allowance, 0);
    return `${(minRaw / factor).toFixed(decimals)} ${symbol}`;
  };



  const minTokenA = minQuantity(tokenAQuantity);
  const minTokenB = minQuantity(tokenBQuantity);

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
