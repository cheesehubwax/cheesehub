export type DropSource = 'nfthive' | 'neftyblocks' | 'atomichub' | 'sale';

// Auth requirement types for restricted drops
export interface DropAuthRequirement {
  type: 'collection' | 'schema' | 'template';
  collectionName: string;
  schemaName?: string;
  templateId?: number;
}

// Price option for drops with multiple token prices
export interface DropPrice {
  price: number;
  currency: string;
  tokenContract?: string;
  listingPrice: string; // Original format like "100.0000 CHEESE"
  precision?: number; // Token precision (derived from listingPrice decimals)
}

// Selected price for cart items
export interface SelectedPrice {
  price: number;
  currency: string;
  tokenContract: string;
  precision: number;
  listingPrice: string;
}

export interface NFTDrop {
  id: string;
  saleId?: string;
  templateId?: string;
  collectionName: string;
  name: string;
  description: string;
  templateDescription?: string;
  image: string;
  price: number; // Primary price for backwards compatibility
  prices?: DropPrice[]; // All available price options
  totalSupply: number;
  remaining: number;
  seller?: string;
  attributes: { trait: string; value: string }[];
  endDate?: string;
  dropSource?: DropSource;
  dropId?: string;
  settlementSymbol?: string;
  listingPrice?: string;
  currency?: string;
  tokenContract?: string;
  // Auth-required drop fields
  authRequired?: boolean;
  authRequirements?: DropAuthRequirement[];
  isFree?: boolean;
  accountLimit?: number;
}

export interface AtomicSale {
  sale_id: string;
  seller: string;
  buyer: string | null;
  offer_id: string;
  price: {
    token_contract: string;
    token_symbol: string;
    token_precision: number;
    amount: string;
  };
  listing_price: string;
  listing_symbol: string;
  assets: AtomicAsset[];
  collection_name: string;
  state: number;
  updated_at_block: string;
  updated_at_time: string;
  created_at_block: string;
  created_at_time: string;
}

export interface AtomicAsset {
  asset_id: string;
  contract: string;
  collection: {
    collection_name: string;
    name: string;
    img: string;
    author: string;
  };
  schema: {
    schema_name: string;
    format: { name: string; type: string }[];
  };
  template: {
    template_id: string;
    max_supply: string;
    is_transferable: boolean;
    is_burnable: boolean;
    issued_supply: string;
    immutable_data: Record<string, string>;
  } | null;
  name: string;
  data: Record<string, string>;
  immutable_data: Record<string, string>;
  mutable_data: Record<string, string>;
}

export interface AtomicTemplate {
  template_id: string;
  contract: string;
  collection: {
    collection_name: string;
    name: string;
    img: string;
  };
  schema: {
    schema_name: string;
  };
  name: string;
  max_supply: string;
  is_transferable: boolean;
  is_burnable: boolean;
  issued_supply: string;
  immutable_data: Record<string, string>;
  created_at_time: string;
  created_at_block: string;
}

export interface AtomicDrop {
  drop_id: string;
  collection_name: string;
  assets_to_mint: {
    template_id: string;
    tokens_to_back: string[];
  }[];
  listing_price: string;
  settlement_symbol: string;
  price_recipient: string;
  fee_rate: number;
  auth_required: number;
  account_limit: number;
  account_limit_cooldown: number;
  max_claimable: string;
  current_claimed: string;
  start_time: string;
  end_time: string;
  display_data: string;
  created_at_time: string;
  created_at_block: string;
  templates_to_mint: AtomicTemplate[];
}

// NFT Hive API response format
export interface NFTHiveDrop {
  dropId: number;
  contract: string;
  price: number;
  currency: string;
  startTime: number;
  endTime: number;
  maxClaimable: number;
  numClaimed: number | null;
  displayData: { name?: string; description?: string } | null;
  collection: {
    collectionName: string;
    displayName: string;
  };
  templatesToMint: Array<{
    templateId: number;
    name: string;
    immutableData: Array<{ key: string; value: [string, string] }>;
  }>;
}
