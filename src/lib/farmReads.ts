// WaxDAO V2 Farm Contract (farms.waxdao) — chain reads (farms, stakes, stakable config, pending rewards).

import { fetchTableRows } from "./waxRpcFallback";
import { fetchWithFallback } from "./fetchWithFallback";
import { ATOMIC_API } from "./waxConfig";
import { FARM_CONTRACT, type FarmInfo, type UserStake, type RewardRate, type StakableTemplate, type FarmStakableConfig, type PendingReward, type FarmProfile, type FarmSocials, type RewardPool } from "./farmModel";

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

    // Strategy 0: Query 'stakers' table by USER (index 3), filter by farmname
    try {
      const userIndexData = await fetchTableRows({
        code: FARM_CONTRACT,
        scope: FARM_CONTRACT,
        table: "stakers",
        index_position: 3,
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

// Helper to fetch collection names for template IDs from AtomicHub
async function fetchTemplateCollections(templateIds: number[]): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (templateIds.length === 0) return map;

  try {
    const ids = templateIds.join(",");
    const response = await fetchWithFallback(ATOMIC_API.baseUrls, `${ATOMIC_API.paths.templates}?ids=${ids}&limit=100`);
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

// Capacity needs only the farm's active rule table, not metadata or unrelated tables.
// Never publish a partial read as a complete capacity summary.
export async function fetchFarmCapacityConfig(farmName: string, farmType: number): Promise<FarmStakableConfig> {
  const table = ['valuesbycol', 'valuesbysch', 'valuesbytemp', 'valuesbyatt'][farmType];
  if (!table) throw new Error('Unknown farm type');
  const config: FarmStakableConfig = { collections: [], schemas: [], templates: [], attributes: [] };
  let cursor: string | undefined;
  for (let page = 0; page < 10; page++) {
    const data = await fetchTableRows({ code: FARM_CONTRACT, scope: farmName, table, limit: 500, lower_bound: cursor });
    for (const row of data.rows) {
      const { hourlyRate, hourlyRates } = parseRewardValues(row);
      const rate = { hourly_rate: hourlyRate, hourly_rates: hourlyRates.length ? hourlyRates : undefined };
      const collection = String(row.collection_name || row.collection || row.name || '');
      if (farmType === 0) config.collections.push({ ...rate, collection });
      if (farmType === 1) config.schemas.push({ ...rate, collection, schema: String(row.schema_name || row.schema || '') });
      if (farmType === 2) config.templates.push({ ...rate, collection, template_id: Number(row.template_id || row.templateid || row.id || 0) });
      if (farmType === 3) config.attributes.push({ ...rate, attribute_name: String(row.attribute_name || row.attr_name || row.key || ''), attribute_value: String(row.attribute_value || row.attr_value || row.value || '') });
    }
    if (!data.more) return config;
    if (!data.next_key || data.next_key === cursor) throw new Error('Incomplete farm capacity rules');
    cursor = data.next_key;
  }
  throw new Error('Farm capacity rule limit reached');
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

export async function fetchPendingRewards(account: string, farmName: string): Promise<PendingReward[]> {
  try {
    // Strategy 1: Query stakers table by farmname index (4; index 3 is user)
    const data = await fetchTableRows({
      code: FARM_CONTRACT,
      scope: FARM_CONTRACT,
      table: "stakers",
      index_position: 4,
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
      index_position: 3,
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

