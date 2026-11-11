// Pure helpers + chain read for CHEESEFarm "Claim All".
import { fetchTableRows } from "./waxRpcFallback";
import { FARM_CONTRACT } from "./farm";

export interface ChainAsset { quantity: string; contract: string }

export interface StakerRow {
  farmName: string;
  claimable: ChainAsset[];
  rates: ChainAsset[];
  lastStateChange: number;
}

export interface FarmTiming { payoutInterval: number; expiration: number; isActive: boolean }

/** Exact token amount: integer units at a fixed precision. */
export interface TokenAmount { symbol: string; contract: string; precision: number; units: bigint }

export interface ReadyFarm { farmName: string; rewards: TokenAmount[] }

export function parseUnits(quantity: string): { symbol: string; precision: number; units: bigint } | null {
  const m = /^\s*(-?)(\d+)(?:\.(\d+))?\s+([A-Z0-9]{1,7})\s*$/.exec(quantity || "");
  if (!m) return null;
  const frac = m[3] || "";
  const units = BigInt(m[2] + frac) * (m[1] ? -1n : 1n);
  return { symbol: m[4], precision: frac.length, units };
}

export function formatUnits(t: Pick<TokenAmount, "units" | "precision">): string {
  const neg = t.units < 0n;
  const s = (neg ? -t.units : t.units).toString().padStart(t.precision + 1, "0");
  const whole = t.precision ? s.slice(0, -t.precision) : s;
  const frac = t.precision ? "." + s.slice(-t.precision) : "";
  return (neg ? "-" : "") + whole + frac;
}

/** Claimable now = stored balance + rate × completed payout periods (same rule as the single-farm view). */
export function readyRewards(row: StakerRow, timing: FarmTiming, nowSec: number): TokenAmount[] {
  const interval = timing.payoutInterval > 0 ? timing.payoutInterval : 3600;
  const expired = timing.expiration > 1 && nowSec > timing.expiration;
  const effectiveNow = expired ? timing.expiration : nowSec;
  const last = row.lastStateChange || effectiveNow;
  const periods = BigInt(Math.floor(Math.max(0, effectiveNow - last) / interval));
  const out: TokenAmount[] = [];
  for (const b of row.claimable) {
    const p = parseUnits(b.quantity);
    if (!p) continue;
    let units = p.units;
    const rate = row.rates.find(r => parseUnits(r.quantity)?.symbol === p.symbol && (r.contract || "") === (b.contract || ""));
    const rp = rate ? parseUnits(rate.quantity) : null;
    if (rp && rp.precision === p.precision && rp.units > 0n) {
      // rate is per hour; periods × interval seconds; floor to whole units
      units += (rp.units * periods * BigInt(interval)) / 3600n;
    }
    if (units > 0n) out.push({ symbol: p.symbol, contract: b.contract || "", precision: p.precision, units });
  }
  return out;
}

export function sumRewards(farms: ReadyFarm[]): TokenAmount[] {
  const map = new Map<string, TokenAmount>();
  for (const f of farms) for (const r of f.rewards) {
    const k = `${r.contract}:${r.symbol}:${r.precision}`;
    const prev = map.get(k);
    map.set(k, prev ? { ...prev, units: prev.units + r.units } : { ...r });
  }
  return [...map.values()];
}

export function planClaimBatches<T extends { rewards: TokenAmount[] }>(farms: T[], size = 5): T[][] {
  const ready = farms.filter(f => f.rewards.some(r => r.units > 0n));
  const out: T[][] = [];
  for (let i = 0; i < ready.length; i += size) out.push(ready.slice(i, i + size));
  return out;
}

/** All staker rows for an account (by-user index), read to completion. */
export async function fetchUserStakerRows(account: string): Promise<{ rows: StakerRow[]; partial: boolean }> {
  const rows: StakerRow[] = [];
  const seen = new Set<string>();
  let lower = account;
  for (let i = 0; i < 10; i++) {
    const res = await fetchTableRows<Record<string, unknown>>({
      // farms.waxdao stakers: secondary index 3 = user, 4 = farmname (index 2 returns nothing).
      code: FARM_CONTRACT, scope: FARM_CONTRACT, table: "stakers",
      index_position: 3, key_type: "name", lower_bound: lower, upper_bound: account, limit: 100,
    });
    for (const r of res.rows || []) {
      if ((r.user as string) && r.user !== account) continue;
      const farmName = String(r.farmname || r.farm_name || "");
      if (!farmName || seen.has(farmName)) continue;
      seen.add(farmName);
      rows.push({
        farmName,
        claimable: (r.claimable_balances as ChainAsset[]) || [],
        rates: (r.rates_per_hour as ChainAsset[]) || [],
        lastStateChange: Number(r.last_state_change || 0),
      });
    }
    if (!res.more || !res.next_key) return { rows, partial: false };
    lower = res.next_key;
  }
  return { rows, partial: true };
}

/** Split staked rows into farms with rewards ready now and farms with nothing to claim. Unknown farms count as empty. */
export function splitReadyFarms(rows: StakerRow[], timingByFarm: Map<string, FarmTiming>, nowSec: number): { ready: ReadyFarm[]; empty: string[] } {
  const ready: ReadyFarm[] = []; const empty: string[] = [];
  for (const row of rows) {
    const t = timingByFarm.get(row.farmName);
    const rewards = t ? readyRewards(row, t, nowSec) : [];
    if (rewards.length) ready.push({ farmName: row.farmName, rewards }); else empty.push(row.farmName);
  }
  return { ready, empty };
}
