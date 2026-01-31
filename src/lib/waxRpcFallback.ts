// WAX RPC API fallback utility for reliability
// Automatically retries requests across multiple endpoints

// Hyperion endpoints for get_tokens (faster for balance queries)
const HYPERION_ENDPOINTS = [
  "https://wax.eosusa.io",
  "https://api.wax.alohaeos.com",
  "https://wax.eosphere.io",
  "https://wax.pink.gg",
];

export const WAX_RPC_ENDPOINTS = [
  "https://wax.eosusa.io",
  "https://api.wax.alohaeos.com",
  "https://wax.eosphere.io",
  "https://wax.pink.gg",
  "https://api.waxsweden.org",
  "https://wax.greymass.com",
];

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
 * Fetch table rows from WAX blockchain with automatic endpoint fallback
 */
export async function fetchTableRows<T = Record<string, unknown>>(
  params: TableRowsParams,
  timeout: number = 8000
): Promise<TableRowsResponse<T>> {
  let lastError: Error | null = null;

  for (const baseUrl of WAX_RPC_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(`${baseUrl}/v1/chain/get_table_rows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          json: true,
          ...params,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        return data as TableRowsResponse<T>;
      }

      console.warn(`WAX endpoint ${baseUrl} returned ${response.status}, trying next...`);
    } catch (error) {
      lastError = error as Error;
      console.warn(`WAX endpoint ${baseUrl} failed:`, (error as Error).message);
    }
  }

  throw lastError || new Error("All WAX RPC endpoints failed");
}

/**
 * Generic WAX RPC call with fallback
 * For get_currency_balance, a 400 error means the contract doesn't exist - return empty array
 */
export async function waxRpcCall<T = unknown>(
  path: string,
  body: Record<string, unknown>,
  timeout: number = 8000
): Promise<T> {
  let lastError: Error | null = null;

  for (const baseUrl of WAX_RPC_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return (await response.json()) as T;
      }

      // For get_currency_balance, 400/500 with account_query_exception means contract doesn't exist
      // Return empty array instead of retrying - this is a valid response
      if (path === '/v1/chain/get_currency_balance' && (response.status === 400 || response.status === 500)) {
        return [] as T;
      }

      console.warn(`WAX endpoint ${baseUrl} returned ${response.status}, trying next...`);
    } catch (error) {
      lastError = error as Error;
      console.warn(`WAX endpoint ${baseUrl} failed:`, (error as Error).message);
    }
  }

  throw lastError || new Error("All WAX RPC endpoints failed");
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

// Stale threshold: 5 minutes
const STALE_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * Fetch ALL token balances for an account using Hyperion API
 * Returns staleness info so caller can decide to use RPC fallback
 */
export async function fetchAllTokenBalances(
  account: string,
  timeout: number = 8000
): Promise<HyperionResult> {
  let lastError: Error | null = null;

  for (const baseUrl of HYPERION_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(
        `${baseUrl}/v2/state/get_tokens?account=${account}`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = (await response.json()) as HyperionTokensResponse;
        const tokens = data.tokens || [];

        // Parse last indexed time and check staleness
        const lastIndexedTime = data.last_indexed_block_time
          ? new Date(data.last_indexed_block_time)
          : null;

        const isStale = lastIndexedTime
          ? (Date.now() - lastIndexedTime.getTime()) > STALE_THRESHOLD_MS
          : false;

        const ageMinutes = lastIndexedTime
          ? Math.round((Date.now() - lastIndexedTime.getTime()) / 60000)
          : 'unknown';

        console.log(`[Hyperion] Got ${tokens.length} tokens from ${baseUrl} (indexed ${ageMinutes} min ago, stale: ${isStale})`);

        return { tokens, lastIndexedTime, isStale };
      }

      console.warn(`Hyperion endpoint ${baseUrl} returned ${response.status}, trying next...`);
    } catch (error) {
      lastError = error as Error;
      console.warn(`Hyperion endpoint ${baseUrl} failed:`, (error as Error).message);
    }
  }

  throw lastError || new Error("All Hyperion endpoints failed");
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
