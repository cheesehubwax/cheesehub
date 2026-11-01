import { applyHealthOrder } from '../shared/herdcheck';
import { ACCOUNT, utcMs, type Voter, type PermissionRow } from './policy';

export const CHAIN_ID = '1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4';
const endpoints = ['https://wax.eosusa.io', 'https://api.waxsweden.org', 'https://wax.greymass.com', 'https://wax.cryptolions.io'];
let selected = '';

async function post<T>(endpoint: string, path: string, body: unknown): Promise<T> {
  const response = await fetch(`${endpoint}/v1/chain/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`RPC ${path} returned HTTP ${response.status}`);
  return await response.json() as T;
}

export interface Info { chain_id: string; head_block_time: string; last_irreversible_block_num: number }
export interface Account { account_name: string; core_liquid_balance?: string; permissions: PermissionRow[] }

export async function connect(): Promise<void> {
  await applyHealthOrder(endpoints, 'chain-api');
  for (const endpoint of endpoints) {
    try {
      const info = await post<Info>(endpoint, 'get_info', {});
      if (info.chain_id !== CHAIN_ID || Math.abs(Date.now() - utcMs(info.head_block_time)) > 120_000) continue;
      selected = endpoint;
      return;
    } catch { /* Try the next health-ordered endpoint before any signing. */ }
  }
  throw new Error('No fresh WAX mainnet endpoint available');
}

export function rpc<T>(path: string, body: unknown): Promise<T> {
  if (!selected) throw new Error('RPC not connected');
  return post<T>(selected, path, body);
}

export async function snapshot() {
  const info = await rpc<Info>('get_info', {});
  if (info.chain_id !== CHAIN_ID || Math.abs(Date.now() - utcMs(info.head_block_time)) > 120_000) {
    throw new Error('RPC is no longer fresh WAX mainnet');
  }
  const [account, table] = await Promise.all([
    rpc<Account>('get_account', { account_name: ACCOUNT }),
    rpc<{ rows: Voter[] }>('get_table_rows', { json: true, code: 'eosio', scope: 'eosio', table: 'voters', lower_bound: ACCOUNT, upper_bound: ACCOUNT, limit: 1 }),
  ]);
  if (account.account_name !== ACCOUNT || table.rows[0]?.owner !== ACCOUNT) throw new Error('Account/voter lookup mismatch');
  if (account.core_liquid_balance === undefined) throw new Error('Liquid balance unavailable; refusing to guess');
  return { info, account, voter: table.rows[0], balance: account.core_liquid_balance };
}

// Signing/broadcasting stays pinned to the preflight endpoint. NEVER blindly
// retry a write on a different node after an ambiguous broadcast result.
export async function sessionFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = String(input);
  const index = url.indexOf('/v1/chain/');
  const target = index < 0 ? url : `${selected}${url.slice(index)}`;
  return fetch(target, { ...init, signal: AbortSignal.timeout(20_000) });
}