import { fetchTable } from './wax';

// ── Contract names ──
const CHEESEBURNER = 'cheeseburner';
const CHEESEFEEFEE = 'cheesefeefee';
const CHEESEBANNAD = 'cheesebannad';
const CHEESEPOWERZ = 'cheesepowerz';

// ── Types ──

export interface BurnerConfig {
  admin: string;
  alcor_pool_id: number;
  enabled: number;
  min_wax_to_burn: string;
}

export interface BurnerStats {
  total_burns: number;
  total_wax_claimed: string;
  total_wax_staked: string;
  total_cheese_burned: string;
  total_cheese_rewards: string;
  total_cheese_liquidity: string;
}

export interface FeeFeeConfig {
  id: number;
  wax_per_cheese_baseline: number;
  waxdao_per_wax_baseline: number;
}

export interface BannadConfig {
  id: number;
  wax_price_per_day: string;
  wax_per_cheese_baseline: number;
}

export interface BannadAdmin {
  account: string;
}

export interface PowerzStats {
  total_powerups: number;
  total_wax_spent: string;
  total_cheese_received: string;
}

export interface PoolReserves {
  tokenA: { quantity: string; contract: string };
  tokenB: { quantity: string; contract: string };
}

export interface AlcorPoolRow {
  id: number;
  active: boolean;
  tokenA: { quantity: string; contract: string };
  tokenB: { quantity: string; contract: string };
}

// ── Fetchers ──

export async function fetchBurnerConfig(): Promise<BurnerConfig | null> {
  const rows = await fetchTable<BurnerConfig>(CHEESEBURNER, CHEESEBURNER, 'config', { limit: 1 });
  return rows[0] ?? null;
}

export async function fetchBurnerStats(): Promise<BurnerStats | null> {
  const rows = await fetchTable<BurnerStats>(CHEESEBURNER, CHEESEBURNER, 'stats', { limit: 1 });
  return rows[0] ?? null;
}

export async function fetchFeeFeeConfig(): Promise<FeeFeeConfig | null> {
  const rows = await fetchTable<FeeFeeConfig>(CHEESEFEEFEE, CHEESEFEEFEE, 'config', { limit: 1 });
  return rows[0] ?? null;
}

export async function fetchBannadConfig(): Promise<BannadConfig | null> {
  const rows = await fetchTable<BannadConfig>(CHEESEBANNAD, CHEESEBANNAD, 'config', { limit: 1 });
  return rows[0] ?? null;
}

export async function fetchBannadAdmins(): Promise<BannadAdmin[]> {
  return fetchTable<BannadAdmin>(CHEESEBANNAD, CHEESEBANNAD, 'admins', { limit: 100 });
}

export async function fetchPowerzStats(): Promise<PowerzStats | null> {
  const rows = await fetchTable<PowerzStats>(CHEESEPOWERZ, CHEESEPOWERZ, 'stats', { limit: 1 });
  return rows[0] ?? null;
}

export async function fetchIsAdmin(account: string): Promise<boolean> {
  if (account === CHEESEBANNAD) return true;
  const rows = await fetchTable<BannadAdmin>(
    CHEESEBANNAD, CHEESEBANNAD, 'admins',
    { lower_bound: account, upper_bound: account, limit: 1 }
  );
  return rows.length > 0 && rows[0].account === account;
}

// Fetch Alcor pool reserves via on-chain table
export async function fetchPoolReserves(poolId: number): Promise<AlcorPoolRow | null> {
  const rows = await fetchTable<AlcorPoolRow>(
    'swap.alcor', 'swap.alcor', 'pools',
    { lower_bound: String(poolId), upper_bound: String(poolId), limit: 1 }
  );
  return rows[0] ?? null;
}

// Parse asset string like "123.45678900 WAX" → number
export function parseAssetAmount(asset: string): number {
  if (!asset) return 0;
  const parts = asset.split(' ');
  return parseFloat(parts[0]) || 0;
}

// Calculate price from pool reserves
export function calcPriceFromReserves(pool: AlcorPoolRow): { priceAinB: number; priceBinA: number } {
  const amountA = parseAssetAmount(pool.tokenA.quantity);
  const amountB = parseAssetAmount(pool.tokenB.quantity);
  if (amountA === 0 || amountB === 0) return { priceAinB: 0, priceBinA: 0 };
  return {
    priceAinB: amountB / amountA,
    priceBinA: amountA / amountB,
  };
}

// Calculate deviation percentage
export function calcDeviation(actual: number, baseline: number): number {
  if (baseline === 0) return 0;
  return ((actual - baseline) / baseline) * 100;
}

// Get severity level based on deviation
export type Severity = 'green' | 'yellow' | 'red';
export function getDeviationSeverity(deviationPct: number): Severity {
  const abs = Math.abs(deviationPct);
  if (abs >= 8) return 'red';
  if (abs >= 5) return 'yellow';
  return 'green';
}
