// CHEESEDao proposal fee tokens and token precision lookup.
// Import from "@/lib/dao" (stable entry point), not this file directly.

// Tokens supported as proposal submission fees in the UI.
// The smart contract accepts any asset, but we expose a curated list.
export interface ProposalFeeToken {
  symbol: string;
  contract: string;
  precision: number;
}
export const PROPOSAL_FEE_TOKENS: ProposalFeeToken[] = [
  { symbol: "WAX", contract: "eosio.token", precision: 8 },
  { symbol: "CHEESE", contract: "cheeseburger", precision: 4 },
  { symbol: "WAXDAO", contract: "token.waxdao", precision: 8 },
];

export function findProposalFeeToken(symbol: string): ProposalFeeToken | undefined {
  return PROPOSAL_FEE_TOKENS.find(t => t.symbol === symbol);
}

// Persistent local cache of (symbol -> contract) discovered during DAO creation/edit,
// so proposers can auto-resolve custom tokens picked by the DAO creator.
const FEE_TOKEN_CACHE_KEY = "cheesehub:dao:feeTokenCache";
export function rememberFeeToken(symbol: string, contract: string, precision: number) {
  try {
    const raw = localStorage.getItem(FEE_TOKEN_CACHE_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[symbol] = { contract, precision };
    localStorage.setItem(FEE_TOKEN_CACHE_KEY, JSON.stringify(map));
  } catch { /* noop */ }
}
export function getCachedFeeToken(symbol: string): { contract: string; precision: number } | null {
  try {
    const raw = localStorage.getItem(FEE_TOKEN_CACHE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw);
    return map[symbol] ?? null;
  } catch { return null; }
}

/**
 * Resolve a token's precision by calling get_currency_stats.
 * Returns null if the contract/symbol does not exist.
 */
export async function resolveTokenStats(contract: string, symbol: string): Promise<{ precision: number } | null> {
  const { waxRpcCall } = await import("@/lib/waxRpcFallback");
  try {
    const data = await waxRpcCall<Record<string, { supply?: string }>>(
      "/v1/chain/get_currency_stats",
      { code: contract, symbol },
      6000,
    );
    const entry = data?.[symbol];
    if (!entry?.supply) return null;
    const supply = entry.supply.split(" ")[0] || "";
    const precision = supply.includes(".") ? supply.split(".")[1].length : 0;
    return { precision };
  } catch {
    return null;
  }
}
