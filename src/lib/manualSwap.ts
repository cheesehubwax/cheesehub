import { z } from "zod";

export interface ManualAllocation {
  key: string;
  bps: number;
}

const allocationSchema = z.object({
  key: z.string().trim().min(1).max(160),
  bps: z.number().int().min(0).max(10_000),
});

export const manualAllocationsSchema = z
  .array(allocationSchema)
  .max(6)
  .refine((items) => new Set(items.map((item) => item.key)).size === items.length, "Duplicate routes")
  .refine((items) => items.filter((item) => item.bps > 0).length > 0, "Select at least one route")
  .refine((items) => items.reduce((sum, item) => sum + item.bps, 0) === 10_000, "Allocations must total 100%");

export function parseManualAllocations(value: unknown): ManualAllocation[] {
  return manualAllocationsSchema.parse(value).filter((item) => item.bps > 0);
}

export function allocationKey(items: ManualAllocation[] | undefined): string {
  if (!items) return "auto";
  return items.map((item) => `${item.key}:${item.bps}`).sort().join("|");
}

/** Move one slider and proportionally fit every other selected route to the remainder. */
export function redistributeAllocations(
  items: ManualAllocation[],
  changedKey: string,
  nextBps: number,
): ManualAllocation[] {
  if (items.length === 0) return [];
  const safe = Number.isFinite(nextBps) ? Math.max(0, Math.min(10_000, Math.round(nextBps))) : 0;
  const others = items.filter((item) => item.key !== changedKey);
  if (others.length === 0) return [{ key: changedKey, bps: 10_000 }];
  const remaining = 10_000 - safe;
  const oldOtherTotal = others.reduce((sum, item) => sum + item.bps, 0);
  let assigned = 0;
  const resized = others.map((item, index) => {
    const bps = index === others.length - 1
      ? remaining - assigned
      : oldOtherTotal > 0
        ? Math.floor((item.bps * remaining) / oldOtherTotal)
        : Math.floor(remaining / others.length);
    assigned += bps;
    return { ...item, bps };
  });
  return items.map((item) =>
    item.key === changedKey ? { ...item, bps: safe } : resized.find((other) => other.key === item.key) ?? item,
  );
}

export function splitRawByBps(total: bigint, items: ManualAllocation[]): Map<string, bigint> {
  const parsed = parseManualAllocations(items);
  const parts = new Map(parsed.map((item) => [item.key, (total * BigInt(item.bps)) / 10_000n]));
  const used = [...parts.values()].reduce((sum, amount) => sum + amount, 0n);
  const largest = parsed.reduce((best, item) => (item.bps > best.bps ? item : best), parsed[0]);
  parts.set(largest.key, (parts.get(largest.key) ?? 0n) + total - used);
  return parts;
}