import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { applyHealthOrder } from '../shared/herdcheck';
import { parseTokenMetadata, parseTokenSnapshot, type SnapshotToken, type TokenSnapshot } from '../../src/lib/tokenSnapshotSchema';

const ENDPOINTS = ['https://wax.eosusa.io', 'https://api.waxsweden.org', 'https://wax.greymass.com'];

export function precisionFromStats(value: unknown, symbol: string): number | null {
  if (!value || typeof value !== 'object') return null;
  const row = (value as Record<string, { supply?: unknown; max_supply?: unknown }>)[symbol];
  const asset = row?.max_supply ?? row?.supply;
  if (typeof asset !== 'string') return null;
  const match = asset.match(/^(?:\d+)(?:\.(\d+))? ([A-Z]{1,7})$/);
  return match && match[2] === symbol ? (match[1]?.length ?? 0) : null;
}

async function verify(token: SnapshotToken, start: number): Promise<SnapshotToken | null> {
  for (let i = 0; i < ENDPOINTS.length; i++) {
    try {
      const res = await fetch(`${ENDPOINTS[(start + i) % ENDPOINTS.length]}/v1/chain/get_currency_stats`, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({ code: token.contract, symbol: token.symbol }), signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) continue;
      const precision = precisionFromStats(await res.json(), token.symbol);
      return precision == null ? null : { ...token, precision };
    } catch { /* Try the next healthy provider. */ }
  }
  return null;
}

/** Reuse unchanged chain-verified identities; verify new or changed metadata. */
export async function recordTokenRegistry(dir: string, raw: unknown): Promise<void> {
  const candidates = parseTokenMetadata(raw);
  if (candidates.length < 50) throw new Error('Refusing a partial token registry');
  const file = join(dir, 'tokens.json');
  const previous = existsSync(file) ? parseTokenSnapshot(JSON.parse(readFileSync(file, 'utf8'))) : null;
  const old = new Map(previous?.tokens.map(t => [`${t.contract}:${t.symbol}`, t]) ?? []);
  await applyHealthOrder(ENDPOINTS, 'chain-api');
  let cursor = 0;
  let failed = 0;
  const verified: SnapshotToken[] = [];
  await Promise.all(Array.from({ length: 6 }, async (_, worker) => {
    while (cursor < candidates.length) {
      const token = candidates[cursor++];
      const saved = old.get(`${token.contract}:${token.symbol}`);
      if (saved?.precision === token.precision) { verified.push(token); continue; }
      const result = await verify(token, worker);
      if (result) verified.push(result);
      else { failed++; if (saved) verified.push(saved); }
    }
  }));
  if (verified.length < 50 || (previous && verified.length < previous.tokens.length * 0.8)) {
    throw new Error(`Only ${verified.length} verified tokens — keeping the last snapshot`);
  }
  const snapshot: TokenSnapshot = {
    version: 1, verification: 'eosio.get_currency_stats', updatedAt: new Date().toISOString(),
    tokens: verified.sort((a, b) => `${a.contract}:${a.symbol}`.localeCompare(`${b.contract}:${b.symbol}`)),
  };
  writeFileSync(file, JSON.stringify(snapshot));
  console.log(`Registry: ${verified.length} chain-verified tokens; ${failed} unverifiable candidates excluded or retained from previous verification.`);
}