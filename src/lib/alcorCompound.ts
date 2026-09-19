// Pure planning helpers for the "Compound All" farm action.
// Given LP positions and the token balances available after a claim,
// work out how much of each pair can be re-added to each position.

export interface CompoundTokenRef {
  contract: string;
  symbol: string;
  /** Current amount of this token inside the position (defines the pairing ratio). */
  amount: number;
}

export interface CompoundCandidate {
  positionId: number;
  poolId: number;
  tickLower: number;
  tickUpper: number;
  tokenA: CompoundTokenRef;
  tokenB: CompoundTokenRef;
  /** USD value of the position, used to prioritise allocation. */
  usdValue: number;
  /** Reward token keys (`contract:symbol`) this position pays out. */
  rewardTokenKeys: string[];
}

export interface AvailableBalance {
  balance: number;
  precision: number;
}

export interface CompoundLeg {
  contract: string;
  symbol: string;
  amount: number;
  precision: number;
  /** Formatted chain quantity, e.g. "1.23450000 CHEESE". */
  quantity: string;
}

export interface CompoundPlanEntry {
  positionId: number;
  poolId: number;
  tickLower: number;
  tickUpper: number;
  tokenA: CompoundLeg;
  tokenB: CompoundLeg;
}

export type CompoundSkipReason =
  | 'rewards-one-sided'
  | 'no-balance'
  | 'dust'
  | 'missing-ticks'
  | 'position-cap';

export interface CompoundSkip {
  positionId: number;
  pair: string;
  reason: CompoundSkipReason;
  detail: string;
}

export interface CompoundPlan {
  compoundable: CompoundPlanEntry[];
  skipped: CompoundSkip[];
}

export const MAX_COMPOUND_POSITIONS = 20;

export function balanceKey(contract: string, symbol: string): string {
  return `${contract}:${symbol}`;
}

/**
 * Normalised key for matching tokens across data sources. Symbols are
 * upper-cased and the contract included only when present, so pool tokens
 * (Alcor API or chain fallback) and farm reward tokens still match when one
 * side is missing a contract or uses different casing.
 */
export function tokenMatchKey(contract: string | undefined, symbol: string): string {
  const sym = symbol.toUpperCase();
  return contract ? `${contract}:${sym}` : sym;
}

/** True when the reward set pays out the given token. */
export function paysToken(
  rewardTokenKeys: readonly string[],
  token: { contract?: string; symbol: string },
): boolean {
  const sym = token.symbol.toUpperCase();
  return rewardTokenKeys.some((k) => {
    const key = k.toUpperCase();
    if (token.contract && key === tokenMatchKey(token.contract, token.symbol)) return true;
    const keySym = key.includes(':') ? key.split(':')[1] : key;
    return keySym === sym;
  });
}

/** True when the reward set pays out both pool tokens. */
export function paysBothTokens(
  rewardTokenKeys: readonly string[],
  tokenA: { contract?: string; symbol: string },
  tokenB: { contract?: string; symbol: string },
): boolean {
  return paysToken(rewardTokenKeys, tokenA) && paysToken(rewardTokenKeys, tokenB);
}

/**
 * Resolve a balance entry for a token, trying the exact contract:symbol key
 * first and falling back to a symbol-only (case-insensitive) match so pool
 * tokens sourced without a contract still find their claimed balance.
 */
function findBalance(
  map: ReadonlyMap<string, AvailableBalance>,
  contract: string,
  symbol: string,
): AvailableBalance | undefined {
  const exact = map.get(balanceKey(contract, symbol));
  if (exact) return exact;
  const sym = symbol.toUpperCase();
  for (const [key, value] of map) {
    const keySym = (key.includes(':') ? key.split(':')[1] : key).toUpperCase();
    if (keySym === sym) return value;
  }
  return undefined;
}

function floorTo(amount: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.floor(amount * factor) / factor;
}

function formatQuantity(amount: number, precision: number, symbol: string): string {
  return `${amount.toFixed(precision)} ${symbol}`;
}

/**
 * Build the compound plan.
 *
 * Rules:
 * - A position only compounds when its farms pay out BOTH of its pool tokens.
 * - The smaller side is used in full, the larger side matched at the position ratio.
 * - Balances are shared: positions are served in descending USD value and each
 *   allocation is deducted, so the total never exceeds what was actually claimed.
 * - Amounts that round to zero at the token precision are skipped as dust.
 */
export function planCompound(
  candidates: CompoundCandidate[],
  available: ReadonlyMap<string, AvailableBalance>,
  maxPositions: number = MAX_COMPOUND_POSITIONS,
): CompoundPlan {
  const remaining = new Map<string, AvailableBalance>();
  available.forEach((value, key) => remaining.set(key, { ...value }));

  const compoundable: CompoundPlanEntry[] = [];
  const skipped: CompoundSkip[] = [];

  const ordered = [...candidates].sort((a, b) => b.usdValue - a.usdValue);

  for (const candidate of ordered) {
    const pair = `${candidate.tokenA.symbol}/${candidate.tokenB.symbol}`;
    const hasA = paysToken(candidate.rewardTokenKeys, candidate.tokenA);
    const hasB = paysToken(candidate.rewardTokenKeys, candidate.tokenB);

    if (!hasA || !hasB) {
      const missing = !hasA ? candidate.tokenA.symbol : candidate.tokenB.symbol;
      skipped.push({
        positionId: candidate.positionId,
        pair,
        reason: 'rewards-one-sided',
        detail: `Farm rewards do not include ${missing}, so this pair cannot be compounded.`,
      });
      continue;
    }

    if (candidate.tickLower === 0 && candidate.tickUpper === 0) {
      skipped.push({
        positionId: candidate.positionId,
        pair,
        reason: 'missing-ticks',
        detail: 'Position range data is unavailable — add liquidity on Alcor directly.',
      });
      continue;
    }

    if (compoundable.length >= maxPositions) {
      skipped.push({
        positionId: candidate.positionId,
        pair,
        reason: 'position-cap',
        detail: `Over the ${maxPositions} position limit for one click — compound again to include it.`,
      });
      continue;
    }

    const balA = findBalance(remaining, candidate.tokenA.contract, candidate.tokenA.symbol);
    const balB = findBalance(remaining, candidate.tokenB.contract, candidate.tokenB.symbol);

    if (!balA || !balB || balA.balance <= 0 || balB.balance <= 0) {
      skipped.push({
        positionId: candidate.positionId,
        pair,
        reason: 'no-balance',
        detail: 'No claimed balance left for both sides of this pair.',
      });
      continue;
    }

    if (candidate.tokenA.amount <= 0 || candidate.tokenB.amount <= 0) {
      skipped.push({
        positionId: candidate.positionId,
        pair,
        reason: 'no-balance',
        detail: 'Position holds only one token, so no pairing ratio is available.',
      });
      continue;
    }

    const ratio = candidate.tokenB.amount / candidate.tokenA.amount;
    const rawA = Math.min(balA.balance, balB.balance / ratio);
    const amountA = floorTo(rawA, balA.precision);
    const amountB = floorTo(Math.min(amountA * ratio, balB.balance), balB.precision);

    if (amountA <= 0 || amountB <= 0) {
      skipped.push({
        positionId: candidate.positionId,
        pair,
        reason: 'dust',
        detail: 'Claimed amount is too small to add as liquidity.',
      });
      continue;
    }

    balA.balance = floorTo(balA.balance - amountA, balA.precision);
    balB.balance = floorTo(balB.balance - amountB, balB.precision);

    compoundable.push({
      positionId: candidate.positionId,
      poolId: candidate.poolId,
      tickLower: candidate.tickLower,
      tickUpper: candidate.tickUpper,
      tokenA: {
        contract: candidate.tokenA.contract,
        symbol: candidate.tokenA.symbol,
        amount: amountA,
        precision: balA.precision,
        quantity: formatQuantity(amountA, balA.precision, candidate.tokenA.symbol),
      },
      tokenB: {
        contract: candidate.tokenB.contract,
        symbol: candidate.tokenB.symbol,
        amount: amountB,
        precision: balB.precision,
        quantity: formatQuantity(amountB, balB.precision, candidate.tokenB.symbol),
      },
    });
  }

  return { compoundable, skipped };
}
