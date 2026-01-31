// WAX blockchain utilities
// Note: Wallet login/logout is handled by WharfKit in WaxContext.tsx
// This file provides utility functions for direct RPC calls

import { logger } from "./logger";

// WaxDAO contract
export const WAXDAO_CONTRACT = "waxdaolocker";

// Fetch table data from WAX blockchain with fallback endpoints and timeout
export async function fetchTable<T>(
  code: string,
  scope: string,
  table: string,
  options: {
    lower_bound?: string;
    upper_bound?: string;
    limit?: number;
    key_type?: string;
    index_position?: number;
  } = {}
): Promise<T[]> {
  const endpoints = [
    'https://api.wax.alohaeos.com',
    'https://wax.greymass.com',
    'https://wax.eosphere.io',
    'https://api.waxsweden.org',
  ];

  const body = JSON.stringify({
    json: true,
    code,
    scope,
    table,
    lower_bound: options.lower_bound || "",
    upper_bound: options.upper_bound || "",
    limit: options.limit || 100,
    key_type: options.key_type || "",
    index_position: options.index_position || 1,
  });

  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(`${endpoint}/v1/chain/get_table_rows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return data.rows as T[];
    } catch (error) {
      logger.warn(`fetchTable failed for ${endpoint}:`, error);
      continue;
    }
  }

  throw new Error('All RPC endpoints failed');
}

// Get user's token balances
export async function getTokenBalances(account: string): Promise<{ symbol: string; amount: string; contract: string }[]> {
  try {
    const response = await fetch(
      `https://wax.eosphere.io/v2/state/get_tokens?account=${account}`
    );
    const data = await response.json();
    return data.tokens?.map((t: any) => ({
      symbol: t.symbol,
      amount: String(t.amount),
      contract: t.contract,
    })) || [];
  } catch (error) {
    logger.error("Failed to fetch token balances:", error);
    return [];
  }
}
