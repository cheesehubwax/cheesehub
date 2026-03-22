import { NFTHIVE_CONFIG, WAX_CHAIN } from './waxConfig';
import { getTokenConfig, formatTokenAmount, getSettlementSymbol, WAX_TOKENS } from './tokenRegistry';
import { fetchTableRows } from './waxRpcFallback';

export type DropType = 'mint-on-demand' | 'premint';

export interface RamBalance {
  collection: string;
  bytes: number;
}

export interface TokenBacking {
  symbol: string;
  amount: string;
}

export interface PriceOption {
  token: string;
  amount: number;
}

export interface DropFormData {
  dropType: DropType;
  collectionName: string;
  templateId: string;
  name: string;
  description: string;
  prices: PriceOption[];
  maxClaimable: number;
  accountLimit: number;
  startTime: Date;
  endTime: Date;
  isHidden: boolean;
  priceRecipient: string;
  // Pre-mint specific
  assetIds: string[];
  // Token backing
  tokensToBack: TokenBacking[];
}

export interface PriceRecipient {
  account: string;
  share: number;
}

// Re-export for convenience
export { WAX_TOKENS, getTokenConfig } from './tokenRegistry';

/**
 * Build the boost action for nft.hive contract
 * This reserves RAM for mint-on-demand drops
 * Required before createdrop action
 */
export function buildBoostAction(account: string) {
  return {
    account: NFTHIVE_CONFIG.boostContract,
    name: 'boost',
    authorization: [{ actor: account, permission: 'active' }],
    data: {
      booster: account,
    },
  };
}

/**
 * Build transfer action to deposit NFTs to nfthivedrops for pre-mint drops
 */
export function buildTransferAction(account: string, assetIds: string[]) {
  return {
    account: 'atomicassets',
    name: 'transfer',
    authorization: [{ actor: account, permission: 'active' }],
    data: {
      from: account,
      to: NFTHIVE_CONFIG.dropContract,
      asset_ids: assetIds,
      memo: 'deposit',
    },
  };
}

/**
 * Build the createdrop action for nfthivedrops contract
 */
export function buildCreateDropAction(
  account: string,
  data: DropFormData
) {
  // Build listing prices from all price options
  const listingPrices = data.prices
    .filter(p => p.amount > 0)
    .map(p => formatTokenAmount(p.amount, p.token));

  // Settlement symbol uses the first (primary) token
  const primaryPrice = data.prices[0];
  const settlementSymbol = getSettlementSymbol(primaryPrice.token);

  const priceRecipients: PriceRecipient[] = [
    {
      account: data.priceRecipient || account,
      share: 1
    }
  ];

  // For pre-mint drops: assets_to_mint is empty (NFTs already transferred)
  // For mint-on-demand: assets_to_mint contains the template info as an object
  const isPremint = data.dropType === 'premint';
  const templateId = isPremint ? -1 : parseInt(data.templateId);

  // Format tokens_to_back as simple asset strings (e.g., "10.0000 CHEESE")
  const tokensToBack = data.tokensToBack
    .filter(t => t.symbol && t.amount && parseFloat(t.amount) > 0)
    .map(t => formatTokenAmount(parseFloat(t.amount), t.symbol));

  // Build assets_to_mint with nested template info for mint-on-demand
  const assetsToMint = isPremint
    ? []
    : [{
        template_id: templateId,
        pool_id: 0,
        tokens_to_back: tokensToBack
      }];

  console.log('🧀 Building drop action:', {
    dropType: data.dropType,
    templateId,
    collectionName: data.collectionName,
    isPremint,
    assetsToMint,
    tokensToBack,
    prices: listingPrices,
  });

  return {
    account: NFTHIVE_CONFIG.dropContract,
    name: 'createdrop',
    authorization: [{ actor: account, permission: 'active' }],
    data: {
      authorized_account: account,
      collection_name: data.collectionName,
      assets_to_mint: assetsToMint,
      listing_prices: listingPrices,
      settlement_symbol: settlementSymbol,
      price_recipients: priceRecipients,
      auth_required: false,
      max_claimable: data.maxClaimable,
      account_limit: data.accountLimit,
      account_limit_cooldown: 0,
      start_time: Math.floor(data.startTime.getTime() / 1000),
      end_time: Math.floor(data.endTime.getTime() / 1000),
      display_data: JSON.stringify({
        name: data.name,
        description: data.description,
      }),
      is_hidden: data.isHidden,
    },
  };
}

/**
 * Build all actions needed for a complete drop creation
 */
export function buildDropCreationActions(
  account: string,
  data: DropFormData
) {
  if (data.dropType === 'premint') {
    return [
      buildTransferAction(account, data.assetIds),
      buildCreateDropAction(account, data)
    ];
  }

  return [
    buildBoostAction(account),
    buildCreateDropAction(account, data)
  ];
}

/**
 * Validate drop form data before submission
 */
export function validateDropFormData(data: DropFormData): string | null {
  if (!data.collectionName.trim()) {
    return 'Collection name is required';
  }

  if (data.dropType === 'mint-on-demand') {
    if (!data.templateId.trim()) {
      return 'Template ID is required for mint-on-demand drops';
    }

    const templateIdNum = parseInt(data.templateId);
    if (isNaN(templateIdNum) || templateIdNum <= 0) {
      return 'Template ID must be a positive number';
    }
  }

  if (data.dropType === 'premint') {
    if (!data.assetIds || data.assetIds.length === 0) {
      return 'Please select at least one NFT for pre-mint drop';
    }
  }

  if (!data.name.trim()) {
    return 'Drop name is required';
  }

  if (!data.prices || data.prices.length === 0) {
    return 'At least one price is required';
  }

  const validPrices = data.prices.filter(p => p.amount > 0);
  if (validPrices.length === 0) {
    return 'At least one price must be greater than 0';
  }

  for (const price of validPrices) {
    const config = getTokenConfig(price.token);
    if (!config) {
      return `Unknown token: ${price.token}`;
    }
  }

  if (data.dropType !== 'premint' && data.maxClaimable <= 0) {
    return 'Max claimable must be greater than 0';
  }

  if (data.accountLimit <= 0) {
    return 'Account limit must be greater than 0';
  }

  if (data.startTime >= data.endTime) {
    return 'End time must be after start time';
  }

  if (data.priceRecipient && !/^[a-z1-5.]{1,12}$/.test(data.priceRecipient)) {
    return 'Invalid price recipient account name';
  }

  return null;
}

/**
 * Build actions to deposit WAX for RAM to the nfthivedrops contract
 */
export function buildDepositRamActions(account: string, collectionName: string, waxAmount: number) {
  const formattedAmount = `${waxAmount.toFixed(8)} WAX`;

  return [
    {
      account: NFTHIVE_CONFIG.boostContract,
      name: 'boost',
      authorization: [{ actor: account, permission: 'active' }],
      data: {
        booster: account,
      },
    },
    {
      account: 'eosio.token',
      name: 'transfer',
      authorization: [{ actor: account, permission: 'active' }],
      data: {
        from: account,
        to: NFTHIVE_CONFIG.dropContract,
        quantity: formattedAmount,
        memo: `deposit_collection_ram:${collectionName}`,
      },
    },
  ];
}

/**
 * Build action to withdraw RAM from the nfthivedrops contract
 */
export function buildWithdrawRamActions(account: string, collectionName: string, bytes: number) {
  return [
    {
      account: NFTHIVE_CONFIG.dropContract,
      name: 'withdrawram',
      authorization: [{ actor: account, permission: 'active' }],
      data: {
        authorized_account: account,
        bytes: bytes,
        collection_name: collectionName,
        recipient: account,
      },
    },
  ];
}

/**
 * Fetch the deposited RAM balance for a collection from nfthivedrops
 */
export async function fetchCollectionRamBalance(collectionName: string): Promise<RamBalance | null> {
  const rpcUrls = WAX_CHAIN.rpcUrls || [WAX_CHAIN.url];

  for (const rpcUrl of rpcUrls) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(`${rpcUrl}/v1/chain/get_table_rows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: NFTHIVE_CONFIG.dropContract,
          scope: NFTHIVE_CONFIG.dropContract,
          table: 'rambalances',
          lower_bound: collectionName,
          upper_bound: collectionName,
          limit: 1,
          json: true,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`RPC ${rpcUrl} returned ${response.status}, trying next...`);
        continue;
      }

      const data = await response.json();
      console.log('RAM balance response:', JSON.stringify(data, null, 2));

      if (data.rows && data.rows.length > 0) {
        const row = data.rows[0];
        const bytes = row.byte_balance ?? 0;
        return {
          collection: row.collection_name ?? collectionName,
          bytes: typeof bytes === 'number' ? bytes : parseInt(bytes) || 0,
        };
      }

      return null;
    } catch (error) {
      console.warn(`RPC ${rpcUrl} failed:`, (error as Error).message);
    }
  }

  console.error('All RPC endpoints failed to fetch collection RAM balance');
  return null;
}

/**
 * Build actions to erase/delete a drop from nfthivedrops
 */
export function buildEraseDropActions(account: string, dropId: number) {
  return [
    {
      account: NFTHIVE_CONFIG.boostContract,
      name: 'boost',
      authorization: [{ actor: account, permission: 'active' }],
      data: { booster: account },
    },
    {
      account: NFTHIVE_CONFIG.dropContract,
      name: 'erasedrop',
      authorization: [{ actor: account, permission: 'active' }],
      data: {
        authorized_account: account,
        drop_id: dropId,
      },
    },
  ];
}

/**
 * Fetch total remaining claimable NFTs across all active mint-on-demand drops for a collection.
 * Used to calculate collection-wide RAM requirements.
 */
export async function fetchCollectionActiveDropsClaims(collectionName: string): Promise<{ totalRemaining: number; dropCount: number }> {
  const now = Math.floor(Date.now() / 1000);
  let totalRemaining = 0;
  let dropCount = 0;
  let more = true;
  let lowerBound = '';

  while (more) {
    const response = await fetchTableRows<{
      drop_id: number;
      collection_name: string;
      assets_to_mint: unknown[];
      max_claimable: number;
      current_claimed: number;
      start_time: number;
      end_time: number;
    }>({
      code: NFTHIVE_CONFIG.dropContract,
      scope: NFTHIVE_CONFIG.dropContract,
      table: 'drops',
      limit: 100,
      ...(lowerBound ? { lower_bound: lowerBound } : {}),
    });

    for (const drop of response.rows) {
      if (drop.collection_name !== collectionName) continue;
      if (!drop.assets_to_mint || drop.assets_to_mint.length === 0) continue;
      if (drop.end_time > 0 && drop.end_time < now) continue;
      if (drop.max_claimable > 0 && drop.current_claimed >= drop.max_claimable) continue;

      const remaining = drop.max_claimable > 0
        ? drop.max_claimable - drop.current_claimed
        : 0;

      if (remaining > 0) {
        totalRemaining += remaining;
        dropCount++;
      }
    }

    more = response.more;
    if (more && response.next_key) {
      lowerBound = response.next_key;
    } else {
      more = false;
    }
  }

  console.log(`[Drops] Collection "${collectionName}": ${dropCount} active mint-on-demand drops, ${totalRemaining} total remaining claims`);
  return { totalRemaining, dropCount };
}
