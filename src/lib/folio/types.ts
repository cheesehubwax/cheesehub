// CHEESEFolio shared types. Everything here is derived from on-chain token
// transfers of ONE signed-in account and lives only in that user's browser.

/** One token transfer the account sent or received, as stored locally. */
export interface RawTransfer {
  /** Global action sequence — unique on-chain identity, used to de-duplicate. */
  gs: number;
  trx: string;
  /** Block time, epoch ms. */
  ts: number;
  /** Token contract, e.g. `cheeseburger`. */
  contract: string;
  from: string;
  to: string;
  /** Asset string exactly as on chain, e.g. `12.3400 CHEESE`. */
  quantity: string;
  memo: string;
  /**
   * Alcor order-book fills only: what the account gave for this fill, read
   * from the `sellmatch`/`buymatch` record in the same transaction.
   */
  fillGave?: { contract: string; quantity: string } | null;
  /** True once the fill record lookup ran (even if nothing matched). */
  fillChecked?: boolean;
}

export type TokenKey = string; // `${contract}:${SYMBOL}`

export interface TokenAmount {
  key: TokenKey;
  contract: string;
  symbol: string;
  precision: number;
  amount: number;
}

export type Venue = 'alcor' | 'defibox' | 'taco' | 'alcor-orderbook';

export type FolioEventType =
  | 'trade' // swap or order-book fill: tokens out for tokens in
  | 'order-placed'
  | 'order-returned'
  | 'reward'
  | 'received'
  | 'sent'
  | 'nulled'
  | 'liquidity-add'
  | 'liquidity-remove';

/** A classified, human-meaningful event built from one transaction. */
export interface FolioEvent {
  id: string; // trx id plus an index when one transaction yields several events
  trx: string;
  ts: number;
  type: FolioEventType;
  venue?: Venue;
  /** Tokens that left the wallet (positive amounts). */
  out: TokenAmount[];
  /** Tokens that entered the wallet (positive amounts). */
  in: TokenAmount[];
  /** Other party for transfers / rewards. */
  counterparty?: string;
  memo?: string;
  /** Order-book placement: what the order asks for in return. */
  orderWant?: TokenAmount;
  /** Order-book fill: what was given for it, when the fill record was read. */
  fillGave?: TokenAmount;
  /** First global sequence of the transaction — the true chain order. */
  seq: number;
}

/** Per-token running position produced by the ledger. */
export interface TokenPosition {
  key: TokenKey;
  contract: string;
  symbol: string;
  precision: number;
  /** Tokens in the wallet according to history. */
  qty: number;
  /** Total WAX cost of `qty` (weighted average cost). */
  costWax: number;
  /** Profit/loss locked in by sells, in WAX. */
  realizedWax: number;
  /** Tokens waiting in open Alcor order-book orders. */
  onOrderQty: number;
  /** Tokens deposited into liquidity pools (at cost). */
  inLiquidityQty: number;
  inLiquidityCostWax: number;
  /** Quantity acquired for free (rewards, airdrops, incoming transfers). */
  freeQty: number;
  boughtQty: number;
  soldQty: number;
  /** True when a removal exceeded what history says was held. */
  historyGap: boolean;
  /** True when some of this token was bought with no known WAX value. */
  unpricedBuys: boolean;
}

export interface LedgerResult {
  positions: Map<TokenKey, TokenPosition>;
  /** Realized P&L per event id (WAX), for the activity feed. */
  realizedByEvent: Map<string, number>;
  /** WAX value used for each trade (when known). */
  valueByEvent: Map<string, number>;
}

/** Daily price lookup: WAX per 1 token at (or just before) a time. */
export type PriceAt = (key: TokenKey, ts: number) => number | null;

export const WAX_KEY: TokenKey = 'eosio.token:WAX';
