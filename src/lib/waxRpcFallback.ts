// WAX RPC API fallback utility for reliability
// Automatically retries requests across multiple endpoints.
//
// The order is decided at read time by src/lib/endpointHealth.ts (HerdCheck),
// so a node that is currently down is never queued ahead of a healthy one.
// The lists below are the offline fallback order.

import { STATIC_ENDPOINTS } from "./endpointHealth";
import { hedgedJson } from "./chainRequest";

// Hyperion endpoints for get_tokens (faster for balance queries)
const HYPERION_ENDPOINTS = STATIC_ENDPOINTS["hyperion-v2"];

export const WAX_RPC_ENDPOINTS = STATIC_ENDPOINTS["chain-api"];

interface TableRowsParams {
  json?: boolean;
  code: string;
  scope: string;
  table: string;
  limit?: number;
  lower_bound?: string;
  upper_bound?: string;
  index_position?: number;
  key_type?: string;
  reverse?: boolean;
}

interface TableRowsResponse<T = Record<string, unknown>> {
  rows: T[];
  more: boolean;
  next_key?: string;
}

/**
 * Fetch table rows from WAX blockchain. Hedged across hosts, so a silent node
 * costs a couple of seconds instead of the whole read.
 */
export async function fetchTableRows<T = Record<string, unknown>>(
  params: TableRowsParams,
  timeout: number = 9000
): Promise<TableRowsResponse<T>> {
  const { data } = await hedgedJson<TableRowsResponse<T>>("/v1/chain/get_table_rows", {
    feature: "chain-api",
    fallback: WAX_RPC_ENDPOINTS,
    body: { json: true, ...params },
    timeoutMs: timeout,
  });
  return data;
}

/**
 * Generic WAX RPC call.
 * For get_currency_balance, a 400/500 means the contract doesn't exist — that is
 * a valid "no balance" answer, not a reason to try another host.
 */
export async function waxRpcCall<T = unknown>(
  path: string,
  body: Record<string, unknown>,
  timeout: number = 9000
): Promise<T> {
  const { data } = await hedgedJson<T>(path, {
    feature: "chain-api",
    fallback: WAX_RPC_ENDPOINTS,
    body,
    timeoutMs: timeout,
    onStatus: (status) =>
      path === "/v1/chain/get_currency_balance" && (status === 400 || status === 500)
        ? { value: [] as unknown as T }
        : undefined,
  });
  return data;
}

// Hyperion API types
export interface HyperionToken {
  symbol: string;
  amount: number;
  contract: string;
  precision?: number;
}

interface HyperionTokensResponse {
  account: string;
  tokens: HyperionToken[];
  last_indexed_block?: number;
  last_indexed_block_time?: string;
}

export interface HyperionResult {
  tokens: HyperionToken[];
  lastIndexedTime: Date | null;
  isStale: boolean;
}

// Stale threshold: 60 minutes — Hyperion indexers commonly lag a few minutes,
// which is fine for balance display. Only truly stale data should trigger RPC fallback.
const STALE_THRESHOLD_MS = 60 * 60 * 1000;

/**
 * Fetch ALL token balances for an account using Hyperion API
 * Returns staleness info so caller can decide to use RPC fallback
 */
export async function fetchAllTokenBalances(
  account: string,
  timeout: number = 9000
): Promise<HyperionResult> {
  const { data, host } = await hedgedJson<HyperionTokensResponse>(
    `/v2/state/get_tokens?account=${account}`,
    {
      feature: "hyperion-v2",
      fallback: HYPERION_ENDPOINTS,
      method: "GET",
      timeoutMs: timeout,
    }
  );

  const tokens = data.tokens || [];

  const lastIndexedTime = data.last_indexed_block_time
    ? new Date(data.last_indexed_block_time)
    : null;

  const isStale = lastIndexedTime
    ? (Date.now() - lastIndexedTime.getTime()) > STALE_THRESHOLD_MS
    : false;

  const ageMinutes = lastIndexedTime
    ? Math.round((Date.now() - lastIndexedTime.getTime()) / 60000)
    : 'unknown';

  console.log(`[Hyperion] Got ${tokens.length} tokens from ${host} (indexed ${ageMinutes} min ago, stale: ${isStale})`);

  return { tokens, lastIndexedTime, isStale };
}

/**
 * Fetch a single token balance using get_currency_balance
 * Used as fallback for critical tokens that may be missing from Hyperion
 */
export async function fetchSingleTokenBalance(
  account: string,
  contract: string,
  symbol: string,
  timeout: number = 5000
): Promise<number> {
  try {
    const balances = await waxRpcCall<string[]>(
      '/v1/chain/get_currency_balance',
      { code: contract, account, symbol },
      timeout
    );

    console.log(`[RPC] ${symbol}@${contract} response:`, balances);

    if (balances && balances.length > 0) {
      // Parse "123.45678900 CHEESE" format
      const parts = balances[0].split(' ');
      const amount = parseFloat(parts[0]) || 0;
      return amount;
    }
  } catch (error) {
    console.warn(`[RPC] Failed to fetch ${symbol} balance:`, error);
  }
  return 0;
}

/**
 * Fetch ALL token balances via direct RPC calls (bypasses Hyperion indexer)
 * Used as fallback when Hyperion is unavailable or stale
 * Batches requests to avoid rate limiting, with retry logic for failed tokens
 */
export async function fetchAllTokenBalancesViaRpc(
  account: string,
  tokens: Array<{ contract: string; symbol: string; precision?: number }>
): Promise<Map<string, { balance: number; precision: number }>> {
  console.log(`[RPC Fallback] Fetching ${tokens.length} token balances via direct RPC (batched)...`);

  const BATCH_SIZE = 10;
  const BATCH_DELAY_MS = 200;
  const TIMEOUT_MS = 5000;

  const balanceMap = new Map<string, { balance: number; precision: number }>();
  const failedTokens: Array<{ contract: string; symbol: string; precision?: number }> = [];
  let successCount = 0;

  // Process tokens in batches to avoid rate limiting
  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batch = tokens.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(async ({ contract, symbol, precision }) => {
        const balance = await fetchSingleTokenBalance(account, contract, symbol, TIMEOUT_MS);
        return {
          key: `${contract}:${symbol}`,
          balance,
          precision: precision || 8,
          contract,
          symbol
        };
      })
    );

    results.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        successCount++;
        if (result.value.balance > 0) {
          balanceMap.set(result.value.key, {
            balance: result.value.balance,
            precision: result.value.precision
          });
        }
      } else {
        // Track failed tokens for retry
        failedTokens.push(batch[idx]);
      }
    });

    // Small delay between batches to avoid rate limits
    if (i + BATCH_SIZE < tokens.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  // Retry failed tokens once with longer timeout
  if (failedTokens.length > 0) {
    console.log(`[RPC Fallback] Retrying ${failedTokens.length} failed tokens...`);

    for (let i = 0; i < failedTokens.length; i += BATCH_SIZE) {
      const batch = failedTokens.slice(i, i + BATCH_SIZE);

      const retryResults = await Promise.allSettled(
        batch.map(async ({ contract, symbol, precision }) => {
          const balance = await fetchSingleTokenBalance(account, contract, symbol, TIMEOUT_MS * 2);
          return {
            key: `${contract}:${symbol}`,
            balance,
            precision: precision || 8
          };
        })
      );

      retryResults.forEach(result => {
        if (result.status === 'fulfilled') {
          successCount++;
          if (result.value.balance > 0) {
            balanceMap.set(result.value.key, {
              balance: result.value.balance,
              precision: result.value.precision
            });
          }
        }
      });

      if (i + BATCH_SIZE < failedTokens.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }
  }

  console.log(`[RPC Fallback] Complete: ${successCount}/${tokens.length} succeeded, ${balanceMap.size} tokens with balance`);
  return balanceMap;
}
