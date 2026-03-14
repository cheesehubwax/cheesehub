// WaxDAO V2 Farm Contract Interface
// Contract: farms.waxdao

import { fetchTableRows, waxRpcCall } from "./waxRpcFallback";

export const FARM_CONTRACT = "farms.waxdao";

// Global staking info for cross-farm detection
export interface GlobalStakeInfo {
  farmName: string;
  assetIds: string[];
}

// Fetches all asset IDs the user has staked across ALL V2 farms
export async function fetchUserGlobalStakes(account: string): Promise<GlobalStakeInfo[]> {
  const results: GlobalStakeInfo[] = [];

  try {
    // Strategy 1: Try secondary index first (fastest if it works)
    try {
      const response = await fetchTableRows({
        code: FARM_CONTRACT,
        scope: FARM_CONTRACT,
        table: 'stakers',
        index_position: 2,
        key_type: 'name',
        lower_bound: account,
        upper_bound: account,
        limit: 100,
      });

      if (response.rows && response.rows.length > 0) {
        for (const row of response.rows) {
          const farmRow = row as Record<string, unknown>;
          const farmName = (farmRow.farmname || farmRow.farm_name || '') as string;
          const assetIds = (farmRow.asset_ids || []) as (string | number)[];

          if (farmName && assetIds.length > 0) {
            results.push({
              farmName,
              assetIds: assetIds.map(id => String(id)),
            });
          }
        }

        if (results.length > 0) {
          return results;
        }
      }
    } catch (e) {
      console.log('[fetchUserGlobalStakes] Secondary index failed:', e);
    }

    // Strategy 2: Scan stakers table with reverse pagination
    let hasMore = true;
    let upperBound = '';
    let iterations = 0;
    const MAX_ITERATIONS = 20;
    const seenFarms = new Set<string>();

    while (hasMore && iterations < MAX_ITERATIONS) {
      try {
        const response = await fetchTableRows({
          code: FARM_CONTRACT,
          scope: FARM_CONTRACT,
          table: 'stakers',
          limit: 100,
          reverse: true,
          ...(upperBound ? { upper_bound: upperBound } : {}),
        });

        if (!response.rows || response.rows.length === 0) {
          hasMore = false;
          break;
        }

        for (const row of response.rows) {
          const farmRow = row as Record<string, unknown>;
          const user = (farmRow.user || '') as string;
          const farmName = (farmRow.farmname || farmRow.farm_name || '') as string;
          const assetIds = (farmRow.asset_ids || []) as (string | number)[];

          if (user === account && farmName && assetIds.length > 0 && !seenFarms.has(farmName)) {
            seenFarms.add(farmName);
            results.push({
              farmName,
              assetIds: assetIds.map(id => String(id)),
            });
          }
        }

        const lastRow = response.rows[response.rows.length - 1] as Record<string, unknown>;
        const lastId = lastRow.id as number | undefined;

        if (lastId !== undefined && response.more) {
          upperBound = String(lastId - 1);
        } else {
          hasMore = false;
        }

        iterations++;
      } catch (e) {
        console.log('[fetchUserGlobalStakes] Reverse scan iteration failed:', e);
        hasMore = false;
      }
    }

    return results;

  } catch (error) {
    console.error('[fetchUserGlobalStakes] Error:', error);
    return [];
  }
}

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
    data: { user },
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

// Build action for paying farm creation fee with WAXDAO
export function buildFarmCreationFeeWaxdaoAction(sender: string) {
  return {
    account: "mdcryptonfts",
    name: "transfer",
    authorization: [{ actor: sender, permission: "active" }],
    data: {
      from: sender,
      to: FARM_CONTRACT,
      quantity: FARM_CREATION_FEES.WAXDAO,
      memo: "|create_farm|",
    },
  };
}

// Build action for paying farm creation fee with Wojak NFT
export function buildFarmCreationFeeWojakAction(sender: string, assetId: string) {
  return {
    account: "atomicassets",
    name: "transfer",
    authorization: [{ actor: sender, permission: "active" }],
    data: {
      from: sender,
      to: FARM_CONTRACT,
      asset_ids: [assetId],
      memo: "|create_farm|",
    },
  };
}

// Build action for creating farm
export function buildCreateFarmAction(
  user: string,
  farmName: string,
  farmType: FarmType,
  hoursBetweenPayouts: number,
  rewardTokens: RewardToken[],
  profile: {
    avatar: string;
    cover_image: string;
    description: string;
  },
  socials: {
    website: string;
    telegram: string;
    discord: string;
    twitter: string;
    medium: string;
    youtube: string;
    atomichub: string;
    waxdao: string;
  }
) {
  return {
    account: FARM_CONTRACT,
    name: "createfarm",
    authorization: [{ actor: user, permission: "active" }],
    data: {
      user,
      farmname: farmName,
      farm_type: FARM_TYPE_VALUES[farmType],
      hours_between_payouts: hoursBetweenPayouts,
      reward_tokens: rewardTokens.map(t => ({
        contract: t.contract,
        token_symbol: `${t.precision},${t.symbol}`,
      })),
      profile,
      socials,
    },
  };
}

// RewardValue type for V2 farm stakable assets
export interface RewardValue {
  quantity: string;
  contract: string;
}

// Build action for setting template values (V2)
export function buildSetTemplateValuesAction(
  user: string,
  farmname: string,
  collectionName: string,
  templateId: number,
  rewardValues: RewardValue[]
) {
  return {
    account: FARM_CONTRACT,
    name: "settmpvalues",
    authorization: [{ actor: user, permission: "active" }],
    data: {
      user,
      farmname,
      values: [{
        template_id: templateId,
        collection_name: collectionName,
        hourly_rewards: rewardValues.map(rv => ({
          quantity: rv.quantity,
          contract: rv.contract,
        })),
      }],
    },
  };
}

// Build action for setting schema values (V2)
export function buildSetSchemaValuesAction(
  user: string,
  farmname: string,
  collectionName: string,
  schemaName: string,
  rewardValues: RewardValue[]
) {
  return {
    account: FARM_CONTRACT,
    name: "setschvalues",
    authorization: [{ actor: user, permission: "active" }],
    data: {
      user,
      farmname,
      values: [{
        collection_name: collectionName,
        schema_name: schemaName,
        hourly_rewards: rewardValues.map(rv => ({
          quantity: rv.quantity,
          contract: rv.contract,
        })),
      }],
    },
  };
}

// Build action for setting collection values (V2)
export function buildSetCollectionValuesAction(
  user: string,
  farmname: string,
  collectionName: string,
  rewardValues: RewardValue[]
) {
  return {
    account: FARM_CONTRACT,
    name: "setcolvalues",
    authorization: [{ actor: user, permission: "active" }],
    data: {
      user,
      farmname,
      values: [{
        collection_name: collectionName,
        hourly_rewards: rewardValues.map(rv => ({
          quantity: rv.quantity,
          contract: rv.contract,
        })),
      }],
    },
  };
}

// Build action for setting attribute values (V2)
export function buildSetAttributeValuesAction(
  user: string,
  farmname: string,
  attributeName: string,
  attributeValue: string,
  rewardValues: RewardValue[]
) {
  return {
    account: FARM_CONTRACT,
    name: "setattvalues",
    authorization: [{ actor: user, permission: "active" }],
    data: {
      user,
      farmname,
      values: [{
        attribute_name: attributeName,
        attribute_value: attributeValue,
        hourly_rewards: rewardValues.map(rv => ({
          quantity: rv.quantity,
          contract: rv.contract,
        })),
      }],
    },
  };
}

// Build action for erasing template values
export function buildEraseTemplateValuesAction(user: string, farmname: string, templateId: number) {
  return {
    account: FARM_CONTRACT,
    name: "erasetmpvalue",
    authorization: [{ actor: user, permission: "active" }],
    data: { user, farmname, template_id: templateId },
  };
}

// Build action for erasing schema values
export function buildEraseSchemaValuesAction(user: string, farmname: string, collectionName: string, schemaName: string) {
  return {
    account: FARM_CONTRACT,
    name: "eraseschvalue",
    authorization: [{ actor: user, permission: "active" }],
    data: { user, farmname, collection_name: collectionName, schema_name: schemaName },
  };
}

// Build action for erasing collection values
export function buildEraseCollectionValuesAction(user: string, farmname: string, collectionName: string) {
  return {
    account: FARM_CONTRACT,
    name: "erasecolvalue",
    authorization: [{ actor: user, permission: "active" }],
    data: { user, farmname, collection_name: collectionName },
  };
}

// Build action for erasing attribute values
export function buildEraseAttributeValuesAction(user: string, farmname: string, attributeName: string, attributeValue: string) {
  return {
    account: FARM_CONTRACT,
    name: "eraseattvalue",
    authorization: [{ actor: user, permission: "active" }],
    data: { user, farmname, attribute_name: attributeName, attribute_value: attributeValue },
  };
}

// Build action for closing an expired farm
export function buildCloseFarmAction(user: string, farmName: string) {
  return {
    account: FARM_CONTRACT,
    name: "closefarm",
    authorization: [{ actor: user, permission: "active" }],
    data: { user, farmname: farmName },
  };
}

// Build action for permanently closing a farm
export function buildPermCloseFarmAction(user: string, farmName: string) {
  return {
    account: FARM_CONTRACT,
    name: "permclosefrm",
    authorization: [{ actor: user, permission: "active" }],
    data: { user, farmname: farmName },
  };
}

// Build action for kicking multiple stakers from a farm
export function buildKickManyAction(user: string, farmName: string, amount: number) {
  return {
    account: FARM_CONTRACT,
    name: "kickmany",
    authorization: [{ actor: user, permission: "active" }],
    data: { user, farmname: farmName, quantity_of_users: amount },
  };
}

// Build action for emptying reward tokens from a permanently closed farm
export function buildEmptyFarmAction(user: string, farmName: string) {
  return {
    account: FARM_CONTRACT,
    name: "emptyfarm",
    authorization: [{ actor: user, permission: "active" }],
    data: { user, farmname: farmName },
  };
}

// Build action for depositing reward tokens
export function buildAddRewardsAction(sender: string, farmName: string, tokenContract: string, quantity: string) {
  return {
    account: tokenContract,
    name: "transfer",
    authorization: [{ actor: sender, permission: "active" }],
    data: {
      from: sender,
      to: FARM_CONTRACT,
      quantity,
      memo: `|deposit|${farmName}|`,
    },
  };
}

// Build action for opening a farm (sets expiration and activates it)
export function buildOpenFarmAction(creator: string, farmName: string, expiration: number) {
  return {
    account: FARM_CONTRACT,
    name: "openfarm",
    authorization: [{ actor: creator, permission: "active" }],
    data: { user: creator, farmname: farmName, expiration },
  };
}

// Build action for extending farm expiration
export function buildExtendFarmAction(user: string, farmName: string, newExpiration: number) {
  return {
    account: FARM_CONTRACT,
    name: "extendfarm",
    authorization: [{ actor: user, permission: "active" }],
    data: { user, farmname: farmName, expiration: newExpiration },
  };
}

// Build action for staking NFTs to a farm
export function buildStakeNftsAction(staker: string, farmName: string, assetIds: string[]) {
  return {
    account: FARM_CONTRACT,
    name: "stakenfts",
    authorization: [{ actor: staker, permission: "active" }],
    data: { user: staker, farmname: farmName, assets_to_stake: assetIds },
  };
}

// Build action for unstaking NFTs from a farm
export function buildUnstakeNftsAction(staker: string, farmName: string, assetIds: string[]) {
  return {
    account: FARM_CONTRACT,
    name: "unstake",
    authorization: [{ actor: staker, permission: "active" }],
    data: { user: staker, farmname: farmName, asset_ids: assetIds },
  };
}

// Build action for claiming rewards
export function buildClaimRewardsAction(staker: string, farmName: string) {
  return {
    account: FARM_CONTRACT,
    name: "claim",
    authorization: [{ actor: staker, permission: "active" }],
    data: { user: staker, farmname: farmName },
  };
}

// Build action for setting farm profile
export function buildSetFarmProfileAction(
  user: string,
  farmName: string,
  profile: { avatar: string; cover_image: string; description: string },
  socials: FarmSocials
) {
  return {
    account: FARM_CONTRACT,
    name: "setprofile",
    authorization: [{ actor: user, permission: "active" }],
    data: {
      user,
      farmname: farmName,
      profile: {
        avatar: profile.avatar || "",
        cover_image: profile.cover_image || "",
        description: profile.description || "",
      },
      socials: {
        atomichub: socials.atomichub || "",
        discord: socials.discord || "",
        medium: socials.medium || "",
        telegram: socials.telegram || "",
        twitter: socials.twitter || "",
        waxdao: socials.waxdao || "",
        website: socials.website || "",
        youtube: socials.youtube || "",
      },
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

    if (allFarms.length > 0) {
      const sampleCreators = allFarms.slice(0, 5).map(f => ({ name: f.farm_name, creator: f.creator }));
      console.log("Sample farm creators:", sampleCreators, "Looking for:", account);
    }

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

    console.log("Farm detail data:", data);

    if (data.rows && data.rows.length > 0) {
      const row = data.rows[0];
      const now = Math.floor(Date.now() / 1000);

      const fn = (row.farmname || row.farm_name || "") as string;
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
        farm_name: fn || farmName,
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

// Fetch user's staked NFTs in a farm - multi-strategy approach
export async function fetchUserStakes(account: string, farmName: string): Promise<UserStake[]> {
  try {
    console.log("Querying staking data for", account, "in farm", farmName);

    // Strategy 0: Query 'stakers' table by USER (index 2), filter by farmname
    try {
      const userIndexData = await fetchTableRows({
        code: FARM_CONTRACT,
        scope: FARM_CONTRACT,
        table: "stakers",
        index_position: 2,
        key_type: "name",
        lower_bound: account,
        upper_bound: account,
        limit: 100,
      });

      if (userIndexData.rows && userIndexData.rows.length > 0) {
        const farmRow = userIndexData.rows.find((row: Record<string, unknown>) => {
          return row.farmname === farmName || row.farm_name === farmName;
        });

        if (farmRow) {
          const stakedAssets = farmRow.asset_ids || farmRow.staked_assets || farmRow.assets || [];

          if (Array.isArray(stakedAssets) && stakedAssets.length > 0) {
            return stakedAssets.map((assetId: string | number) => ({
              asset_id: String(assetId),
              staker: account,
              farm_name: farmName,
              last_claim: Number(farmRow.last_claim || farmRow.last_state_change) || 0,
              claimable_balances: (farmRow.claimable_balances as Array<{ quantity: string; contract: string }>) || [],
              rates_per_hour: (farmRow.rates_per_hour as Array<{ quantity: string; contract: string }>) || [],
              last_state_change: Number(farmRow.last_state_change) || 0,
            }));
          }
        } else {
          // User is confirmed to have no stake in this specific farm
          return [];
        }
      }
    } catch (e) {
      console.log("[Strategy 0] Failed, falling back:", e);
    }

    // Strategy 0b: Query 'stakers' table with reverse order + pagination
    try {
      let foundRow: Record<string, unknown> | null = null;
      let nextKey: string | undefined = undefined;
      let iterations = 0;
      const MAX_ITERATIONS = 20;

      while (!foundRow && iterations < MAX_ITERATIONS) {
        const paginatedData = await fetchTableRows({
          code: FARM_CONTRACT,
          scope: FARM_CONTRACT,
          table: "stakers",
          reverse: true,
          limit: 1000,
          ...(nextKey ? { upper_bound: nextKey } : {}),
        });

        iterations++;

        if (paginatedData.rows && paginatedData.rows.length > 0) {
          const userRow = paginatedData.rows.find((row: Record<string, unknown>) => {
            return row.user === account && (row.farmname === farmName || row.farm_name === farmName);
          });

          if (userRow) {
            foundRow = userRow as Record<string, unknown>;
            break;
          }

          if (paginatedData.more && paginatedData.next_key) {
            nextKey = paginatedData.next_key;
          } else {
            break;
          }
        } else {
          break;
        }
      }

      if (foundRow) {
        const stakedAssets = foundRow.asset_ids || foundRow.staked_assets || foundRow.assets || [];
        if (Array.isArray(stakedAssets) && stakedAssets.length > 0) {
          return stakedAssets.map((assetId: string | number) => ({
            asset_id: String(assetId),
            staker: account,
            farm_name: farmName,
            last_claim: Number(foundRow!.last_claim || foundRow!.last_state_change) || 0,
            claimable_balances: (foundRow!.claimable_balances as Array<{ quantity: string; contract: string }>) || [],
            rates_per_hour: (foundRow!.rates_per_hour as Array<{ quantity: string; contract: string }>) || [],
            last_state_change: Number(foundRow!.last_state_change) || 0,
          }));
        }
      }
    } catch (e) {
      console.log("[Strategy 0b] Failed:", e);
    }

    // Strategy 1: Query ALL rows from 'stakers' table with farm scope
    try {
      const allFarmStakersData = await fetchTableRows({
        code: FARM_CONTRACT,
        scope: farmName,
        table: "stakers",
        limit: 100,
      });

      if (allFarmStakersData.rows && allFarmStakersData.rows.length > 0) {
        const userRow = allFarmStakersData.rows.find((row: Record<string, unknown>) => {
          const possibleUser = row.user || row.staker || row.owner || row.wallet || "";
          return possibleUser === account;
        });

        if (userRow) {
          const stakedAssets = userRow.staked_assets || userRow.asset_ids || userRow.assets || userRow.nfts || [];
          if (Array.isArray(stakedAssets) && stakedAssets.length > 0) {
            return stakedAssets.map((assetId: string | number) => ({
              asset_id: String(assetId),
              staker: account,
              farm_name: farmName,
              last_claim: (userRow.last_claim as number) || 0,
            }));
          }
        }
      }
    } catch (e) {
      console.log("[Strategy 1] Failed:", e);
    }

    // Strategy 2: Query 'stakednfts' table with farm scope
    try {
      const stakednftsData = await fetchTableRows({
        code: FARM_CONTRACT,
        scope: farmName,
        table: "stakednfts",
        limit: 1000,
      });

      if (stakednftsData.rows && stakednftsData.rows.length > 0) {
        const userRows = stakednftsData.rows.filter((row: Record<string, unknown>) => {
          const rowOwner = row.owner || row.staker || row.user || "";
          return rowOwner === account;
        });

        if (userRows.length > 0) {
          return userRows.map((row: Record<string, unknown>) => ({
            asset_id: String(row.asset_id),
            staker: account,
            farm_name: farmName,
            last_claim: (row.last_claim as number) || 0,
          }));
        }
      }
    } catch (e) {
      console.log("[Strategy 2] Failed:", e);
    }

    // Strategy 3-7: Additional fallback strategies
    // (Omitted for brevity - same pattern as above with different table/scope combos)

    console.log("No staked NFTs found for", account, "in farm", farmName);
    return [];
  } catch (error) {
    console.error("Error fetching user stakes:", error);
    return [];
  }
}

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

// Helper to fetch collection names for template IDs from AtomicHub
async function fetchTemplateCollections(templateIds: number[]): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (templateIds.length === 0) return map;

  try {
    const ids = templateIds.join(",");
    const response = await fetch(`https://wax.api.atomicassets.io/atomicassets/v1/templates?ids=${ids}&limit=100`);
    const data = await response.json();

    if (data.success && data.data) {
      for (const template of data.data) {
        const templateId = parseInt(template.template_id);
        const collection = template.collection?.collection_name || "";
        if (collection) {
          map.set(templateId, collection);
        }
      }
    }
  } catch (error) {
    console.error("Error fetching template collections from AtomicHub:", error);
  }

  return map;
}

function parseRewardValues(row: Record<string, unknown>): { hourlyRate: string; hourlyRates: RewardRate[] } {
  let hourlyRate = String(row.hourly_rate || row.rate || row.staking_value || row.reward || "0");
  let hourlyRates: RewardRate[] = [];

  const rewardValues = row.reward_values as Array<{ quantity?: string; contract?: string }> | undefined;
  if (rewardValues && Array.isArray(rewardValues) && rewardValues.length > 0) {
    if (rewardValues[0].quantity) {
      hourlyRate = rewardValues[0].quantity;
    }
    hourlyRates = rewardValues.map(rv => ({
      quantity: rv.quantity || "0",
      contract: rv.contract || "",
    }));
  }

  return { hourlyRate, hourlyRates };
}

export async function fetchFarmStakableConfig(farmName: string): Promise<FarmStakableConfig> {
  const config: FarmStakableConfig = {
    collections: [],
    schemas: [],
    templates: [],
    attributes: [],
  };

  try {
    // Fetch templates from valuesbytemp
    try {
      const templatesData = await fetchTableRows({
        code: FARM_CONTRACT,
        scope: farmName,
        table: "valuesbytemp",
        limit: 500,
      });

      if (templatesData.rows && templatesData.rows.length > 0) {
        const rawTemplates = templatesData.rows.map((r: Record<string, unknown>) => {
          const { hourlyRate, hourlyRates } = parseRewardValues(r);
          return {
            template_id: Number(r.template_id || r.templateid || r.id || 0),
            collection: String(r.collection_name || r.collection || ""),
            hourly_rate: hourlyRate,
            hourly_rates: hourlyRates.length > 0 ? hourlyRates : undefined,
          };
        });

        const missingCollectionIds = rawTemplates
          .filter((t: StakableTemplate) => !t.collection)
          .map((t: StakableTemplate) => t.template_id);

        if (missingCollectionIds.length > 0) {
          const collectionMap = await fetchTemplateCollections(missingCollectionIds);
          config.templates = rawTemplates.map((t: StakableTemplate) => ({
            ...t,
            collection: t.collection || collectionMap.get(t.template_id) || "",
          }));
        } else {
          config.templates = rawTemplates;
        }
      }
    } catch (e) {
      console.log(`[Farm ${farmName}] No valuesbytemp table`);
    }

    // Fetch schemas from valuesbysch
    try {
      const schemasData = await fetchTableRows({
        code: FARM_CONTRACT,
        scope: farmName,
        table: "valuesbysch",
        limit: 500,
      });

      if (schemasData.rows && schemasData.rows.length > 0) {
        config.schemas = schemasData.rows.map((r: Record<string, unknown>) => {
          const { hourlyRate, hourlyRates } = parseRewardValues(r);
          return {
            collection: String(r.collection_name || r.collection || ""),
            schema: String(r.schema_name || r.schema || ""),
            hourly_rate: hourlyRate,
            hourly_rates: hourlyRates.length > 0 ? hourlyRates : undefined,
          };
        });
      }
    } catch (e) {
      console.log(`[Farm ${farmName}] No valuesbysch table`);
    }

    // Fetch collections from valuesbycol
    try {
      const collectionsData = await fetchTableRows({
        code: FARM_CONTRACT,
        scope: farmName,
        table: "valuesbycol",
        limit: 500,
      });

      if (collectionsData.rows && collectionsData.rows.length > 0) {
        config.collections = collectionsData.rows.map((r: Record<string, unknown>) => {
          const { hourlyRate, hourlyRates } = parseRewardValues(r);
          return {
            collection: String(r.collection_name || r.collection || r.name || ""),
            hourly_rate: hourlyRate,
            hourly_rates: hourlyRates.length > 0 ? hourlyRates : undefined,
          };
        });
      }
    } catch (e) {
      console.log(`[Farm ${farmName}] No valuesbycol table`);
    }

    // Fetch attributes from valuesbyatt
    try {
      const attributesData = await fetchTableRows({
        code: FARM_CONTRACT,
        scope: farmName,
        table: "valuesbyatt",
        limit: 500,
      });

      if (attributesData.rows && attributesData.rows.length > 0) {
        config.attributes = attributesData.rows.map((r: Record<string, unknown>) => {
          const { hourlyRate, hourlyRates } = parseRewardValues(r);
          return {
            attribute_name: String(r.attribute_name || r.attr_name || r.key || ""),
            attribute_value: String(r.attribute_value || r.attr_value || r.value || ""),
            hourly_rate: hourlyRate,
            hourly_rates: hourlyRates.length > 0 ? hourlyRates : undefined,
          };
        });
      }
    } catch (e) {
      console.log(`[Farm ${farmName}] No valuesbyatt table`);
    }

  } catch (error) {
    console.error("Error fetching farm stakable config:", error);
  }

  return config;
}

// Fetch user's pending rewards for a farm
export interface PendingReward {
  symbol: string;
  amount: number;
  precision: number;
  contract?: string;
}

export async function fetchPendingRewards(account: string, farmName: string): Promise<PendingReward[]> {
  try {
    // Strategy 1: Query stakers table by farmname index
    const data = await fetchTableRows({
      code: FARM_CONTRACT,
      scope: FARM_CONTRACT,
      table: "stakers",
      index_position: 3,
      key_type: "name",
      lower_bound: farmName,
      upper_bound: farmName,
      limit: 500,
    });

    if (data.rows && data.rows.length > 0) {
      const userRow = data.rows.find((row: Record<string, unknown>) =>
        row.user === account
      );

      if (userRow && userRow.claimable_balances && Array.isArray(userRow.claimable_balances)) {
        return userRow.claimable_balances.map((b: { quantity: string; contract: string }) => {
          const parts = b.quantity.split(" ");
          const amount = parseFloat(parts[0]) || 0;
          const symbol = parts[1] || "";
          const precision = parts[0].includes(".") ? parts[0].split(".")[1]?.length || 0 : 0;
          return { symbol, amount, precision };
        });
      }
    }

    // Strategy 2: Fallback - query by user index
    const data2 = await fetchTableRows({
      code: FARM_CONTRACT,
      scope: FARM_CONTRACT,
      table: "stakers",
      index_position: 2,
      key_type: "name",
      lower_bound: account,
      upper_bound: account,
      limit: 100,
    });

    if (data2.rows && data2.rows.length > 0) {
      const farmRow = data2.rows.find((row: Record<string, unknown>) =>
        row.farmname === farmName || row.farm_name === farmName
      );

      if (farmRow && farmRow.claimable_balances && Array.isArray(farmRow.claimable_balances)) {
        return farmRow.claimable_balances.map((b: { quantity: string; contract: string }) => {
          const parts = b.quantity.split(" ");
          const amount = parseFloat(parts[0]) || 0;
          const symbol = parts[1] || "";
          const precision = parts[0].includes(".") ? parts[0].split(".")[1]?.length || 0 : 0;
          return { symbol, amount, precision };
        });
      }
    }

    return [];
  } catch (error) {
    console.error("Error fetching pending rewards:", error);
    return [];
  }
}

// Get collection names from stakable config
export function getCollectionNames(config: FarmStakableConfig): string[] {
  const collections = new Set<string>();

  config.collections.forEach(c => collections.add(c.collection));
  config.schemas.forEach(s => collections.add(s.collection));
  config.templates.forEach(t => collections.add(t.collection));

  return Array.from(collections);
}
