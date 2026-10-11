// CHEESEAir — snapshot every account registered under a name suffix (e.g. ".gm").
//
// On WAX only the owner of a suffix account can create names ending in it, so
// the full list is exactly the `newaccount` actions that suffix account signed.
// Read as a union across Hyperion providers so a thin index can't drop names.
import { fetchActionsUnion, type HyperionActionRecord } from './hyperionHistory';
import type { HolderSnapshot } from './airdropChain';

const NAME_RE = /^[a-z1-5.]{1,12}$/;

/** Normalise user input like ".GM" or " gm " to "gm"; null when not a valid name. */
export function normaliseSuffix(input: string): string | null {
  const s = input.trim().toLowerCase().replace(/^\.+/, '');
  if (!s || s.endsWith('.') || s.includes('..') || !NAME_RE.test(s)) return null;
  return s;
}

/** Accounts created by `suffix` whose name ends in `.suffix`, de-duplicated and sorted. */
export function suffixAccountsFromActions(actions: HyperionActionRecord[], suffix: string): string[] {
  const tail = `.${suffix}`;
  const out = new Set<string>();
  for (const a of actions) {
    if (a.act?.account !== 'eosio' || a.act?.name !== 'newaccount') continue;
    const data = a.act.data ?? {};
    const name = (data.newact ?? data.name) as unknown;
    if (data.creator !== suffix || typeof name !== 'string') continue;
    if (name.length > tail.length && name.endsWith(tail) && NAME_RE.test(name)) out.add(name);
  }
  return [...out].sort();
}

export async function getSuffixHolders(input: string): Promise<HolderSnapshot> {
  const suffix = normaliseSuffix(input);
  if (!suffix) throw new Error('Enter a valid account suffix (e.g. gm)');
  const { actions } = await fetchActionsUnion(
    `account=${suffix}&filter=eosio:newaccount&act.authorization.actor=${suffix}`,
    { timeoutMs: 30000 },
  );
  const accounts = suffixAccountsFromActions(actions, suffix);
  if (accounts.length === 0) throw new Error(`No accounts found ending in .${suffix}`);
  return {
    holders: accounts.map((account) => ({ account, weight: 1, raw: '1' })),
    truncated: false,
    source: 'hyperion-suffix',
    hasBalances: false,
  };
}
