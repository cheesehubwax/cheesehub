// WaxDAO V2 Farm Contract Interface
// Contract: farms.waxdao

import { fetchTableRows } from "./waxRpcFallback";

export const FARM_CONTRACT = "farms.waxdao";

// Fee constants for farm creation
export const FARM_CREATION_FEES = {
  WAX: "250.00000000 WAX",
  WAXDAO: "25000.00000000 WAXDAO",
  WOJAK_COLLECTION: "ourwojaksart", // Can use 1 Wojak NFT
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

// Payout interval options (in seconds)
export const PAYOUT_INTERVALS = [
  { label: "1 hour", value: 3600 },
  { label: "2 hours", value: 7200 },
  { label: "4 hours", value: 14400 },
  { label: "8 hours", value: 28800 },
  { label: "12 hours", value: 43200 },
  { label: "24 hours", value: 86400 },
  { label: "7 days", value: 604800 },
  { label: "30 days", value: 2592000 },
];

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

export interface StakableAsset {
  collection?: string;
  schema?: string;
  templateId?: string;
  attributeKey?: string;
  attributeValue?: string;
  rewardPerHour: number;
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

export interface FarmConfig {
  name: string;
  logo: string;
  description: string;
  farmType: FarmType;
  stakableAssets: StakableAsset[];
  rewardTokens: RewardToken[];
  payoutInterval: number;
  expirationDate: Date;
}

export interface RewardPool {
  contract: string;
  symbol: string;
  balance: string;
  precision: number;
  total_funds?: string;
  total_hourly_reward?: string;
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
    return `https://ipfs.io/ipfs/${hash}`;
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

// Build action for assertpoint (required before fee payment)
export function buildAssertPointAction(user: string) {
  return {
    account: FARM_CONTRACT,
    name: "assertpoint",
    authorization: [{ actor: user, permission: "active" }],
    data: {
      user,
    },
  };
}

// Build action for paying farm creation fee with WAX
export function buildFarmCreationFeeWaxAction(sender: string) {
  return {
    account: "eosio.token",
    name: "transfer",
    authorization: [{ actor: sender, permission: "active" }],
    data: {
      from: sender,
      to: FARM_CONTRACT,
      quantity: FARM_CREATION_FEES.WAX,
      memo: "|create_farm|",
    },
  };
}

// Build action for staking NFTs to a farm
export function buildStakeNftsAction(
  staker: string,
  farmName: string,
  assetIds: string[]
) {
  return {
    account: FARM_CONTRACT,
    name: "stakenfts",
    authorization: [{ actor: staker, permission: "active" }],
    data: {
      user: staker,
      farmname: farmName,
      assets_to_stake: assetIds,
    },
  };
}

// Build action for unstaking NFTs from a farm
export function buildUnstakeNftsAction(
  staker: string,
  farmName: string,
  assetIds: string[]
) {
  return {
    account: FARM_CONTRACT,
    name: "unstake",
    authorization: [{ actor: staker, permission: "active" }],
    data: {
      user: staker,
      farmname: farmName,
      asset_ids: assetIds,
    },
  };
}

// Build action for claiming rewards
export function buildClaimRewardsAction(staker: string, farmName: string) {
  return {
    account: FARM_CONTRACT,
    name: "claim",
    authorization: [{ actor: staker, permission: "active" }],
    data: {
      user: staker,
      farmname: farmName,
    },
  };
}

// Fetch all V2 farms from the contract
export async function fetchAllFarms(): Promise<FarmInfo[]> {
  try {
    const data = await fetchTableRows({
      code: FARM_CONTRACT,
      scope: FARM_CONTRACT,
      table: "farms",
      limit: 500,
    });

    const seenFarmNames = new Set<string>();
    const uniqueRows: Record<string, unknown>[] = [];

    for (const row of (data.rows || [])) {
      const farmRow = row as Record<string, unknown>;
      const farmName = (farmRow.farmname || farmRow.farm_name || "") as string;

      if (farmName && !seenFarmNames.has(farmName)) {
        seenFarmNames.add(farmName);
        uniqueRows.push(farmRow);
      }
    }

    console.log(`Fetched ${uniqueRows.length} unique farms (raw: ${data.rows?.length || 0})`);

    const now = Math.floor(Date.now() / 1000);

    return uniqueRows.map((row: Record<string, unknown>, index: number) => {
      const farmName = (row.farmname || row.farm_name || `farm_${index}`) as string;
      const expiration = (row.expiration || 0) as number;
      const stakedCount = (row.total_staked || 0) as number;
      const createdTime = (row.time_created || 0) as number;
      const hoursInterval = (row.hours_between_payouts || 1) as number;
      const payoutInterval = hoursInterval * 3600;
      const profile = row.profile as FarmProfile | undefined;
      const socials = row.socials as FarmSocials | undefined;
      const farmId = (row.id || index) as number;
      const status = (row.status || 0) as number;
      const farmType = (row.farm_type || 0) as number;

      const rawPools = row.reward_pools as Array<{
        total_funds?: string;
        contract?: string;
        total_hourly_reward?: string;
      }> || [];

      const rewardPools: RewardPool[] = rawPools.map(pool => {
        const fundsStr = pool.total_funds || "0";
        const parts = fundsStr.split(" ");
        const balance = parts[0] || "0";
        const symbol = parts[1] || "";
        const precision = balance.includes(".") ? balance.split(".")[1]?.length || 0 : 0;

        return {
          contract: pool.contract || "",
          symbol,
          balance,
          precision,
          total_funds: pool.total_funds,
          total_hourly_reward: pool.total_hourly_reward,
        };
      });

      return {
        farm_name: farmName,
        creator: (row.creator || "") as string,
        logo: profile?.avatar || "",
        description: profile?.description || "",
        staked_count: stakedCount,
        reward_pools: rewardPools,
        expiration,
        payout_interval: payoutInterval,
        last_payout: (row.last_state_change || 0) as number,
        farm_type: farmType,
        time_created: createdTime,
        is_active: status === 1 && expiration > now,
        status,
        profile,
        socials,
        id: farmId,
      };
    });
  } catch (error) {
    console.error("Error fetching farms:", error);
    return [];
  }
}

// Fetch farms created by a specific user
export async function fetchUserFarms(account: string): Promise<FarmInfo[]> {
  try {
    const allFarms = await fetchAllFarms();
    const userFarms = allFarms.filter(farm => farm.creator === account);
    console.log(`Found ${userFarms.length} farms for user ${account}`);
    return userFarms;
  } catch (error) {
    console.error("Error fetching user farms:", error);
    return [];
  }
}

// Fetch details for a specific farm
export async function fetchFarmDetails(farmName: string): Promise<FarmInfo | null> {
  try {
    const data = await fetchTableRows({
      code: FARM_CONTRACT,
      scope: FARM_CONTRACT,
      table: "farms",
      lower_bound: farmName,
      upper_bound: farmName,
      limit: 1,
    });

    if (data.rows && data.rows.length > 0) {
      const row = data.rows[0];
      const now = Math.floor(Date.now() / 1000);

      const expiration = (row.expiration || 0) as number;
      const stakedCount = (row.total_staked || 0) as number;
      const createdTime = (row.time_created || 0) as number;
      const hoursInterval = (row.hours_between_payouts || 1) as number;
      const payoutInterval = hoursInterval * 3600;
      const profile = row.profile as FarmProfile | undefined;
      const socials = row.socials as FarmSocials | undefined;
      const farmId = (row.id || 0) as number;
      const status = (row.status || 0) as number;
      const farmType = (row.farm_type || 0) as number;

      const rawPools = row.reward_pools as Array<{
        total_funds?: string;
        contract?: string;
        total_hourly_reward?: string;
      }> || [];

      const rewardPools: RewardPool[] = rawPools.map(pool => {
        const fundsStr = pool.total_funds || "0";
        const parts = fundsStr.split(" ");
        const balance = parts[0] || "0";
        const symbol = parts[1] || "";
        const precision = balance.includes(".") ? balance.split(".")[1]?.length || 0 : 0;

        return {
          contract: pool.contract || "",
          symbol,
          balance,
          precision,
          total_funds: pool.total_funds,
          total_hourly_reward: pool.total_hourly_reward,
        };
      });

      return {
        farm_name: farmName,
        creator: (row.creator || "") as string,
        logo: profile?.avatar || "",
        description: profile?.description || "",
        staked_count: stakedCount,
        reward_pools: rewardPools,
        expiration,
        payout_interval: payoutInterval,
        last_payout: (row.last_state_change || 0) as number,
        farm_type: farmType,
        time_created: createdTime,
        is_active: status === 1 && expiration > now,
        status,
        profile,
        socials,
        id: farmId,
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching farm details:", error);
    return null;
  }
}
