export const ACCOUNT = 'cheesepowerz';
export const PERMISSION = 'compound';
export const RESERVE = 400_00000000n;
export const CLAIM_GAP_MS = (24 * 60 + 5) * 60_000;

export function waxUnits(asset: string): bigint {
  const match = /^(\d+)\.(\d{8}) WAX$/.exec(asset);
  if (!match) throw new Error('Invalid 8-decimal WAX balance');
  return BigInt(match[1]) * 100_000000n + BigInt(match[2]);
}

export function waxAsset(units: bigint): string {
  if (units < 0n) throw new Error('Negative WAX amount');
  return `${units / 100_000000n}.${String(units % 100_000000n).padStart(8, '0')} WAX`;
}

export function stakeExcess(balance: string): bigint {
  const units = waxUnits(balance);
  return units > RESERVE ? units - RESERVE : 0n;
}

export interface Voter {
  owner: string;
  proxy: string;
  producers: string[];
  last_claim_time: string;
  unpaid_voteshare_last_updated: string;
  unpaid_voteshare: string;
  unpaid_voteshare_change_rate: string;
}

export function utcMs(value: string): number {
  const ms = Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`);
  if (!Number.isFinite(ms)) throw new Error('Invalid chain timestamp');
  return ms;
}

export function claimDue(voter: Voter, now: number): boolean {
  if (voter.owner !== ACCOUNT || !Array.isArray(voter.producers)) throw new Error('Invalid voter row');
  // Current WAX rewards may retain earned shares even after voting stops.
  // Do not hardcode an obsolete producer-count threshold (global4 is mutable).
  if (utcMs(voter.unpaid_voteshare_last_updated) <= 0) return false;
  const shares = Number(voter.unpaid_voteshare);
  const rate = Number(voter.unpaid_voteshare_change_rate);
  if (!Number.isFinite(shares) || !Number.isFinite(rate) || shares < 0 || rate < 0) throw new Error('Invalid vote shares');
  if (shares === 0 && rate === 0) return false;
  return now - utcMs(voter.last_claim_time) >= CLAIM_GAP_MS;
}

export function claimAction() {
  return { account: 'eosio', name: 'claimgbmvote',
    authorization: [{ actor: ACCOUNT, permission: PERMISSION }], data: { owner: ACCOUNT } };
}

export function stakeAction(units: bigint) {
  if (units <= 0n) throw new Error('No CPU stake required');
  return { account: 'eosio', name: 'delegatebw',
    authorization: [{ actor: ACCOUNT, permission: PERMISSION }],
    data: { from: ACCOUNT, receiver: ACCOUNT, stake_net_quantity: '0.00000000 WAX',
      stake_cpu_quantity: waxAsset(units), transfer: false } };
}

export interface PermissionRow {
  perm_name: string;
  parent: string;
  required_auth: { threshold: number; keys: { key: string; weight: number }[];
    accounts: unknown[]; waits: unknown[] };
  linked_actions?: { account: string; action: string }[];
}

export function validatePermission(rows: PermissionRow[], publicKey: string,
  normalize: (key: string) => string): void {
  const row = rows.find(p => p.perm_name === PERMISSION);
  if (!row || row.parent !== 'active') throw new Error('Missing compound permission under active');
  const auth = row.required_auth;
  if (auth.threshold !== 1 || auth.keys.length !== 1 || auth.keys[0]?.weight !== 1 ||
      auth.accounts.length || auth.waits.length || normalize(auth.keys[0].key) !== normalize(publicKey)) {
    throw new Error('compound must contain only the dedicated key at threshold 1');
  }
  if (rows.some(p => p.perm_name !== PERMISSION && p.required_auth.keys.some(k => normalize(k.key) === normalize(publicKey)))) {
    throw new Error('Automation key is reused in another permission');
  }
  const links = row.linked_actions ?? [];
  if (links.length !== 2 || !['claimgbmvote', 'delegatebw'].every(action =>
    links.some(link => link.account === 'eosio' && link.action === action))) {
    throw new Error('compound must link only eosio::claimgbmvote and eosio::delegatebw');
  }
}