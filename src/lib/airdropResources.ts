/**
 * Pure CHEESE ⇄ resource math. No network, no browser APIs.
 * Every figure produced here is an estimate: on-chain prices move between the
 * quote and the transaction, so purchases apply a safety margin and the UI
 * labels the numbers as approximate.
 */

import { CHEESE_PRECISION } from "./airdropCheese";
import { parseUnits, sliceRamUnits } from './airdrop';

export interface RamPricing {
  /** ram.chz buying enabled flag. */
  enabled: boolean;
  /** Per-purchase CHEESE limits enforced by the contract. */
  minCheese: number;
  maxCheese: number;
  /** Current WAX cost of one byte from the eosio RAM market. */
  waxPerByte: number;
  /** Spread/slippage/buffer basis points the contract keeps on a buy. */
  feeBps: number;
  /** Lifetime bytes-per-CHEESE from contract stats, for sanity display. */
  historicalBytesPerCheese: number | null;
  /** Liquid WAX the ram.chz account currently holds. */
  liquidWax: number;
  /** WAX the contract must keep untouched (config min_liquid_reserve). */
  minLiquidReserve: number;
  /** Extra safety buffer the contract keeps on top of the reserve. */
  reserveBufferBps: number;
}


export interface PowerupPricing {
  /** WAX price to power up 100% of chain weight for the powerup window. */
  cpuPriceWaxPerFullWeight: number;
  netPriceWaxPerFullWeight: number;
  /** Chain-wide powerup weight units (1e-8 WAX equivalents). */
  cpuWeightUnits: number;
  netWeightUnits: number;
  /** Powerup duration in days. */
  powerupDays: number;
}

export interface ResourcePricing {
  /** WAX per 1 CHEESE. */
  waxPerCheese: number;
  priceSource: "pool" | "reference";
  ram: RamPricing;
  powerup: PowerupPricing | null;
}

/** Calibration from the connected account: how much CPU/NET one weight unit buys. */
export interface WeightCalibration {
  /** Microseconds of CPU per weight unit. */
  cpuUsPerWeightUnit: number | null;
  /** NET bytes per weight unit. */
  netBytesPerWeightUnit: number | null;
}

/** Buy a bit more than strictly needed — prices and CPU decay move. */
export const RAM_MARGIN = 1.1;
export const CPU_MARGIN = 1.25;

export function round(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

/** Round up to the CHEESE precision so a purchase never falls short. */
export function ceilCheese(value: number): number {
  const f = 10 ** CHEESE_PRECISION;
  return Math.ceil(value * f - 1e-9) / f;
}

export function formatCheese(value: number): string {
  return value.toFixed(CHEESE_PRECISION);
}

/** Derive the CPU/NET-per-weight-unit calibration from the account's own stake. */
export function weightCalibration(resources: {
  cpuMaxUs: number;
  netMaxBytes: number;
  cpuWeightUnits: number;
  netWeightUnits: number;
}): WeightCalibration {
  return {
    cpuUsPerWeightUnit:
      resources.cpuWeightUnits > 0 && resources.cpuMaxUs > 0
        ? resources.cpuMaxUs / resources.cpuWeightUnits
        : null,
    netBytesPerWeightUnit:
      resources.netWeightUnits > 0 && resources.netMaxBytes > 0
        ? resources.netMaxBytes / resources.netWeightUnits
        : null,
  };
}

// ---------------------------------------------------------------------------
// RAM
// ---------------------------------------------------------------------------

/** Bytes received per CHEESE, after contract spread/slippage. Null if unpriceable. */
export function bytesPerCheese(p: ResourcePricing): number | null {
  if (p.ram.waxPerByte <= 0 || p.waxPerCheese <= 0) return null;
  const gross = p.waxPerCheese / p.ram.waxPerByte;
  return gross * (1 - Math.min(0.5, Math.max(0, p.ram.feeBps / 10_000)));
}

/** CHEESE needed for a number of bytes, with margin, rounded up to precision. */
export function cheeseForBytes(bytes: number, p: ResourcePricing): number | null {
  const per = bytesPerCheese(p);
  if (!per || bytes <= 0) return null;
  return ceilCheese((bytes / per) * RAM_MARGIN);
}

/**
 * WAX the RAM contract can actually spend on purchases right now: its liquid
 * balance, less the reserve it must keep, less the configured safety buffer.
 */
export function spendableWax(p: ResourcePricing): number {
  const free = p.ram.liquidWax - p.ram.minLiquidReserve;
  if (!(free > 0)) return 0;
  const buffer = Math.min(0.5, Math.max(0, (p.ram.reserveBufferBps ?? 0) / 10_000));
  return free * (1 - buffer);
}

/** WAX the contract spends buying RAM for a given CHEESE amount. */
export function waxCostForCheese(cheese: number, p: ResourcePricing): number | null {
  if (!(cheese > 0) || !(p.waxPerCheese > 0)) return null;
  return cheese * p.waxPerCheese;
}

/** Largest CHEESE spend the contract's spendable WAX can cover. */
export function maxCheeseForPool(p: ResourcePricing): number | null {
  if (!(p.waxPerCheese > 0)) return null;
  const wax = spendableWax(p);
  if (!(wax > 0)) return 0;
  const f = 10 ** CHEESE_PRECISION;
  return Math.floor((wax / p.waxPerCheese) * f) / f;
}


// ---------------------------------------------------------------------------
// CPU / NET powerup
// ---------------------------------------------------------------------------

/** Microseconds of CPU expected from one CHEESE at the given CPU split. */
export function cpuUsPerCheese(
  p: ResourcePricing,
  calib: WeightCalibration,
  cpuPercent: number,
): number | null {
  const pu = p.powerup;
  if (!pu || calib.cpuUsPerWeightUnit === null) return null;
  if (pu.cpuPriceWaxPerFullWeight <= 0 || pu.cpuWeightUnits <= 0 || p.waxPerCheese <= 0) return null;
  const waxForCpu = p.waxPerCheese * (Math.max(0, Math.min(100, cpuPercent)) / 100);
  const fraction = waxForCpu / pu.cpuPriceWaxPerFullWeight;
  return fraction * pu.cpuWeightUnits * calib.cpuUsPerWeightUnit;
}

/** NET bytes expected from one CHEESE at the given CPU split (rest goes to NET). */
export function netBytesPerCheese(
  p: ResourcePricing,
  calib: WeightCalibration,
  cpuPercent: number,
): number | null {
  const pu = p.powerup;
  if (!pu || calib.netBytesPerWeightUnit === null) return null;
  if (pu.netPriceWaxPerFullWeight <= 0 || pu.netWeightUnits <= 0 || p.waxPerCheese <= 0) return null;
  const waxForNet = p.waxPerCheese * (1 - Math.max(0, Math.min(100, cpuPercent)) / 100);
  const fraction = waxForNet / pu.netPriceWaxPerFullWeight;
  return fraction * pu.netWeightUnits * calib.netBytesPerWeightUnit;
}

/** CHEESE needed to add a number of CPU microseconds, with margin. */
export function cheeseForCpuUs(
  us: number,
  p: ResourcePricing,
  calib: WeightCalibration,
  cpuPercent: number,
): number | null {
  const per = cpuUsPerCheese(p, calib, cpuPercent);
  if (!per || per <= 0 || us <= 0) return null;
  return ceilCheese((us / per) * CPU_MARGIN);
}

// ---------------------------------------------------------------------------
// Purchase splitting
// ---------------------------------------------------------------------------

/**
 * Split a CHEESE amount into purchases that respect the contract's per-transfer
 * min/max. Amounts below the minimum are raised to it (the contract rejects
 * anything smaller). Returns [] for non-positive input.
 */
export function splitPurchases(total: number, minCheese: number, maxCheese: number): number[] {
  if (![total, minCheese, maxCheese].every(Number.isFinite) || minCheese < 0 || maxCheese < 0 || (maxCheese > 0 && minCheese > maxCheese)) {
    throw new Error('Invalid RAM purchase amount or limits');
  }
  if (!(total > 0)) return [];
  const factor = 10 ** CHEESE_PRECISION;
  const requested = ceilCheese(Math.max(total, minCheese));
  if (!Number.isSafeInteger(Math.round(requested * factor))) throw new Error('RAM purchase amount exceeds safe precision');
  const units = parseUnits(formatCheese(requested), CHEESE_PRECISION);
  const minUnits = parseUnits(formatCheese(ceilCheese(minCheese)), CHEESE_PRECISION);
  const maxUnits = maxCheese > 0 ? BigInt(Math.floor(maxCheese * factor)) : 0n;
  if (maxCheese > 0 && maxUnits === 0n) throw new Error('RAM maximum is below token precision');
  if (maxUnits > 0n && (units + maxUnits - 1n) / maxUnits > 50n) throw new Error('RAM top-up requires more than 50 purchases; lower the amount');
  return sliceRamUnits(units, minUnits, maxUnits).map(u => Number(u) / factor);
}

/** Total of a purchase plan. */
export function planTotal(plan: number[]): number {
  return round(
    plan.reduce((s, x) => s + x, 0),
    CHEESE_PRECISION,
  );
}
