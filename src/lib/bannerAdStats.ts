// Fetch lifetime stats for CHEESEAds (cheesebannad contract)
//
// History reads use a multi-provider union: a single Hyperion provider can
// silently hold only part of this contract's transfer history.

import { fetchTableRows } from './waxRpcFallback';
import { fetchActionsUnion, sumAssetField } from './hyperionHistory';

const BANNER_CONTRACT = 'cheesebannad';
const BATCH_SIZE = 1000;
const MAX_ACTIONS = 50000;

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

/** Total WAX transferred from cheesebannad to a recipient (union across providers) */
async function fetchWaxTransfers(to: string): Promise<number> {
  try {
    const { actions } = await fetchActionsUnion(
      `act.account=eosio.token&act.name=transfer&transfer.from=${BANNER_CONTRACT}&transfer.to=${to}`,
      { batchSize: BATCH_SIZE, maxActions: MAX_ACTIONS },
    );
    return sumAssetField(
      actions,
      'quantity',
      (d) =>
        d.from === BANNER_CONTRACT &&
        d.to === to &&
        typeof d.quantity === 'string' &&
        d.quantity.includes('WAX'),
    );
  } catch {
    return 0;
  }
}

/** CHEESE nulled (cheesebannad → eosio.null via cheeseburger token) */
async function fetchCheeseBurnt(): Promise<number> {
  try {
    const { actions } = await fetchActionsUnion(
      `act.account=cheeseburger&act.name=transfer&transfer.from=${BANNER_CONTRACT}&transfer.to=eosio.null`,
      { batchSize: BATCH_SIZE, maxActions: MAX_ACTIONS },
    );
    return sumAssetField(
      actions,
      'quantity',
      (d) => d.from === BANNER_CONTRACT && d.to === 'eosio.null',
    );
  } catch {
    return 0;
  }
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
