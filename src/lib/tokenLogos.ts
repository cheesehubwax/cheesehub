// Token logo URL utilities using Alcor Exchange's token logo repository

const ALCOR_LOGO_BASE = 'https://wax.alcor.exchange/api/v2/tokens';

// Cache for token contracts fetched from Alcor API
let tokenContractCache: Map<string, string> = new Map();
let cacheInitialized = false;

/**
 * Populate the token cache from pre-fetched data (e.g. from the shared swap-tokens query).
 * This avoids a separate fetch to /api/v2/tokens.
 */
export function initializeTokenCacheFromData(tokens: Array<{ symbol?: string; contract?: string }>) {
  if (cacheInitialized && tokenContractCache.size > 0) return;

  tokens.forEach((token) => {
    if (token.symbol && token.contract) {
      const key = token.symbol.toUpperCase();
      if (!tokenContractCache.has(key)) {
        tokenContractCache.set(key, token.contract);
      }
    }
  });

  cacheInitialized = true;
}

/**
 * Initialize token cache — uses only the fallback map (no Alcor API call).
 * The shared swap-tokens query populates the full cache via initializeTokenCacheFromData.
 */
async function initializeTokenCache(): Promise<void> {
  if (cacheInitialized) return;
  useFallbackMap();
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
 */
export function getTokenLogoUrl(contractOrSymbol: string, symbol?: string): string {
  let tokenContract: string | undefined;
  let lowerSymbol: string;

  if (symbol) {
    tokenContract = contractOrSymbol;
    lowerSymbol = symbol.toLowerCase();
  } else {
    lowerSymbol = contractOrSymbol.toLowerCase();
    tokenContract = getTokenContract(contractOrSymbol.toUpperCase());
  }

  if (!tokenContract) {
    return '/placeholder.svg';
  }

  return `${ALCOR_LOGO_BASE}/${lowerSymbol}-${tokenContract}/logo`;
}

/**
 * Ensure token cache is loaded - fallback only, prefer initializeTokenCacheFromData
 */
export function ensureTokenCacheLoaded(): Promise<void> {
  return initializeTokenCache();
}

export function isTokenKnown(symbol: string): boolean {
  return tokenContractCache.has(symbol.toUpperCase());
}

export function getAllCachedTokens(): Map<string, string> {
  return new Map(tokenContractCache);
}
