// WaxDAO V2 Farm Contract (farms.waxdao) — cross-farm staked detection.

import { fetchTableRows } from "./waxRpcFallback";
import { FARM_CONTRACT } from "./farmModel";

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
        index_position: 3,
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
    const PAGE_SIZE = 1000;
    const MAX_ITERATIONS = 10;
    const seenFarms = new Set<string>();

    while (hasMore && iterations < MAX_ITERATIONS) {
      try {
        const response = await fetchTableRows({
          code: FARM_CONTRACT,
          scope: FARM_CONTRACT,
          table: 'stakers',
          limit: PAGE_SIZE,
          reverse: true,
          ...(upperBound ? { upper_bound: upperBound } : {}),
        });

        if (!response.rows || response.rows.length === 0) {
          hasMore = false;
          break;
        }

        for (const row of response.rows) {
          const farmRow = row as Record<string, unknown>;
          const user = (farmRow.user || farmRow.staker || farmRow.owner || '') as string;
          const farmName = (farmRow.farmname || farmRow.farm_name || '') as string;
          const assetIds = (farmRow.asset_ids || farmRow.staked_assets || farmRow.assets || []) as (string | number)[];

          if (user === account && farmName && assetIds.length > 0 && !seenFarms.has(farmName)) {
            seenFarms.add(farmName);
            results.push({
              farmName,
              assetIds: assetIds.map(id => String(id)),
            });
          }
        }

        const lastRow = response.rows[response.rows.length - 1] as Record<string, unknown>;
        const lastId = Number(lastRow.ID ?? lastRow.id);

        if (Number.isFinite(lastId) && response.more) {
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

