// Token logo URL utilities using Alcor Exchange's token logo repository

const ALCOR_LOGO_BASE = 'https://cdn.jsdelivr.net/gh/alcorexchange/alcor-ui@master/assets/tokens/wax';
const ALCOR_TOKENS_API = 'https://wax.alcor.exchange/api/v2/tokens';

// Cache for token contracts fetched from Alcor API
let tokenContractCache: Map<string, string> = new Map();
let cacheInitialized = false;
let cachePromise: Promise<void> | null = null;

/**
 * Fetch all token contracts from Alcor API and cache them
 * This eliminates the need for manual contract mapping
 */
async function initializeTokenCache(): Promise<void> {
  if (cacheInitialized) return;

  // If already fetching, wait for that promise
  if (cachePromise) {
    await cachePromise;
    return;
  }

  cachePromise = (async () => {
    try {
      const response = await fetch(ALCOR_TOKENS_API);
      if (!response.ok) {
        console.warn('Failed to fetch Alcor tokens, using fallback map');
        useFallbackMap();
        return;
      }

      const tokens = await response.json();

      // Build cache from API response
      // Alcor tokens API returns array of { id, contract, symbol, ... }
      if (Array.isArray(tokens)) {
        tokens.forEach((token: { symbol?: string; contract?: string }) => {
          if (token.symbol && token.contract) {
            const key = token.symbol.toUpperCase();
            // Only set if not already set (first occurrence wins, usually the main one)
            if (!tokenContractCache.has(key)) {
              tokenContractCache.set(key, token.contract);
            }
          }
        });
      }

      cacheInitialized = true;
    } catch (error) {
      console.warn('Error fetching Alcor tokens:', error);
      useFallbackMap();
    }
  })();

  await cachePromise;
}

// Fallback mapping for common tokens if API fails
function useFallbackMap() {
  const fallbackMap: Record<string, string> = {
    'WAX': 'eosio.token',
    'CHEESE': 'cheeseburger',
    'WAXUSDC': 'alien.worlds',
    'TLM': 'alien.worlds',
    'NEFTY': 'token.nefty',
    'WAXP': 'eosio.token',
    'AETHER': 'e.rplanet',
    'CAPT': 'capt.token',
    'DUST': 'usdt.alcor',
    'LSWAX': 'lswax.wax',
    'SSWAX': 'sswax.wax',
    'WUF': 'wuftoken.gm',
    'GUILD': 'guild.token',
    'CMX': 'cmx.market',
    'BRWL': 'brwl.wax',
  };

  Object.entries(fallbackMap).forEach(([symbol, contract]) => {
    tokenContractCache.set(symbol, contract);
  });

  cacheInitialized = true;
}

/**
 * Get the contract address for a token symbol
 */
export function getTokenContract(symbol: string): string | undefined {
  return tokenContractCache.get(symbol.toUpperCase());
}

/**
 * Get the logo URL for a token using Alcor's logo repository
 * Uses format: {contract}/{symbol_lowercase}.png
 * 
 * @param contractOrSymbol - Token contract (if both params given) or symbol (if only one param)
 * @param symbol - Token symbol (optional, if not given first param is treated as symbol)
 */
export function getTokenLogoUrl(contractOrSymbol: string, symbol?: string): string {
  let tokenContract: string | undefined;
  let lowerSymbol: string;

  if (symbol) {
    // Called as getTokenLogoUrl(contract, symbol)
    tokenContract = contractOrSymbol;
    lowerSymbol = symbol.toLowerCase();
  } else {
    // Called as getTokenLogoUrl(symbol) - lookup contract from cache
    lowerSymbol = contractOrSymbol.toLowerCase();
    tokenContract = getTokenContract(contractOrSymbol.toUpperCase());
  }

  if (!tokenContract) {
    return '/placeholder.svg';
  }

  return `${ALCOR_LOGO_BASE}/${tokenContract}/${lowerSymbol}.png`;
}

/**
 * Ensure token cache is loaded - call this early in app lifecycle
 */
export function ensureTokenCacheLoaded(): Promise<void> {
  return initializeTokenCache();
}

/**
 * Check if a token is in the cache
 */
export function isTokenKnown(symbol: string): boolean {
  return tokenContractCache.has(symbol.toUpperCase());
}

/**
 * Get all cached tokens
 */
export function getAllCachedTokens(): Map<string, string> {
  return new Map(tokenContractCache);
}
