// WAX Token Registry - All tokens supported by NFTHive drops
// Based on nfthivedrops contract supported tokens

export interface TokenConfig {
  symbol: string;
  contract: string;
  precision: number;
  displayName: string;
  logo?: string;
}

// Token registry with all supported WAX tokens from NFTHive
export const WAX_TOKENS: TokenConfig[] = [
  { symbol: 'WAX', contract: 'eosio.token', precision: 8, displayName: 'WAX' },
  { symbol: 'CHEESE', contract: 'cheeseburger', precision: 4, displayName: 'CHEESE' },
  { symbol: 'AQUA', contract: 'aquascapeart', precision: 8, displayName: 'AQUA' },
  { symbol: 'HONEY', contract: 'nfthivehoney', precision: 4, displayName: 'HONEY' },
  { symbol: 'AETHER', contract: 'aabormarket', precision: 8, displayName: 'AETHER' },
  { symbol: 'KCHAT', contract: 'kitechatmvp1', precision: 4, displayName: 'KCHAT' },
  { symbol: 'KPOINT', contract: 'kitechatmvp1', precision: 4, displayName: 'KPOINT' },
  { symbol: 'SSN', contract: 'wax.gg', precision: 4, displayName: 'SSN' },
  { symbol: 'NEFTY', contract: 'token.nefty', precision: 8, displayName: 'NEFTY' },
  { symbol: 'TLM', contract: 'alien.worlds', precision: 4, displayName: 'TLM' },
  { symbol: 'DUST', contract: 'nftmintt.wax', precision: 4, displayName: 'DUST' },
  { symbol: 'LSWAX', contract: 'token.fusion', precision: 8, displayName: 'LSWAX' },
  { symbol: 'BRWL', contract: 'brawlertokns', precision: 4, displayName: 'BRWL' },
  { symbol: 'CROWN', contract: 'crownedtokns', precision: 4, displayName: 'CROWN' },
  { symbol: 'MARTIA', contract: 'martia', precision: 4, displayName: 'MARTIA' },
  { symbol: 'WUFFI', contract: 'wuffi', precision: 8, displayName: 'WUFFI' },
  { symbol: 'WUF', contract: 'wuftoken1111', precision: 8, displayName: 'WUF' },
  { symbol: 'KEK', contract: 'waxpepetoken', precision: 4, displayName: 'KEK' },
  { symbol: 'LSW', contract: 'lsw.alcor', precision: 8, displayName: 'LSW' },
  { symbol: 'ROOK', contract: 'pixilminirpg', precision: 8, displayName: 'ROOK' },
  { symbol: 'BUZZ', contract: 'buzzingarden', precision: 4, displayName: 'BUZZ' },
  { symbol: 'LEEF', contract: 'leefmaincorp', precision: 4, displayName: 'LEEF' },
  { symbol: 'WAXDAO', contract: 'token.waxdao', precision: 8, displayName: 'WAXDAO' },
  { symbol: 'RUGG', contract: 'rareruggapes', precision: 4, displayName: 'RUGG' },
  // Wrapped tokens via eth.token bridge
  { symbol: 'WAXWBTC', contract: 'eth.token', precision: 8, displayName: 'WAXWBTC' },
  { symbol: 'WAXWETH', contract: 'eth.token', precision: 8, displayName: 'WAXWETH' },
  { symbol: 'WAXUSDC', contract: 'eth.token', precision: 6, displayName: 'WAXUSDC' },
  { symbol: 'WAXUSDT', contract: 'eth.token', precision: 6, displayName: 'WAXUSDT' },
];

// Get token config by symbol
export function getTokenConfig(symbol: string): TokenConfig | undefined {
  return WAX_TOKENS.find(t => t.symbol === symbol);
}

// Format a price amount for a given token symbol
export function formatTokenAmount(amount: number, symbol: string): string {
  const token = getTokenConfig(symbol);
  if (!token) {
    throw new Error(`Unknown token: ${symbol}`);
  }
  return `${amount.toFixed(token.precision)} ${symbol}`;
}

// Get settlement symbol format (precision,SYMBOL)
export function getSettlementSymbol(symbol: string): string {
  const token = getTokenConfig(symbol);
  if (!token) {
    throw new Error(`Unknown token: ${symbol}`);
  }
  return `${token.precision},${symbol}`;
}

// Parse a listing price string into amount and symbol
export function parseListingPrice(listingPrice: string): { amount: number; symbol: string } | null {
  const match = listingPrice.match(/^([\d.]+)\s+(\w+)$/);
  if (!match) return null;
  return {
    amount: parseFloat(match[1]),
    symbol: match[2],
  };
}

// Get default token (CHEESE)
export function getDefaultToken(): TokenConfig {
  return WAX_TOKENS.find(t => t.symbol === 'CHEESE')!;
}
