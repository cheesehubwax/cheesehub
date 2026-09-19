// Pure planning helpers for the "Compound All" farm action.
// Given LP positions and the token balances available after a claim,
// work out how much of each pair can be re-added to each position.

import { getTokenConfig } from '@/lib/tokenRegistry';
import { PoolSlot, poolDepositRatio } from '@/lib/alcorV3Amounts';


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
  /**
   * Live pool price slot. Required to size the deposit at the exact ratio the
   * pool accepts; without it the position cannot be compounded safely.
   */
  slot?: PoolSlot | null;
}

export interface AvailableBalance {
  balance: number;
  precision: number;
  /**
   * False when the balance could not actually be read (missing token contract
   * or a failed chain request). Absent means the balance is trusted.
   */
  known?: boolean;
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
  | 'balance-unknown'
  | 'no-balance'
  | 'dust'
  | 'missing-ticks'
  | 'out-of-range'
  | 'pool-price-unknown'
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
 * Resolve the map key holding a token's balance, trying the exact
 * contract:symbol key first and falling back to a symbol-only
 * (case-insensitive) match so pool tokens sourced without a contract still
 * find their claimed balance.
 */
function findBalanceKey(
  map: ReadonlyMap<string, AvailableBalance>,
  contract: string | undefined,
  symbol: string,
): string | undefined {
  if (contract) {
    const exact = balanceKey(contract, symbol);
    if (map.has(exact)) return exact;
  }
  const sym = symbol.toUpperCase();
  for (const key of map.keys()) {
    const keySym = (key.includes(':') ? key.split(':')[1] : key).toUpperCase();
    if (keySym === sym) return key;
  }
  return undefined;
}

/** Resolve a balance entry for a token (see `findBalanceKey`). */
function findBalance(
  map: ReadonlyMap<string, AvailableBalance>,
  contract: string | undefined,
  symbol: string,
): AvailableBalance | undefined {
  const key = findBalanceKey(map, contract, symbol);
  return key ? map.get(key) : undefined;
}

/**
 * Tokens whose wallet balance must be read before a plan can be built.
 *
 * Reward token keys sometimes arrive without an issuing contract (the Alcor
 * incentive record was not resolved), which makes the balance request fail.
 * Merge them with the pool's own token records and the static token registry so
 * every symbol is read with a real contract whenever one is discoverable.
 */
export function buildBalanceReadList(
  candidates: readonly CompoundCandidate[],
): Array<{ contract?: string; symbol: string }> {
  const bySymbol = new Map<string, { contract?: string; symbol: string }>();

  const consider = (contract: string | undefined, symbol: string) => {
    const sym = symbol.trim();
    if (!sym) return;
    const key = sym.toUpperCase();
    const existing = bySymbol.get(key);
    const resolved = contract?.trim() || undefined;
    if (existing?.contract) return;
    bySymbol.set(key, { contract: resolved, symbol: existing?.symbol || sym });
  };

  candidates.forEach(c => {
    c.rewardTokenKeys.forEach(rawKey => {
      const idx = rawKey.indexOf(':');
      const contract = idx >= 0 ? rawKey.slice(0, idx) : '';
      const symbol = idx >= 0 ? rawKey.slice(idx + 1) : rawKey;
      consider(contract, symbol);
    });
    consider(c.tokenA.contract, c.tokenA.symbol);
    consider(c.tokenB.contract, c.tokenB.symbol);
  });

  // Last resort: the app's static registry knows the contract for most tokens.
  return Array.from(bySymbol.values()).map(entry => {
    if (entry.contract) return entry;
    const known = getTokenConfig(entry.symbol.toUpperCase());
    return known ? { contract: known.contract, symbol: entry.symbol } : entry;
  });
}

function floorTo(amount: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.floor(amount * factor) / factor;
}

function formatQuantity(amount: number, precision: number, symbol: string): string {
  return `${amount.toFixed(precision)} ${symbol}`;
}

/**
 * Amount of each token that the claim actually paid out: the balance after the
 * claim minus the balance before it. This is the ONLY pool of tokens compounding
 * is allowed to spend — whatever the wallet held beforehand is never touched.
 *
 * A token counts as unknown when either read failed, or when there is no
 * before-reading at all, so it can never be mistaken for "nothing arrived".
 */
export function buildClaimedBalances(
  before: ReadonlyMap<string, AvailableBalance>,
  after: ReadonlyMap<string, AvailableBalance>,
): Map<string, AvailableBalance> {
  const claimed = new Map<string, AvailableBalance>();
  after.forEach((value, key) => {
    const prev = before.get(key);
    const precision = Math.max(value.precision, prev?.precision ?? 0);
    const known = value.known !== false && prev !== undefined && prev.known !== false;
    const delta = floorTo(Math.max(0, value.balance - (prev?.balance ?? 0)), precision);
    claimed.set(key, { balance: known ? delta : 0, precision, known });
  });
  return claimed;
}

/**
 * Build the compound plan.
 *
 * Rules:
 * - A position only compounds when its farms pay out BOTH of its pool tokens.
 * - Only the amounts paid by this claim are used (see `buildClaimedBalances`);
 *   pre-existing wallet holdings are never spent.
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
  // Snapshot of the starting claimed amounts, so a side that ran out can be
  // told apart from a side that never received anything.
  const started = new Map<string, AvailableBalance>();
  available.forEach((value, key) => {
    const entry = {
      precision: value.precision,
      known: value.known,
      balance: floorTo(Math.max(0, value.balance), value.precision),
    };
    remaining.set(key, { ...entry });
    started.set(key, { ...entry });
  });

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
    const startA = findBalance(started, candidate.tokenA.contract, candidate.tokenA.symbol);
    const startB = findBalance(started, candidate.tokenB.contract, candidate.tokenB.symbol);

    // A balance that could not be read must never be reported as "nothing left".
    const unknownSide = !balA || balA.known === false
      ? candidate.tokenA.symbol
      : !balB || balB.known === false
        ? candidate.tokenB.symbol
        : null;

    if (unknownSide) {
      skipped.push({
        positionId: candidate.positionId,
        pair,
        reason: 'balance-unknown',
        detail: `Couldn't read your ${unknownSide} balance — use "Re-check balances" to try again.`,
      });
      continue;
    }

    if (balA.balance <= 0 || balB.balance <= 0) {
      const shortSymbol = balA.balance <= 0 ? candidate.tokenA.symbol : candidate.tokenB.symbol;
      const startBalance = (balA.balance <= 0 ? startA?.balance : startB?.balance) ?? 0;
      skipped.push({
        positionId: candidate.positionId,
        pair,
        reason: 'no-balance',
        detail: startBalance > 0
          ? `Claimed ${shortSymbol} was used by a larger position in this pair.`
          : `No ${shortSymbol} arrived from this claim.`,
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
