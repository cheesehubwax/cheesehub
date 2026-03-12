// Fetch lifetime stats for CHEESEAds (cheesebannad contract)

import { fetchTableRows } from './waxRpcFallback';

const BANNER_CONTRACT = 'cheesebannad';
const HYPERION_ENDPOINT = 'https://wax.eosusa.io/v2/history/get_actions';
const BATCH_SIZE = 1000;
const MAX_ACTIONS = 50000;

function parseAsset(str: string): number {
  if (!str) return 0;
  return parseFloat(str.split(' ')[0]) || 0;
}

export interface BannerAdStats {
  totalAdsRented: number;
  cheeseBurnt: number;
  waxToCheesepowerz: number;
  waxToCheeseburner: number;
}

/** Count rented slots from the bannerads table (user !== contract) */
async function fetchTotalAdsRented(): Promise<number> {
  try {
    const result = await fetchTableRows<{ user: string }>(
      { code: BANNER_CONTRACT, scope: BANNER_CONTRACT, table: 'bannerads', limit: 1000 },
      10000
    );
    return result.rows.filter((r) => r.user !== BANNER_CONTRACT).length;
  } catch {
    return 0;
  }
}

/** Fetch total WAX transfers from cheesebannad to a recipient via Hyperion */
async function fetchWaxTransfers(to: string): Promise<number> {
  let total = 0;
  let skip = 0;

  while (skip < MAX_ACTIONS) {
    try {
      const url = `${HYPERION_ENDPOINT}?act.account=eosio.token&act.name=transfer&transfer.from=${BANNER_CONTRACT}&transfer.to=${to}&limit=${BATCH_SIZE}&skip=${skip}`;
      const response = await fetch(url);
      if (!response.ok) break;

      const data = await response.json();
      const actions = data.actions;
      if (!actions || actions.length === 0) break;

      for (const action of actions) {
        const quantity = action.act?.data?.quantity;
        if (quantity && typeof quantity === 'string' && quantity.includes('WAX')) {
          total += parseAsset(quantity);
        }
      }

      if (actions.length < BATCH_SIZE) break;
      skip += BATCH_SIZE;
    } catch {
      break;
    }
  }

  return total;
}

/** Fetch CHEESE burnt (cheesebannad → eosio.null via cheeseburger token) */
async function fetchCheeseBurnt(): Promise<number> {
  let total = 0;
  let skip = 0;

  while (skip < MAX_ACTIONS) {
    try {
      const url = `${HYPERION_ENDPOINT}?act.account=cheeseburger&act.name=transfer&transfer.from=${BANNER_CONTRACT}&transfer.to=eosio.null&limit=${BATCH_SIZE}&skip=${skip}`;
      const response = await fetch(url);
      if (!response.ok) break;

      const data = await response.json();
      const actions = data.actions;
      if (!actions || actions.length === 0) break;

      for (const action of actions) {
        const quantity = action.act?.data?.quantity;
        if (quantity) {
          total += parseAsset(quantity);
        }
      }

      if (actions.length < BATCH_SIZE) break;
      skip += BATCH_SIZE;
    } catch {
      break;
    }
  }

  return total;
}

export async function fetchBannerAdStats(): Promise<BannerAdStats> {
  const [totalAdsRented, cheeseBurnt, waxToCheesepowerz, waxToCheeseburner] = await Promise.all([
    fetchTotalAdsRented(),
    fetchCheeseBurnt(),
    fetchWaxTransfers('cheesepowerz'),
    fetchWaxTransfers('cheeseburner'),
  ]);

  return { totalAdsRented, cheeseBurnt, waxToCheesepowerz, waxToCheeseburner };
}
