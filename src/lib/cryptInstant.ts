/**
 * CHEESECrypt Instant Messaging: a browser-held signing key on a custom `cheesecrypt` permission that is
 * linked (eosio::linkauth) to crypt.cheese::sendfree only. That permission cannot move tokens, buy or sell
 * anything, or call any other contract, so sponsored text messages can be signed without a wallet popup.
 *
 * Setup and removal are normal Anchor transactions. When the account is short of RAM for the permission,
 * setup prepends a small CHEESE → ram.chz RAM purchase for the same account (Option A), or the user can
 * top up on CHEESERam first (Option C).
 */
import { PrivateKey, PublicKey, Session, type ChainDefinition } from '@wharfkit/session';
import { WalletPluginPrivateKey } from '@wharfkit/wallet-plugin-privatekey';
import { TransactPluginResourceProvider } from '@wharfkit/transact-plugin-resource-provider';
import { chainPost } from './chainRequest';
import { CRYPT_ROUTER_ACCOUNT } from './cheeseCrypt';
import { CHEESE_RAM_CONTRACT, CHEESE_TOKEN_CONTRACT, estimateCheeseForTargetBytes, resolveQuoteRate, type CheeseRamConfig } from './cheeseRam';
import { WAX_CHAIN_ID } from './wharfKit';

export const INSTANT_PERMISSION = 'cheesecrypt';
export const INSTANT_ACTION = 'sendfree';
/** A new permission + link costs a few hundred bytes; below this much free RAM, setup buys more first. */
export const INSTANT_MIN_FREE_RAM = 1500;
/** Bytes bought through ram.chz when the account is short. */
export const INSTANT_RAM_TOP_UP_BYTES = 2048;

export interface InstantKey { account: string; publicKey: string; privateKey: string; createdAt: number }
export interface InstantStatus {
  /** Free RAM bytes (quota − usage); null when the account has no RAM limit reading. */
  freeRam: number | null;
  /** On-chain keys of the `cheesecrypt` permission (empty when it does not exist). */
  keys: string[];
  exists: boolean;
  linked: boolean;
  /** Parent of the permission when it exists. */
  parent: string | null;
}

const storeKey = (account: string) => `cheesecrypt-instant:${account}`;

export function loadInstantKey(account: string): InstantKey | null {
  try {
    const raw = JSON.parse(localStorage.getItem(storeKey(account)) || 'null');
    if (!raw || raw.account !== account || typeof raw.privateKey !== 'string') return null;
    const pk = PrivateKey.from(raw.privateKey);
    const publicKey = pk.toPublic().toString();
    return { account, privateKey: pk.toString(), publicKey, createdAt: Number(raw.createdAt) || 0 };
  } catch { return null; }
}
export const saveInstantKey = (k: InstantKey) => localStorage.setItem(storeKey(k.account), JSON.stringify(k));
export const forgetInstantKey = (account: string) => localStorage.removeItem(storeKey(account));

export function generateInstantKey(account: string): InstantKey {
  const pk = PrivateKey.generate('K1');
  return { account, privateKey: pk.toString(), publicKey: pk.toPublic().toString(), createdAt: Date.now() };
}

const sameKey = (a: string, b: string) => { try { return PublicKey.from(a).equals(PublicKey.from(b)); } catch { return false; } };

type RawPerm = { perm_name?: string; parent?: string; required_auth?: { threshold?: number; keys?: { key?: string; weight?: number }[]; accounts?: unknown[]; waits?: unknown[] }; linked_actions?: { account?: string; action?: string }[] };

/** Reads the account's permission and RAM state from a raw get_account response. */
export function parseInstantStatus(acct: unknown): InstantStatus {
  const a = (acct ?? {}) as { ram_quota?: number; ram_usage?: number; permissions?: RawPerm[] };
  const quota = Number(a.ram_quota), usage = Number(a.ram_usage);
  const freeRam = Number.isFinite(quota) && quota >= 0 && Number.isFinite(usage) ? Math.max(0, quota - usage) : null;
  const perm = (a.permissions ?? []).find(p => p?.perm_name === INSTANT_PERMISSION);
  const keys = (perm?.required_auth?.keys ?? []).map(k => String(k?.key ?? '')).filter(Boolean);
  const linked = (a.permissions ?? []).some(p => p?.perm_name === INSTANT_PERMISSION
    && (p.linked_actions ?? []).some(l => l?.account === CRYPT_ROUTER_ACCOUNT && l?.action === INSTANT_ACTION));
  return { freeRam, keys, exists: !!perm, linked, parent: perm?.parent ?? null };
}

export async function fetchInstantStatus(account: string): Promise<InstantStatus> {
  return parseInstantStatus(await chainPost('/v1/chain/get_account', { account_name: account }));
}

/**
 * True only when this browser's key is the sole signer of a `cheesecrypt` permission (threshold 1) that is
 * linked to crypt.cheese::sendfree — i.e. the browser key can sign free messages and nothing else.
 */
export function instantReady(status: InstantStatus | null, key: InstantKey | null): boolean {
  if (!status || !key || !status.exists || !status.linked || status.keys.length !== 1) return false;
  return sameKey(status.keys[0], key.publicKey);
}

export const needsRam = (status: InstantStatus | null) => !status?.exists && status?.freeRam != null && status.freeRam < INSTANT_MIN_FREE_RAM;

/**
 * CHEESE to send ram.chz for INSTANT_RAM_TOP_UP_BYTES (+20% margin), clamped to the contract's min/max.
 * Uses the contract's stored reference rate so the quote never depends on a live price read. Null when
 * ram.chz is off or its config/price is unavailable.
 */
export function ramTopUpQuantity(config: CheeseRamConfig | null, pricePerByte: number | null): string | null {
  if (!config?.enabled || !pricePerByte) return null;
  const rate = resolveQuoteRate(config, null)?.rate ?? null;
  const est = estimateCheeseForTargetBytes(INSTANT_RAM_TOP_UP_BYTES, config, pricePerByte, rate);
  if (!est) return null;
  let units = Math.ceil(est.cheese * 1.2 * 10000);
  units = Math.max(units, Math.round(config.minCheese * 10000));
  if (config.maxCheese > 0 && units > Math.round(config.maxCheese * 10000)) return null;
  return `${Math.floor(units / 10000)}.${String(units % 10000).padStart(4, '0')} CHEESE`;
}

type Auth = { actor: string; permission: string };

/**
 * One Anchor transaction: optional ram.chz top-up for the same account, then updateauth (add or rotate the
 * key, parented to active) and linkauth to sendfree when not already linked.
 */
export function buildEnableActions(account: string, auth: Auth[], publicKey: string, opts: { linked: boolean; ramQuantity?: string | null }) {
  const actions: Record<string, unknown>[] = [];
  if (opts.ramQuantity) actions.push({ account: CHEESE_TOKEN_CONTRACT, name: 'transfer', authorization: auth,
    data: { from: account, to: CHEESE_RAM_CONTRACT, quantity: opts.ramQuantity, memo: '' } });
  actions.push({ account: 'eosio', name: 'updateauth', authorization: auth, data: {
    account, permission: INSTANT_PERMISSION, parent: 'active',
    auth: { threshold: 1, keys: [{ key: publicKey, weight: 1 }], accounts: [], waits: [] } } });
  if (!opts.linked) actions.push({ account: 'eosio', name: 'linkauth', authorization: auth,
    data: { account, code: CRYPT_ROUTER_ACCOUNT, type: INSTANT_ACTION, requirement: INSTANT_PERMISSION } });
  return actions;
}

/** Removes the link (if any) and deletes the permission; RAM it used is released back to the account. */
export function buildRevokeActions(account: string, auth: Auth[], status: InstantStatus) {
  const actions: Record<string, unknown>[] = [];
  if (status.linked) actions.push({ account: 'eosio', name: 'unlinkauth', authorization: auth,
    data: { account, code: CRYPT_ROUTER_ACCOUNT, type: INSTANT_ACTION } });
  if (status.exists) actions.push({ account: 'eosio', name: 'deleteauth', authorization: auth, data: { account, permission: INSTANT_PERMISSION } });
  return actions;
}

type Act = { account?: string; name?: string; data?: Record<string, unknown> };
/** Only a single crypt.cheese::sendfree from this account may ever be signed with the browser key. */
export function isInstantEligible(actions: unknown[], account: string): boolean {
  if (actions.length !== 1) return false;
  const a = actions[0] as Act;
  return a?.account === CRYPT_ROUTER_ACCOUNT && a.name === INSTANT_ACTION && a.data?.sender === account;
}

/** Signs and broadcasts one sendfree with the browser key (Greymass Fuel free tier covers CPU when available). */
export async function sendInstant(chain: ChainDefinition, key: InstantKey, actions: unknown[]): Promise<string | null> {
  if (!isInstantEligible(actions, key.account)) throw new Error('Only free messages can be sent instantly.');
  const session = new Session({ chain, actor: key.account, permission: INSTANT_PERMISSION, walletPlugin: new WalletPluginPrivateKey(key.privateKey) });
  const auth = [{ actor: key.account, permission: INSTANT_PERMISSION }];
  const signed = (actions as Act[]).map(a => ({ account: String(a.account), name: String(a.name), data: a.data ?? {}, authorization: auth }));
  const result = await session.transact({ actions: signed }, {
    transactPlugins: [new TransactPluginResourceProvider({ endpoints: { [WAX_CHAIN_ID]: 'https://wax.greymass.com' }, allowFees: false })],
  });
  return result.resolved?.transaction.id?.toString() || null;
}

/** Chain rejections meaning the browser key no longer matches the account's permission (revoked elsewhere). */
export const isInstantAuthFailure = (message: string | undefined) =>
  !!message && /(missing (required )?auth|irrelevant (signature|authority)|unsatisfied_authorization|does not have signatures|permission .* not found|unknown key)/i.test(message);
