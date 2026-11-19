// Pure parsing helpers for Alcor asset strings and pool slots.
import type { PoolSlot } from '../alcorV3Amounts';

// Parse WAX asset string (e.g., "123.45678901 WAX")
export function parseAsset(assetStr: string): { amount: number; symbol: string; precision: number } {
  if (!assetStr) return { amount: 0, symbol: '', precision: 0 };
  const parts = assetStr.trim().split(' ');
  const amount = parseFloat(parts[0]) || 0;
  const symbol = parts[1] || '';
  const decimalParts = parts[0].split('.');
  const precision = decimalParts[1]?.length || 0;
  return { amount, symbol, precision };
}

// Parse WAX asset string to get precision
export function getAssetPrecision(assetStr: string): number {
  if (!assetStr) return 8;
  const parts = assetStr.trim().split(' ');
  const decimalParts = parts[0].split('.');
  return decimalParts[1]?.length || 0;
}

/** Pull a slot out of either the API shape (flat) or the chain shape (currSlot). */
export function slotFromPool(pool: any): PoolSlot | null {
  if (!pool) return null;
  const sqrtPriceX64 = String(pool.sqrtPriceX64 ?? pool.currSlot?.sqrtPriceX64 ?? '');
  const tick = Number(pool.tick ?? pool.currSlot?.tick);
  if (!sqrtPriceX64 || sqrtPriceX64 === '0' || !Number.isFinite(tick)) return null;

  const tokenRef = (token: any) => {
    if (!token) return undefined;
    const symbol = token.symbol || parseAsset(token.quantity || '').symbol;
    if (!symbol) return undefined;
    return { contract: token.contract || '', symbol };
  };

  return {
    sqrtPriceX64,
    tick,
    tokenA: tokenRef(pool.tokenA),
    tokenB: tokenRef(pool.tokenB),
  };
}
