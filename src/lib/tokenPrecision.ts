import { waxRpcCall } from "@/lib/waxRpcFallback";
import { getTokenConfig } from "@/lib/tokenRegistry";

// Cache of resolved precisions, keyed by contract:SYMBOL
const precisionCache = new Map<string, number>();
const inFlight = new Map<string, Promise<number>>();

function cacheKey(contract: string, symbol: string) {
  return `${contract}:${symbol.toUpperCase()}`;
}

// Count decimals in an asset string like "100.00000000 WAX" or a plain number string
export function decimalsInAmountString(amount: string | undefined): number {
  if (!amount) return 0;
  const numeric = amount.trim().split(" ")[0] || "";
  const decimals = numeric.split(".")[1];
  return decimals ? decimals.length : 0;
}

interface CurrencyStatsRow {
  supply?: string;
  max_supply?: string;
  issuer?: string;
}

// Read the token's true precision from the chain (get_currency_stats).
// Falls back to the local token registry, then to the digits present in the
// provided balance string, then to 4 (the most common WAX default).
export async function getTokenPrecision(
  contract: string,
  symbol: string,
  balanceFallback?: string
): Promise<number> {
  const key = cacheKey(contract, symbol);
  const cached = precisionCache.get(key);
  if (cached !== undefined) return cached;

  const pending = inFlight.get(key);
  if (pending) return pending;

  const request = (async () => {
    try {
      const stats = await waxRpcCall<Record<string, CurrencyStatsRow>>(
        "/v1/chain/get_currency_stats",
        { code: contract, symbol: symbol.toUpperCase() }
      );
      const row = stats?.[symbol.toUpperCase()] ?? Object.values(stats || {})[0];
      const asset = row?.max_supply || row?.supply;
      if (asset) {
        const precision = decimalsInAmountString(asset);
        precisionCache.set(key, precision);
        return precision;
      }
    } catch (error) {
      console.warn(`Could not read precision for ${key} from chain:`, error);
    }

    const registry = getTokenConfig(symbol.toUpperCase());
    if (registry && registry.contract === contract) {
      return registry.precision;
    }
    if (registry) return registry.precision;

    const fromBalance = decimalsInAmountString(balanceFallback);
    if (fromBalance > 0) return fromBalance;

    return 4;
  })().finally(() => {
    inFlight.delete(key);
  });

  inFlight.set(key, request);
  return request;
}

// Format a user-entered amount to an exact asset string, always rounding DOWN
// so the result can never exceed what the user actually holds.
export function formatAssetAmount(input: string | number, precision: number, symbol: string): string {
  const value = typeof input === "number" ? input : parseFloat(input);
  if (!isFinite(value) || value <= 0) return `${(0).toFixed(precision)} ${symbol}`;
  return `${floorToPrecision(value, precision).toFixed(precision)} ${symbol}`;
}

// Floor a number to a given number of decimals without float drift.
export function floorToPrecision(value: number, precision: number): number {
  if (!isFinite(value)) return 0;
  const factor = Math.pow(10, precision);
  // Nudge by a tiny epsilon so values like 1.0000000000000002 don't floor down a step
  return Math.floor(value * factor + 1e-9) / factor;
}

// Pad a displayed balance to the resolved precision (display only)
export function padAmountDisplay(amount: string, precision: number): string {
  const value = parseFloat(amount);
  if (!isFinite(value)) return amount;
  return value.toFixed(precision);
}
