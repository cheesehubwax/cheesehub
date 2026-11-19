// WaxDAO V2 Farm Contract (farms.waxdao) — constants, types and pure helpers.

export const FARM_CONTRACT = "farms.waxdao";

// Fee constants for farm creation
export const FARM_CREATION_FEES = {
  WAX: "265.00000000 WAX",
  WAXDAO: "25000.00000000 WAXDAO",
  WOJAK_COLLECTION: "ourwojaksart",
};

// Farm types based on stakable asset configuration
export const FARM_TYPES = {
  COLLECTIONS: "collections",
  SCHEMAS: "schemas",
  TEMPLATES: "templates",
  ATTRIBUTES: "attributes",
} as const;

export type FarmType = typeof FARM_TYPES[keyof typeof FARM_TYPES];

export const FARM_TYPE_LABELS: Record<FarmType, string> = {
  collections: "Collections",
  schemas: "Schemas",
  templates: "Templates",
  attributes: "Attributes",
};

// Validate farm name (must be 1-12 chars, a-z, 1-5, and .)
export function validateFarmName(name: string): { valid: boolean; error?: string } {
  if (!name) {
    return { valid: false, error: "Farm name is required" };
  }
  if (name.length > 12) {
    return { valid: false, error: "Farm name must be 12 characters or less" };
  }
  if (!/^[a-z1-5.]+$/.test(name)) {
    return { valid: false, error: "Farm name can only contain a-z, 1-5, and ." };
  }
  return { valid: true };
}

export interface RewardToken {
  contract: string;
  symbol: string;
  precision: number;
}

export interface FarmProfile {
  avatar?: string;
  cover_image?: string;
  description?: string;
}

export interface FarmSocials {
  website?: string;
  telegram?: string;
  discord?: string;
  twitter?: string;
  atomichub?: string;
  waxdao?: string;
  youtube?: string;
  medium?: string;
}

export interface FarmInfo {
  farm_name: string;
  creator: string;
  logo: string;
  description: string;
  staked_count: number;
  reward_pools: RewardPool[];
  expiration: number;
  payout_interval: number;
  last_payout: number;
  farm_type: number;
  time_created: number;
  is_active: boolean;
  status: number;
  profile?: FarmProfile;
  socials?: FarmSocials;
  id: number;
}

export interface RewardPool {
  contract: string;
  symbol: string;
  balance: string;
  precision: number;
  total_funds?: string;
  total_hourly_reward?: string;
}

export interface EffectiveBalanceInfo {
  effectiveBalance: number;
  hourlyRate: number;
  hoursRemaining: number | null;
}

export function calculateEffectiveBalance(
  pool: RewardPool,
  lastPayout: number,
  nowSeconds: number
): EffectiveBalanceInfo {
  const rawBalance = parseFloat(pool.balance) || 0;
  const hourlyRateStr = pool.total_hourly_reward || "0";
  const hourlyRate = parseFloat(hourlyRateStr.split(" ")[0]) || 0;

  if (hourlyRate <= 0 || lastPayout <= 0) {
    return { effectiveBalance: rawBalance, hourlyRate: 0, hoursRemaining: null };
  }

  const hoursSinceLastPayout = Math.max(0, (nowSeconds - lastPayout) / 3600);
  const accrued = hourlyRate * hoursSinceLastPayout;
  const effectiveBalance = Math.max(0, rawBalance - accrued);
  const hoursRemaining = hourlyRate > 0 ? effectiveBalance / hourlyRate : null;

  return { effectiveBalance, hourlyRate, hoursRemaining };
}

export interface UserStake {
  asset_id: string;
  staker: string;
  farm_name: string;
  last_claim: number;
  claimable_balances?: Array<{ quantity: string; contract: string }>;
  rates_per_hour?: Array<{ quantity: string; contract: string }>;
  last_state_change?: number;
}

// Convert IPFS hash to full URL
export function getIpfsUrl(hash: string): string {
  if (!hash) return "";
  if (hash.startsWith("http")) return hash;
  if (hash.startsWith("Qm") || hash.startsWith("bafy")) {
    return `https://gateway.pinata.cloud/ipfs/${hash}`;
  }
  return hash;
}

// Farm type numeric values matching contract
export const FARM_TYPE_VALUES = {
  collections: 0,
  schemas: 1,
  templates: 2,
  attributes: 3,
} as const;

// Stakable template with hourly rate
export interface RewardRate {
  quantity: string;
  contract?: string;
}

export interface StakableTemplate {
  template_id: number;
  collection: string;
  hourly_rate: string;
  hourly_rates?: RewardRate[];
}

export interface StakableSchema {
  collection: string;
  schema: string;
  hourly_rate: string;
  hourly_rates?: RewardRate[];
}

export interface StakableCollection {
  collection: string;
  hourly_rate: string;
  hourly_rates?: RewardRate[];
}

export interface StakableAttribute {
  attribute_name: string;
  attribute_value: string;
  hourly_rate: string;
  hourly_rates?: RewardRate[];
}

// Fetch stakable config for a farm
export interface FarmStakableConfig {
  collections: StakableCollection[];
  schemas: StakableSchema[];
  templates: StakableTemplate[];
  attributes: StakableAttribute[];
}

// Fetch user's pending rewards for a farm
export interface PendingReward {
  symbol: string;
  amount: number;
  precision: number;
  contract?: string;
}

// Get collection names from stakable config
export function getCollectionNames(config: FarmStakableConfig): string[] {
  const collections = new Set<string>();

  config.collections.forEach(c => collections.add(c.collection));
  config.schemas.forEach(s => collections.add(s.collection));
  config.templates.forEach(t => collections.add(t.collection));

  return Array.from(collections);
}
