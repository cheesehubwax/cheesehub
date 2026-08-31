// CHEESERam — on-chain helpers for the RAM-for-CHEESE contract
import { fetchWithFallback } from '@/lib/fetchWithFallback';

/** The CHEESERam contract account. Change this single constant to point the dApp elsewhere. */
export const CHEESE_RAM_CONTRACT = 'ram.chz';
export const CHEESE_TOKEN_CONTRACT = 'cheeseburger';
export const SELL_MEMO = 'CHEESERam sell';

/**
 * Whether the deployed contract's `claimvotes` action accepts any signer.
 * The `ram.chz` contract has been redeployed with a public claim path, so
 * any connected wallet can now fund the WAX pool manually.
 */
export const PUBLIC_VOTE_CLAIM = true;

const WAX_ENDPOINTS = [
  'https://wax.greymass.com',
  'https://wax.eosusa.io',
  'https://api.waxsweden.org',
  'https://wax.eosphere.io',
];

export interface CheeseRamConfig {
  admin: string;
  minCheese: number;
  maxCheese: number;
  enabled: boolean;
  referenceRate: number; // WAX per CHEESE (contract oracle rate, set by admin)
  maxDeviationPct: number; // allowed drift between live market rate and referenceRate

  minLiquidReserve: number;
  sellEnabled: boolean;
  minSellBytes: number;
  maxSellBytes: number;
  minCheesePool: number;
  buySpreadBps: number;
  sellSpreadBps: number;
  sellHaircutBps: number;
}

export interface CheeseRamStats {
  totalPurchases: number;
  totalCheeseReceived: number;
  totalWaxSpent: number;
  totalBytesBought: number;
  totalSales: number;
  totalBytesSoldBack: number;
  totalCheesePaidOut: number;
  totalWaxReceived: number;
  totalCheeseDeposited: number;
  totalCheeseNulled: number;
  totalCheeseToXcheese: number;
  totalWaxStaked: number;
  totalWaxToPowerz: number;
  totalWaxToBurner: number;
  totalWaxToBuyback: number;
  totalCheeseBuyback: number;
  totalWaxClaimed: number;
  lastClaimAttempt: number;
  claimPending: number;
}

export interface ContractReserves {
  liquidWax: number;
  cheesePool: number;
}

export const parseAsset = (value: string | undefined | null): number => {
  if (!value) return 0;
  return parseFloat(String(value).split(' ')[0]) || 0;
};

async function getTableRows<T>(body: Record<string, unknown>): Promise<T[]> {
  const response = await fetchWithFallback(WAX_ENDPOINTS, '/v1/chain/get_table_rows', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ json: true, limit: 1, ...body }),
  });
  const data = await response.json();
  return (data?.rows ?? []) as T[];
}

export async function fetchCheeseRamConfig(): Promise<CheeseRamConfig | null> {
  const rows = await getTableRows<Record<string, string | number | boolean>>({
    code: CHEESE_RAM_CONTRACT,
    scope: CHEESE_RAM_CONTRACT,
    table: 'config',
  });
  const row = rows[0];
  if (!row) return null;
  return {
    admin: String(row.admin ?? ''),
    minCheese: parseAsset(row.min_cheese as string),
    maxCheese: parseAsset(row.max_cheese as string),
    enabled: Boolean(row.enabled),
    referenceRate: parseFloat(String(row.reference_rate ?? '0')) || 0,
    maxDeviationPct: parseFloat(String(row.max_deviation_pct ?? '0')) || 0,

    minLiquidReserve: parseAsset(row.min_liquid_reserve as string),
    sellEnabled: Boolean(row.sell_enabled),
    minSellBytes: Number(row.min_sell_bytes ?? 0),
    maxSellBytes: Number(row.max_sell_bytes ?? 0),
    minCheesePool: parseAsset(row.min_cheese_pool as string),
    buySpreadBps: Number(row.buy_spread_bps ?? 0),
    sellSpreadBps: Number(row.sell_spread_bps ?? 0),
    sellHaircutBps: Number(row.sell_haircut_bps ?? 0),
  };
}

export async function fetchCheeseRamStats(): Promise<CheeseRamStats | null> {
  const rows = await getTableRows<Record<string, string | number>>({
    code: CHEESE_RAM_CONTRACT,
    scope: CHEESE_RAM_CONTRACT,
    table: 'stats',
  });
  const row = rows[0];
  if (!row) return null;
  return {
    totalPurchases: Number(row.total_purchases ?? 0),
    totalCheeseReceived: parseAsset(row.total_cheese_received as string),
    totalWaxSpent: parseAsset(row.total_wax_spent as string),
    totalBytesBought: Number(row.total_bytes_bought ?? 0),
    totalSales: Number(row.total_sales ?? 0),
    totalBytesSoldBack: Number(row.total_bytes_sold_back ?? 0),
    totalCheesePaidOut: parseAsset(row.total_cheese_paid_out as string),
    totalWaxReceived: parseAsset(row.total_wax_received as string),
    totalCheeseDeposited: parseAsset(row.total_cheese_deposited as string),
    totalCheeseNulled: parseAsset(row.total_cheese_burned as string),
    totalCheeseToXcheese: parseAsset(row.total_cheese_to_xcheese as string),
    totalWaxStaked: parseAsset(row.total_wax_staked as string),
    totalWaxToPowerz: parseAsset(row.total_wax_to_powerz as string),
    totalWaxToBurner: parseAsset(row.total_wax_to_burner as string),
    totalWaxToBuyback: parseAsset(row.total_wax_to_buyback as string),
    totalCheeseBuyback: parseAsset(row.total_cheese_buyback as string),
    totalWaxClaimed: parseAsset(row.total_wax_claimed as string),
    lastClaimAttempt: Number(row.last_claim_attempt ?? 0),
    claimPending: Number(row.claim_pending ?? 0),
  };
}

/** WAX cost of a single byte of RAM, straight from the eosio::rammarket table. */
export async function fetchRamPricePerByte(): Promise<number> {
  const rows = await getTableRows<{ base: { balance: string }; quote: { balance: string } }>({
    code: 'eosio',
    scope: 'eosio',
    table: 'rammarket',
  });
  const row = rows[0];
  if (!row) throw new Error('rammarket unavailable');
  const quote = parseAsset(row.quote.balance);
  const base = parseAsset(row.base.balance);
  if (!base) throw new Error('invalid rammarket state');
  return quote / base;
}

export async function fetchAccountRam(account: string): Promise<{ quota: number; usage: number }> {
  const response = await fetchWithFallback(WAX_ENDPOINTS, '/v1/chain/get_account', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account_name: account }),
  });
  const data = await response.json();
  return { quota: Number(data?.ram_quota ?? 0), usage: Number(data?.ram_usage ?? 0) };
}

async function fetchCurrencyBalance(code: string, account: string, symbol: string): Promise<number> {
  const response = await fetchWithFallback(WAX_ENDPOINTS, '/v1/chain/get_currency_balance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, account, symbol }),
  });
  const data = await response.json();
  return parseAsset(Array.isArray(data) ? data[0] : undefined);
}

export async function fetchContractReserves(): Promise<ContractReserves> {
  const [liquidWax, cheesePool] = await Promise.all([
    fetchCurrencyBalance('eosio.token', CHEESE_RAM_CONTRACT, 'WAX'),
    fetchCurrencyBalance(CHEESE_TOKEN_CONTRACT, CHEESE_RAM_CONTRACT, 'CHEESE'),
  ]);
  return { liquidWax, cheesePool };
}

export interface ContractVoteRewards {
  /** Estimated claimable WAX at `sampledAt`. */
  claimable: number;
  /** Per-second accrual so the UI can tick the estimate up. */
  perSecond: number;
  /** Epoch ms the estimate was computed for. */
  sampledAt: number;
  /** Epoch ms of the contract's last on-chain vote claim (0 when never). */
  lastClaimTime: number;
  /** Epoch ms the next claim becomes possible (last claim + 24h). */
  nextClaimTime: number;
}

/**
 * Estimated WAX voting rewards claimable by the CHEESERam contract account, using the
 * same GBM voteshare formula the wallet's vote-rewards panel uses.
 */
export async function fetchContractVoteRewards(): Promise<ContractVoteRewards> {
  const [voterRows, globalRows] = await Promise.all([
    getTableRows<Record<string, string | number>>({
      code: 'eosio',
      scope: 'eosio',
      table: 'voters',
      lower_bound: CHEESE_RAM_CONTRACT,
      upper_bound: CHEESE_RAM_CONTRACT,
    }),
    getTableRows<Record<string, string | number>>({ code: 'eosio', scope: 'eosio', table: 'global' }),
  ]);

  const voter = voterRows[0];
  const global = globalRows[0];
  const now = Date.now();

  const empty: ContractVoteRewards = {
    claimable: 0,
    perSecond: 0,
    sampledAt: now,
    lastClaimTime: 0,
    nextClaimTime: 0,
  };
  if (!voter || !global) return empty;

  const parseTime = (value: unknown): number => {
    const raw = String(value ?? '');
    if (!raw || raw.startsWith('1970-01-01') || raw.startsWith('2000-01-01')) return 0;
    const ms = new Date(raw.endsWith('Z') ? raw : `${raw}Z`).getTime();
    return Number.isFinite(ms) ? ms : 0;
  };

  const lastClaimTime = parseTime(voter.last_claim_time);
  const nextClaimTime = lastClaimTime ? lastClaimTime + 24 * 60 * 60 * 1000 : 0;

  const votersBucket = (Number(global.voters_bucket ?? 0) || 0) / 100_000_000;
  const totalUnpaid = parseFloat(String(global.total_unpaid_voteshare ?? '0')) || 0;
  const unpaid = parseFloat(String(voter.unpaid_voteshare ?? '0')) || 0;
  const changeRate = parseFloat(String(voter.unpaid_voteshare_change_rate ?? '0')) || 0;
  const updatedAt = parseTime(voter.unpaid_voteshare_last_updated);

  if (totalUnpaid <= 0 || votersBucket <= 0) {
    return { ...empty, lastClaimTime, nextClaimTime };
  }

  const elapsedSecs = updatedAt ? Math.max(0, (now - updatedAt) / 1000) : 0;
  const currentVoteshare = unpaid + changeRate * elapsedSecs;
  const claimable = Math.max(0, (currentVoteshare / totalUnpaid) * votersBucket);
  const perSecond = Math.max(0, (changeRate / totalUnpaid) * votersBucket);

  return { claimable, perSecond, sampledAt: now, lastClaimTime, nextClaimTime };
}


/** RAM purchases pay a 0.5% network fee on the WAX spent. */
const RAM_FEE_RATE = 0.005;

export interface ResolvedRate {
  /** WAX per CHEESE used for quoting. */
  rate: number;
  /** True when the live market rate was used. */
  live: boolean;
  /**
   * True when the live rate drifted beyond the contract's max_deviation_pct, so the
   * stored oracle rate is used instead (the contract would reject the live price).
   */
  stale: boolean;
}

/**
 * Picks the WAX-per-CHEESE rate used for quotes: the live Alcor market rate when it
 * is within the contract's allowed deviation of the stored reference rate, otherwise
 * the stored reference rate.
 */
export function resolveQuoteRate(
  config: CheeseRamConfig | null | undefined,
  liveWaxPerCheese: number | null | undefined,
): ResolvedRate | null {
  const reference = config?.referenceRate ?? 0;
  const live = liveWaxPerCheese && liveWaxPerCheese > 0 ? liveWaxPerCheese : 0;
  if (!live && !reference) return null;
  if (!live) return { rate: reference, live: false, stale: false };
  if (!reference) return { rate: live, live: true, stale: false };

  const maxDeviation = config?.maxDeviationPct ?? 0;
  const deviationPct = Math.abs((live - reference) / reference) * 100;
  if (maxDeviation > 0 && deviationPct > maxDeviation) {
    return { rate: reference, live: false, stale: true };
  }
  return { rate: live, live: true, stale: false };
}

/** Estimated bytes received for a CHEESE spend. Display only — the contract is authoritative. */
export function estimateBytesForCheese(
  cheese: number,
  config: CheeseRamConfig | null | undefined,
  pricePerByte: number | null | undefined,
  waxPerCheese: number | null | undefined,
): { waxValue: number; bytes: number } | null {
  if (!cheese || cheese <= 0 || !waxPerCheese || !config || !pricePerByte) return null;
  const waxValue = cheese * waxPerCheese * (1 - config.buySpreadBps / 10000);
  const bytes = Math.floor((waxValue * (1 - RAM_FEE_RATE)) / pricePerByte);
  return { waxValue, bytes };
}

/**
 * Inverse of estimateBytesForCheese — the CHEESE needed to buy a target byte
 * amount. Display only; the contract calculates the final amount at execution.
 */
export function estimateCheeseForTargetBytes(
  bytes: number,
  config: CheeseRamConfig | null | undefined,
  pricePerByte: number | null | undefined,
  waxPerCheese: number | null | undefined,
): { waxValue: number; cheese: number } | null {
  if (!bytes || bytes <= 0 || !waxPerCheese || !config || !pricePerByte) return null;
  const waxValue = (bytes * pricePerByte) / (1 - RAM_FEE_RATE);
  const cheese = waxValue / (waxPerCheese * (1 - config.buySpreadBps / 10000));
  if (!Number.isFinite(cheese) || cheese <= 0) return null;
  return { waxValue, cheese };
}

/** Estimated CHEESE payout for selling bytes back to the contract. */
export function estimateCheeseForBytes(
  bytes: number,
  config: CheeseRamConfig | null | undefined,
  pricePerByte: number | null | undefined,
  waxPerCheese: number | null | undefined,
): { waxValue: number; cheese: number } | null {
  if (!bytes || bytes <= 0 || !waxPerCheese || !config || !pricePerByte) return null;
  const waxValue = bytes * pricePerByte;
  const cheese =
    (waxValue / waxPerCheese) *
    (1 - config.sellHaircutBps / 10000) *
    (1 - config.sellSpreadBps / 10000);
  return { waxValue, cheese };
}

// ---------------------------------------------------------------------------
// Post-hoc confirmation
//
// A signed transaction can land on-chain while the frontend loses the reply
// (typically a Fuel/RPC timeout). Rather than telling the user it failed, we
// look the action up in the history indexer before letting them retry.
// ---------------------------------------------------------------------------

const HYPERION_ENDPOINTS = [
  'https://wax.eosusa.io',
  'https://wax.hivebp.io',
  'https://api.waxsweden.org',
  'https://wax.greymass.com',
];

export interface RecentActionMatch {
  txId: string;
  timestamp: number;
}

async function fetchRecentActions(
  account: string,
  filter: string,
  afterMs: number,
): Promise<Array<{ trx_id: string; timestamp: string; act: { data: Record<string, any> } }>> {
  const query =
    `/v2/history/get_actions?account=${encodeURIComponent(account)}` +
    `&filter=${encodeURIComponent(filter)}&limit=20&sort=desc` +
    `&after=${new Date(afterMs).toISOString()}`;
  const response = await fetchWithFallback(HYPERION_ENDPOINTS, query, { method: 'GET' });
  const data = await response.json();
  return Array.isArray(data?.actions) ? data.actions : [];
}

/**
 * Look for a recent CHEESE transfer from `account` to the CHEESERam contract.
 * Used to confirm a buy whose broadcast reply was lost.
 */
export async function findRecentBuy(
  account: string,
  cheeseAmount: number,
  sinceMs: number,
): Promise<RecentActionMatch | null> {
  try {
    const actions = await fetchRecentActions(
      account,
      `${CHEESE_TOKEN_CONTRACT}:transfer`,
      sinceMs - 60_000,
    );
    const target = Number(cheeseAmount.toFixed(4));
    for (const action of actions) {
      const data = action.act?.data ?? {};
      if (String(data.from) !== account) continue;
      if (String(data.to) !== CHEESE_RAM_CONTRACT) continue;
      const quantity = parseAsset(data.quantity);
      if (Math.abs(quantity - target) > 0.00005) continue;
      const ts = Date.parse(`${action.timestamp}Z`.replace(/Z+$/, 'Z'));
      if (Number.isFinite(ts) && ts < sinceMs - 120_000) continue;
      return { txId: action.trx_id, timestamp: ts };
    }
    return null;
  } catch (error) {
    console.error('[CHEESERam] findRecentBuy failed:', error);
    return null;
  }
}

/**
 * Look for a recent RAM transfer of `bytes` from `account` to the CHEESERam
 * contract (a sell), to confirm a sale whose broadcast reply was lost.
 */
export async function findRecentSell(
  account: string,
  bytes: number,
  sinceMs: number,
): Promise<RecentActionMatch | null> {
  try {
    const actions = await fetchRecentActions(account, 'eosio:ramtransfer', sinceMs - 60_000);
    for (const action of actions) {
      const data = action.act?.data ?? {};
      if (String(data.from) !== account) continue;
      if (String(data.to) !== CHEESE_RAM_CONTRACT) continue;
      if (Number(data.bytes) !== bytes) continue;
      const ts = Date.parse(`${action.timestamp}Z`.replace(/Z+$/, 'Z'));
      if (Number.isFinite(ts) && ts < sinceMs - 120_000) continue;
      return { txId: action.trx_id, timestamp: ts };
    }
    return null;
  } catch (error) {
    console.error('[CHEESERam] findRecentSell failed:', error);
    return null;
  }
}

/** Look for a recent `claimvotes` action on the CHEESERam contract. */
export async function findRecentVoteClaim(sinceMs: number): Promise<RecentActionMatch | null> {
  try {
    const actions = await fetchRecentActions(
      CHEESE_RAM_CONTRACT,
      `${CHEESE_RAM_CONTRACT}:claimvotes`,
      sinceMs - 60_000,
    );
    const action = actions[0];
    if (!action) return null;
    const ts = Date.parse(`${action.timestamp}Z`.replace(/Z+$/, 'Z'));
    if (Number.isFinite(ts) && ts < sinceMs - 120_000) return null;
    return { txId: action.trx_id, timestamp: ts };
  } catch (error) {
    console.error('[CHEESERam] findRecentVoteClaim failed:', error);
    return null;
  }
}

/**
 * Poll a lookup a few times over ~15s, since history indexers lag the chain by
 * a second or two.
 */
export async function pollForConfirmation(
  lookup: () => Promise<RecentActionMatch | null>,
  attempts = 5,
  delayMs = 3000,
): Promise<RecentActionMatch | null> {
  for (let i = 0; i < attempts; i += 1) {
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    const match = await lookup();
    if (match) return match;
  }
  return null;
}
