import { PrivateKey, PublicKey } from '@wharfkit/session';
import { checkPermission, validateNightRunnerConfig, type NightRunnerConfig } from '../../scripts/synthetic-test/policy';
import { resolveEndpoints } from './endpointHealth';
import { cryptChainPost } from './cryptChainRead';
import { resolveVaultRoot, type DirHandle } from './cryptVault';
import { loadInstantKey } from './cryptInstant';

export type NightAccount = { account: string; permission: string; privateKey: string };
export type NightSettings = { timezone: string; start: string; end: string; sendsMin: number; sendsMax: number; enabled: boolean; replies: boolean };
type Permission = { perm_name: string; parent: string; required_auth: { threshold: number; keys: { key: string; weight: number }[]; accounts: unknown[]; waits: unknown[] }; linked_actions?: { account: string; action?: string }[] };
export type NightChainAccount = { permissions: Permission[] };

function signingKey(value: string) {
  try { return PrivateKey.from(value.trim()); }
  catch { throw new Error('Invalid restricted private key. Check the complete key locally; never share it in chat.'); }
}

/** Reject shared keys, ambiguous authority and every link except sendfree. No secret goes into a request. */
export function verifyNightAccount(raw: NightChainAccount, row: NightAccount) {
  const key = signingKey(row.privateKey).toPublic();
  const problem = checkPermission(raw, row.permission, [key.toString(), key.toLegacyString()], 'free-only');
  if (problem) throw new Error(`${row.account}: ${problem}`);
  const p = raw.permissions.find(p => p.perm_name === row.permission);
  if (!p || p.parent !== 'active' || p.required_auth?.threshold !== 1 || p.required_auth.keys?.length !== 1
    || p.required_auth.keys[0]?.weight !== 1 || p.required_auth.accounts?.length !== 0 || p.required_auth.waits?.length !== 0
    || raw.permissions.some(child => child.parent === row.permission)) throw new Error(`${row.account}: use a single-key permission with no delegated authority or children.`);
}

/** Never rotate an existing permission or reassign a link used by Instant Messaging. */
export function nightSetupActions(raw: NightChainAccount, account: string, permission: string, publicKey: string) {
  if (!/^[a-z1-5.]{1,12}$/.test(account) || account.endsWith('.') || !/^[a-z1-5.]{1,12}$/.test(permission) || ['active', 'owner'].includes(permission)) throw new Error('Use valid account and restricted permission names.');
  if (!Array.isArray(raw.permissions)) throw new Error('Account permissions unavailable.');
  if (raw.permissions.some(p => p.perm_name === permission)) throw new Error('This permission already exists. Supply its restricted key or choose a new name; existing keys are never replaced here.');
  if (raw.permissions.some(p => !Array.isArray(p.linked_actions))) throw new Error('This node cannot verify existing links. Try again with a node exposing linked_actions.');
  if (raw.permissions.some(p => p.linked_actions?.some(l => l.account === 'crypt.cheese' && (l.action === 'sendfree' || l.action == null || l.action === '*')))) throw new Error('sendfree is already linked. Reuse its isolated key only if it is not used by Instant Messaging; this assistant will not replace the link.');
  const normalized = PublicKey.from(publicKey).toString();
  if (raw.permissions.some(p => p.required_auth?.keys?.some(k => PublicKey.from(k.key).equals(normalized)))) throw new Error('Use a fresh key not present on any existing permission.');
  const authorization = [{ actor: account, permission: 'active' }];
  return [
    { account: 'eosio', name: 'updateauth', authorization, data: { account, permission, parent: 'active', auth: { threshold: 1, keys: [{ key: normalized, weight: 1 }], accounts: [], waits: [] } } },
    { account: 'eosio', name: 'linkauth', authorization, data: { account, code: 'crypt.cheese', type: 'sendfree', requirement: permission } },
  ];
}

export async function buildNightDownload(accounts: NightAccount[], settings: NightSettings): Promise<NightRunnerConfig> {
  const normalized = accounts.map(a => ({ ...a, account: a.account.trim(), permission: a.permission.trim(), privateKey: signingKey(a.privateKey).toString() }));
  for (const row of normalized) {
    const instant = loadInstantKey(row.account);
    if (instant && signingKey(row.privateKey).toPublic().equals(instant.publicKey)) throw new Error('This key is used by Instant Messaging in this tab. Do not export it to Nightcrawler.');
  }
  const config = validateNightRunnerConfig({ accounts: normalized, maxSendsPerAccountPerDay: 10, reserve: '1.0000 CHEESE',
    chainApi: await resolveEndpoints('chain-api'), broadcast: 'http://127.0.0.1:8088', night: { enabled: settings.enabled, timezone: settings.timezone,
      start: settings.start, end: settings.end, sendsMin: settings.sendsMin, sendsMax: settings.sendsMax, senders: [normalized[0]?.account],
      skipNightChance: 0.15, replyChance: settings.replies ? 0.5 : 0, replyDelayMinSeconds: 180, replyDelayMaxSeconds: 900 } });
  for (const a of normalized) verifyNightAccount(await cryptChainPost<NightChainAccount>('/v1/chain/get_account', { account_name: a.account }), a);
  return config;
}

export function downloadNightConfig(config: NightRunnerConfig) {
  downloadNightJson('night-config.json', config);
}

export function downloadNightJson(name: string, data: NightRunnerConfig | NightAccount) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Static source bundle only. Never fetch or transmit a user's configuration. */
export async function loadNightFiles(): Promise<Record<string, string>> {
  const base = `${import.meta.env.BASE_URL}downloads/nightcrawler/`;
  const names = ['night.ts', 'policy.ts', 'runtime.ts', 'nightState.ts', 'bun.lock', 'night-config.example.json', 'package.json', 'README.md'];
  const entries = await Promise.all(names.map(async name => {
    const r = await fetch(`${base}${name}`, { cache: 'no-cache' });
    if (!r.ok) throw new Error(`Cannot download ${name}.`);
    return [name, await r.text()] as const;
  }));
  return Object.fromEntries(entries);
}

/** Refuse overwrites of any source/config/state in an existing installation. */
export async function saveNightFolder(picked: DirHandle, files: Record<string, string>, config: NightRunnerConfig) {
  if (['friends', 'my private key', 'my private keys', 'private key', 'private keys'].includes(picked.name.toLowerCase())) throw new Error('Select your main cheesecrypt folder, not its friends or private-key subfolder.');
  const root = picked.name.toLowerCase() === 'nightcrawler' ? picked : await (await resolveVaultRoot(picked)).getDirectoryHandle('nightcrawler', { create: true });
  const entries = { ...files, 'night-config.json': JSON.stringify(config, null, 2) };
  for (const name of [...Object.keys(entries), 'night-config.night.json', 'night-config.state.json', 'night-config.night.json.lock']) {
    try { await root.getFileHandle(name); }
    catch (e) { if ((e as DOMException).name === 'NotFoundError') continue; throw e; }
    throw new Error('Nightcrawler files already exist. Nothing was replaced. Stop the local runner before making changes; keep its progress files.');
  }
  for (const [name, data] of Object.entries(entries)) {
    const writer = await (await root.getFileHandle(name, { create: true })).createWritable();
    try { await writer.write(data); await writer.close(); }
    catch (e) { await writer.abort?.().catch(() => {}); throw e; }
  }
}