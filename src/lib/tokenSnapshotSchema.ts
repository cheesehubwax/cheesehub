/** Public metadata only: snapshots must never masquerade as live prices. */
export interface SnapshotToken {
  contract: string;
  symbol: string;
  precision: number;
  name: string;
  logo: string;
}

export interface TokenSnapshot {
  version: 1;
  updatedAt: string;
  verification: 'eosio.get_currency_stats';
  tokens: SnapshotToken[];
}

export function parseTokenMetadata(value: unknown): SnapshotToken[] {
  if (!Array.isArray(value)) return [];
  const out = new Map<string, SnapshotToken>();
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const t = item as Record<string, unknown>;
    const precision = t.precision ?? t.decimals;
    if (t.is_scam === true || typeof t.contract !== 'string' || !/^[a-z1-5.]{1,12}$/.test(t.contract)
      || typeof t.symbol !== 'string' || !/^[A-Z]{1,7}$/.test(t.symbol)
      || typeof precision !== 'number' || !Number.isInteger(precision) || precision < 0 || precision > 18) continue;
    const key = `${t.contract}:${t.symbol}`;
    if (out.has(key)) continue;
    out.set(key, {
      contract: t.contract, symbol: t.symbol, precision,
      name: typeof t.name === 'string' && t.name.trim() ? t.name.trim() : t.symbol,
      logo: `https://wax.alcor.exchange/api/v2/tokens/${t.symbol.toLowerCase()}-${t.contract}/logo`,
    });
  }
  return [...out.values()];
}

export function parseTokenSnapshot(value: unknown): TokenSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  if (data.version !== 1 || data.verification !== 'eosio.get_currency_stats'
    || typeof data.updatedAt !== 'string' || !Number.isFinite(Date.parse(data.updatedAt))) return null;
  const tokens = parseTokenMetadata(data.tokens);
  return tokens.length ? { version: 1, verification: 'eosio.get_currency_stats', updatedAt: data.updatedAt, tokens } : null;
}