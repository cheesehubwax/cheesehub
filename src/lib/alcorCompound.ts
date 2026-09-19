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
  /** Amount actually deposited (gross minus the compound fee). */
  amount: number;
  precision: number;
  /** Formatted chain quantity, e.g. "1.23450000 CHEESE". */
  quantity: string;
  /** Amount allocated to this leg before the compound fee. */
  gross: number;
  /** Compound fee taken from the gross amount (may be 0 when it rounds away). */
  fee: number;
  /** Formatted fee quantity, e.g. "0.50610000 CHEESE". */
  feeQuantity: string;
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

/** Share of every compounded deposit sent to the fee account. */
export const COMPOUND_FEE_RATE = 0.0075;
/** Share of each claimed balance deliberately left in the user's wallet. */
export const COMPOUND_BUFFER_RATE = 0.005;
export const COMPOUND_FEE_ACCOUNT = 'hole.cheese';
export const COMPOUND_FEE_MEMO = 'compound fee';

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
  // Hold back a small buffer of every claimed token so rounding or a late
  // reward can never make the deposit exceed the wallet balance.
  const remaining = new Map<string, AvailableBalance>();
  available.forEach((value, key) =>
    remaining.set(key, {
      precision: value.precision,
      balance: floorTo(Math.max(0, value.balance) * (1 - COMPOUND_BUFFER_RATE), value.precision),
    }),
  );

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
    const grossA = floorTo(rawA, balA.precision);
    const grossB = floorTo(Math.min(grossA * ratio, balB.balance), balB.precision);

    const feeA = floorTo(grossA * COMPOUND_FEE_RATE, balA.precision);
    const feeB = floorTo(grossB * COMPOUND_FEE_RATE, balB.precision);
    const depositA = floorTo(grossA - feeA, balA.precision);
    const depositB = floorTo(grossB - feeB, balB.precision);

    if (depositA <= 0 || depositB <= 0) {
      skipped.push({
        positionId: candidate.positionId,
        pair,
        reason: 'dust',
        detail: 'Claimed amount is too small to add as liquidity.',
      });
      continue;
    }

    balA.balance = floorTo(balA.balance - grossA, balA.precision);
    balB.balance = floorTo(balB.balance - grossB, balB.precision);

    compoundable.push({
      positionId: candidate.positionId,
      poolId: candidate.poolId,
      tickLower: candidate.tickLower,
      tickUpper: candidate.tickUpper,
      tokenA: {
        contract: candidate.tokenA.contract,
        symbol: candidate.tokenA.symbol,
        amount: depositA,
        precision: balA.precision,
        quantity: formatQuantity(depositA, balA.precision, candidate.tokenA.symbol),
        gross: grossA,
        fee: feeA,
        feeQuantity: formatQuantity(feeA, balA.precision, candidate.tokenA.symbol),
      },
      tokenB: {
        contract: candidate.tokenB.contract,
        symbol: candidate.tokenB.symbol,
        amount: depositB,
        precision: balB.precision,
        quantity: formatQuantity(depositB, balB.precision, candidate.tokenB.symbol),
        gross: grossB,
        fee: feeB,
        feeQuantity: formatQuantity(feeB, balB.precision, candidate.tokenB.symbol),
      },
    });
  }

  return { compoundable, skipped };
}

export interface CompoundFeeTotal {
  contract: string;
  symbol: string;
  amount: number;
  precision: number;
  quantity: string;
}

/**
 * Aggregate the per-leg compound fees into one transfer per token, so the
 * compound transaction carries a single fee action per token rather than one
 * per position. Fees that round to zero are omitted.
 */
export function buildCompoundFeeTotals(entries: readonly CompoundPlanEntry[]): CompoundFeeTotal[] {
  const totals = new Map<string, CompoundFeeTotal>();

  const add = (leg: CompoundLeg) => {
    if (leg.fee <= 0) return;
    const key = balanceKey(leg.contract, leg.symbol);
    const existing = totals.get(key);
    if (existing) {
      existing.precision = Math.max(existing.precision, leg.precision);
      existing.amount = floorTo(existing.amount + leg.fee, existing.precision);
      existing.quantity = formatQuantity(existing.amount, existing.precision, existing.symbol);
      return;
    }
    totals.set(key, {
      contract: leg.contract,
      symbol: leg.symbol,
      amount: leg.fee,
      precision: leg.precision,
      quantity: formatQuantity(leg.fee, leg.precision, leg.symbol),
    });
  };

  entries.forEach(entry => {
    add(entry.tokenA);
    add(entry.tokenB);
  });

  return Array.from(totals.values()).filter(t => t.amount > 0);
}
