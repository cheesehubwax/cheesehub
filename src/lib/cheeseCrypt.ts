/**
 * CHEESECrypt — on-chain encrypted messaging (migrated from gpkonwax/collection-manager).
 * Messages are memos on CHEESE transfers with a same-transaction fee nulled to eosio.null,
 * encrypted with nacl.box (X25519 + XSalsa20-Poly1305). Box keys are symmetric between the
 * pair, so the sender can also read their own sent messages.
 *
 * New memos use the CHEESECrypt prefixes (CRYPT1: / CRYPTKEY1:). Readers also accept the
 * original GPKM1: / GPKMKEY1: prefixes so existing messages and published keys keep working.
 * Key file types (gpk-msg-key / gpk-msg-pubkey) are unchanged so backups keep loading.
 */
import nacl from 'tweetnacl';
import { parseCryptName, saveCryptName } from '@/lib/cryptNames';
import { CryptAvatar, parseAvatar } from '@/lib/cryptAvatar';
import { decodeBase64, encodeBase64, decodeUTF8, encodeUTF8 } from 'tweetnacl-util';
import { benchEndpoint, normalizeEndpoint, resolveEndpoints } from '@/lib/endpointHealth';

export const MSG_PREFIX = 'CRYPT1:';
export const KEY_PREFIX = 'CRYPTKEY1:';
export const LEGACY_MSG_PREFIX = 'GPKM1:';
export const LEGACY_KEY_PREFIX = 'GPKMKEY1:';
/** The message prefix a memo carries (new or legacy), or null if it is not a message. */
export const msgPrefixOf = (memo: string) => memo.startsWith(MSG_PREFIX) ? MSG_PREFIX : memo.startsWith(LEGACY_MSG_PREFIX) ? LEGACY_MSG_PREFIX : null;
export const keyPrefixOf = (memo: string) => memo.startsWith(KEY_PREFIX) ? KEY_PREFIX : memo.startsWith(LEGACY_KEY_PREFIX) ? LEGACY_KEY_PREFIX : null;
export const MEMO_MAX_BYTES = 256;
export const KEY_PUBLISH_TO = 'eosio.null';
/** Blind atomic fee router account (contracts/cheesecrypt), live on mainnet. */
export const CRYPT_ROUTER_ACCOUNT = 'crypt.cheese';
export const FEE_MEMO = 'CHEESECrypt messaging fee';
export const KEY_CREATION_MEMO = 'CHEESECrypt key creation fee';
export const KEY_CREATION_QUANTITY = '100.0000 CHEESE';
export const LIQUIDITY_FEE_TO = 'xcheeseliqst';

export const MESSAGE_RECIPIENT_QUANTITY = '0.0001 CHEESE';
export const MESSAGE_FEE_QUANTITY = '0.0100 CHEESE';
export const MESSAGE_TOTAL_QUANTITY = '0.0101 CHEESE';
/** NFT messages pay the same platform fee as text so the amount never reveals that an NFT was sent. */
export const NFT_FEE_QUANTITY = MESSAGE_FEE_QUANTITY;
const units = (q: string) => Math.round(parseFloat(q) * 10000);

export interface MessagingKey {
  type: 'gpk-msg-key';
  version: 1;
  account: string;
  publicKey: string;
  secretKey: string;
  created: string;
  avatar?: CryptAvatar;
  displayName?: string;
}
export interface PublicKeyFile {
  type: 'gpk-msg-pubkey';
  version: 1;
  account: string;
  publicKey: string;
  avatar?: CryptAvatar;
  displayName?: string;
}

const keyStore = (a: string) => `cheesecrypt-key-${a}`;
// Unsealed keys are session-only. Old browser copies remain readable for explicit migration.
const sessionKeys = new Map<string, MessagingKey>();
export const clearSessionKeys = () => sessionKeys.clear();
const contactStore = (a: string) => `cheesecrypt-contacts-${a}`;

export function generateKey(account: string, profile: { avatar?: CryptAvatar; displayName?: string } = {}): MessagingKey {
  const kp = nacl.box.keyPair();
  return {
    type: 'gpk-msg-key', version: 1, account,
    publicKey: encodeBase64(kp.publicKey),
    secretKey: encodeBase64(kp.secretKey),
    created: new Date().toISOString(),
    avatar: parseAvatar(profile.avatar),
    displayName: parseCryptName(profile.displayName),
  };
}

const validKey = (b64: string, len: number) => {
  try { return decodeBase64(b64).length === len; } catch { return false; }
};

export function parseKeyFile(raw: unknown): MessagingKey | PublicKeyFile | null {
  const o = raw as Record<string, unknown>;
  if (!o || typeof o.account !== 'string' || typeof o.publicKey !== 'string') return null;
  if (!validKey(o.publicKey, 32)) return null;
  if (o.type === 'gpk-msg-key') {
    if (typeof o.secretKey !== 'string' || !validKey(o.secretKey, 32)) return null;
    // the public key must belong to the secret key
    const derived = nacl.box.keyPair.fromSecretKey(decodeBase64(o.secretKey));
    if (encodeBase64(derived.publicKey) !== o.publicKey) return null;
    return { ...o, avatar: parseAvatar(o.avatar), displayName: parseCryptName(o.displayName) } as unknown as MessagingKey;
  }
  if (o.type === 'gpk-msg-pubkey') return { ...o, avatar: parseAvatar(o.avatar), displayName: parseCryptName(o.displayName) } as unknown as PublicKeyFile;
  return null;
}

export const toPublicFile = (k: MessagingKey): PublicKeyFile =>
  ({ type: 'gpk-msg-pubkey', version: 1, account: k.account, publicKey: k.publicKey, ...(k.avatar ? { avatar: k.avatar } : {}), ...(parseCryptName(k.displayName) ? { displayName: parseCryptName(k.displayName) } : {}) });

export function loadKey(account: string): MessagingKey | null {
  const current = sessionKeys.get(account);
  if (current) return current;
  try {
    const v = parseKeyFile(JSON.parse(localStorage.getItem(keyStore(account)) || 'null'));
    return v && v.type === 'gpk-msg-key' && v.account === account ? v : null;
  } catch { return null; }
}
export const saveKey = (k: MessagingKey) => { sessionKeys.set(k.account, k); localStorage.removeItem(keyStore(k.account)); };

export function loadContacts(account: string): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(contactStore(account)) || '{}') || {}; } catch { return {}; }
}
export function loadContactAvatars(account: string): Record<string, CryptAvatar> {
  try {
    const raw = JSON.parse(localStorage.getItem(`cheesecrypt-avatars-${account}`) || '{}');
    const result: Record<string, CryptAvatar> = {};
    for (const [name, value] of Object.entries(raw || {})) {
      const avatar = parseAvatar(value);
      if (avatar) result[name] = avatar;
    }
    return result;
  } catch { return {}; }
}
export function loadRemovedContacts(account: string): string[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(`cheesecrypt-removed-contacts-${account}`) || '[]');
    return Array.isArray(raw) ? raw.filter((value): value is string => typeof value === 'string') : [];
  } catch { return []; }
}
export function removeContact(account: string, contact: string) {
  const contacts = loadContacts(account);
  delete contacts[contact];
  localStorage.setItem(contactStore(account), JSON.stringify(contacts));
  const avatars = loadContactAvatars(account);
  delete avatars[contact];
  localStorage.setItem(`cheesecrypt-avatars-${account}`, JSON.stringify(avatars));
  saveCryptName(account, contact, '');
  saveCryptName(account, contact, '', 'nicknames');
  localStorage.setItem(`cheesecrypt-removed-contacts-${account}`, JSON.stringify([...new Set([...loadRemovedContacts(account), contact])]));
}
export function saveContact(account: string, contact: string, publicKey: string, avatar?: CryptAvatar, displayName?: string) {
  const c = loadContacts(account);
  c[contact] = publicKey;
  localStorage.setItem(contactStore(account), JSON.stringify(c));
  localStorage.setItem(`cheesecrypt-removed-contacts-${account}`, JSON.stringify(loadRemovedContacts(account).filter(name => name !== contact)));
  if (displayName !== undefined) saveCryptName(account, contact, displayName);
  if (avatar) {
    const avatars = loadContactAvatars(account);
    avatars[contact] = avatar;
    localStorage.setItem(`cheesecrypt-avatars-${account}`, JSON.stringify(avatars));
  }
}

const utf8Len = (s: string) => new TextEncoder().encode(s).length;

/** Largest plaintext (UTF-8 bytes) that fits one memo. */
export const MAX_PLAINTEXT_BYTES = (() => {
  // memo = prefix + b64(nonce 24) + ':' + b64(len + 16)
  for (let n = 256; n > 0; n--) {
    const len = MSG_PREFIX.length + 32 + 1 + 4 * Math.ceil((n + 16) / 3);
    if (len <= MEMO_MAX_BYTES) return n;
  }
  return 0;
})();

export const plaintextBytes = utf8Len;

/** Encrypt raw bytes (at most MAX_PLAINTEXT_BYTES) into a CRYPT1: memo. */
export function encryptBytesMemo(bytes: Uint8Array, theirPublic: string, mySecret: string): string {
  if (!bytes.length) throw new Error('Message is empty');
  if (bytes.length > MAX_PLAINTEXT_BYTES) throw new Error(`Message is longer than ${MAX_PLAINTEXT_BYTES} bytes`);
  const nonce = nacl.randomBytes(24);
  const box = nacl.box(bytes, nonce, decodeBase64(theirPublic), decodeBase64(mySecret));
  return `${MSG_PREFIX}${encodeBase64(nonce)}:${encodeBase64(box)}`;
}

export function encryptMemo(text: string, theirPublic: string, mySecret: string): string {
  if (!text) throw new Error('Message is empty');
  if (utf8Len(text) > MAX_PLAINTEXT_BYTES) throw new Error(`Message is longer than ${MAX_PLAINTEXT_BYTES} bytes`);
  return encryptBytesMemo(decodeUTF8(text), theirPublic, mySecret);
}

/** Decrypt a CRYPT1: or legacy GPKM1: memo to raw bytes; null if it is not readable with these keys. */
export function decryptMemoBytes(memo: string, theirPublic: string, mySecret: string): Uint8Array | null {
  const prefix = msgPrefixOf(memo);
  if (!prefix) return null;
  const [n, c] = memo.slice(prefix.length).split(':');
  try {
    return nacl.box.open(decodeBase64(c), decodeBase64(n), decodeBase64(theirPublic), decodeBase64(mySecret)) || null;
  } catch { return null; }
}

/** UTF-8 text from decrypted bytes, or null when they are not valid text. */
export function bytesToText(bytes: Uint8Array): string | null {
  try { return encodeUTF8(bytes); } catch { return null; }
}

export function decryptMemo(memo: string, theirPublic: string, mySecret: string): string | null {
  const out = decryptMemoBytes(memo, theirPublic, mySecret);
  return out ? bytesToText(out) : null;
}

// ---- Multi-part messages ----
// A long message is split into parts sent as separate memos in ONE transaction. Each part's
// plaintext starts with a 9-byte header: \u0001 + 6-char id + part index + part count (base36).
// Single-part messages carry no header, so they stay identical to the original wire format.
export const PART_MARK = '\u0001';
export const PART_HEADER_BYTES = 9;
export const MAX_PARTS = 20;
export const PART_BODY_BYTES = MAX_PLAINTEXT_BYTES - PART_HEADER_BYTES;
export const MAX_MESSAGE_BYTES = PART_BODY_BYTES * MAX_PARTS;

/** Split text into bodies of at most `max` UTF-8 bytes without cutting a character. */
function splitBytes(text: string, max: number): string[] {
  const out: string[] = [];
  let cur = '', curLen = 0;
  for (const ch of text) {
    const l = utf8Len(ch);
    if (curLen + l > max) { out.push(cur); cur = ''; curLen = 0; }
    cur += ch; curLen += l;
  }
  if (cur) out.push(cur);
  return out;
}

/** Number of parts (transfers) a message needs; 0 for empty text. */
export function partCount(text: string): number {
  if (!text) return 0;
  if (utf8Len(text) <= MAX_PLAINTEXT_BYTES) return 1;
  return splitBytes(text, PART_BODY_BYTES).length;
}

/** Plaintext payloads to encrypt, one per memo. */
export function splitMessage(text: string, id = randomId(), maxParts = MAX_PARTS): string[] {
  if (!text) throw new Error('Message is empty');
  if (utf8Len(text) <= MAX_PLAINTEXT_BYTES) return [text];
  const bodies = splitBytes(text, PART_BODY_BYTES);
  if (bodies.length > maxParts || maxParts > 35) throw new Error(`Message is longer than ${maxParts} parts`);
  return bodies.map((b, i) => `${PART_MARK}${id}${i.toString(36)}${bodies.length.toString(36)}${b}`);
}

function randomId(): string {
  const b = nacl.randomBytes(6);
  return Array.from(b, (x) => (x % 36).toString(36)).join('');
}

export interface MessagePart { id: string; index: number; total: number; body: string }
export function parsePart(plain: string): MessagePart | null {
  if (!plain.startsWith(PART_MARK) || plain.length < PART_HEADER_BYTES) return null;
  const id = plain.slice(1, 7), index = parseInt(plain[7], 36), total = parseInt(plain[8], 36);
  if (!/^[0-9a-z]{6}$/.test(id) || !(total >= 2) || !(index >= 0 && index < total)) return null;
  return { id, index, total, body: plain.slice(PART_HEADER_BYTES) };
}

export interface DecodedMemo { txId: string; time: number; from: string; to: string; quantity: string; memo: string; text: string | null }
export interface AssembledMessage {
  key: string; txId: string; time: number; from: string; to: string;
  text: string | null; parts: number; missing: number;
}

/** Join multi-part memos back into single messages (grouped by sender + part id). */
export function assembleMessages(memos: DecodedMemo[]): AssembledMessage[] {
  const out: AssembledMessage[] = [];
  const groups = new Map<string, { m: DecodedMemo; p: MessagePart }[]>();
  for (const m of memos) {
    const p = m.text != null ? parsePart(m.text) : null;
    if (!p) {
      out.push({ key: m.txId + m.memo, txId: m.txId, time: m.time, from: m.from, to: m.to, text: m.text, parts: 1, missing: 0 });
      continue;
    }
    const k = `${m.txId}:${m.from}:${p.id}:${m.to}`;
    const group = groups.get(k);
    if (group) group.push({ m, p });
    else groups.set(k, [{ m, p }]);
  }
  for (const [k, g] of groups) {
    const total = g[0].p.total;
    const byIndex = new Map<number, string>();
    g.forEach(({ p }) => { if (p.total === total && !byIndex.has(p.index)) byIndex.set(p.index, p.body); });
    const text = Array.from({ length: total }, (_, i) => byIndex.get(i) ?? ' […] ').join('');
    const first = g.reduce((a, b) => (b.m.time < a.m.time ? b : a)).m;
    out.push({ key: k, txId: first.txId, time: first.time, from: first.from, to: first.to, text, parts: total, missing: total - byIndex.size });
  }
  return out.sort((a, b) => a.time - b.time);
}

/** Total CHEESE for a message of `parts` parts (each part pays the full per-message price). */
export function messageCost(parts: number, hasNft = false): string {
  const total = units(MESSAGE_TOTAL_QUANTITY) * parts + (hasNft ? units(NFT_FEE_QUANTITY) - units(MESSAGE_FEE_QUANTITY) : 0);
  return `${(total / 10000).toFixed(4)} CHEESE`;
}

export const keyMemo = (publicKey: string) => `${KEY_PREFIX}${publicKey}`;

function cheeseTransfer(from: string, to: string, quantity: string, memo: string, auth: unknown[]) {
  return { account: 'cheeseburger', name: 'transfer', authorization: auth, data: { from, to, quantity, memo } };
}

/** Integer-unit split of platform fees only; recipient payments are separate. */
export function buildCryptFeeActions(from: string, quantity: string, auth: unknown[], memo = FEE_MEMO) {
  const total = units(quantity);
  if (!Number.isSafeInteger(total) || total <= 0 || total % 5 !== 0) throw new Error('Invalid CHEESECrypt fee');
  return [
    cheeseTransfer(from, KEY_PUBLISH_TO, `${(total * 4 / 5 / 10000).toFixed(4)} CHEESE`, memo, auth),
    cheeseTransfer(from, LIQUIDITY_FEE_TO, `${(total / 5 / 10000).toFixed(4)} CHEESE`, memo, auth),
  ];
}
export function buildCreateKeyActions(from: string, auth: unknown[]) {
  return buildCryptFeeActions(from, KEY_CREATION_QUANTITY, auth, KEY_CREATION_MEMO);
}
/** Group copies and voice parts explicitly omit per-part platform fees. */
export function buildSendMessageActions(from: string, to: string, memo: string | string[], auth: unknown[], hasNft = false, includeFee = true) {
  const memos = Array.isArray(memo) ? memo : [memo];
  return memos.flatMap((m, i) => [
    cheeseTransfer(from, to, MESSAGE_RECIPIENT_QUANTITY, m, auth),
    ...(includeFee ? buildCryptFeeActions(from, hasNft && i === 0 ? NFT_FEE_QUANTITY : MESSAGE_FEE_QUANTITY, auth) : []),
  ]);
}

/**
 * Live sending goes through the crypt.cheese blind router. Unit/flow tests keep asserting the
 * legacy direct shape (still used for anything the router cannot express); the adapter has its own tests.
 */
export const CRYPT_ROUTER_ENABLED = import.meta.env.MODE !== 'test';
const ROUTER_MAX_PARTS = 35;
const ROUTER_MAX_RECIPIENTS = 49;
type TransferAction = { account: string; name: string; authorization: unknown; data: { from: string; to: string; quantity: string; memo: string } };

/**
 * Converts a direct CHEESECrypt message transaction into one exact payment + `crypt.cheese::sendmsg`.
 * Only exact router shapes convert: every action a CHEESE transfer from one sender, 0.0001 copies
 * with message memos, every recipient receiving the same `parts` copies, and an 80/20 platform fee of
 * exactly 0.0100 per part. Anything else (key creation/publishing, listings, fee-less profile batches,
 * mixed admissions) is returned unchanged so it stays on the direct path.
 */
export function routeCryptActions<T>(actions: T[]): T[] | Record<string, unknown>[] {
  if (!actions.length) return actions;
  const list = actions as unknown as TransferAction[];
  const first = list[0];
  if (!list.every(a => a?.account === 'cheeseburger' && a.name === 'transfer' && a.data && a.data.from === first.data.from
    && JSON.stringify(a.authorization) === JSON.stringify(first.authorization))) return actions;
  const sender = first.data.from;
  const copies: { to: string; memo: string }[] = [];
  let nulled = 0, liquidity = 0;
  for (const a of list) {
    const { to, quantity, memo } = a.data;
    if (to === KEY_PUBLISH_TO || to === LIQUIDITY_FEE_TO) {
      if (memo !== FEE_MEMO) return actions;
      if (to === KEY_PUBLISH_TO) nulled += units(quantity); else liquidity += units(quantity);
    } else {
      if (to === CRYPT_ROUTER_ACCOUNT || to === sender || quantity !== MESSAGE_RECIPIENT_QUANTITY || !msgPrefixOf(memo)) return actions;
      if (new TextEncoder().encode(memo).length > MEMO_MAX_BYTES) return actions;
      copies.push({ to, memo });
    }
  }
  if (!copies.length) return actions;
  const counts = new Map<string, number>();
  for (const c of copies) counts.set(c.to, (counts.get(c.to) ?? 0) + 1);
  const parts = counts.get(copies[0].to)!;
  if (![...counts.values()].every(n => n === parts) || parts > ROUTER_MAX_PARTS || counts.size > ROUTER_MAX_RECIPIENTS) return actions;
  const fee = nulled + liquidity;
  if (fee !== parts * units(MESSAGE_FEE_QUANTITY) || nulled * 5 !== fee * 4) return actions;
  const total = fee + copies.length * units(MESSAGE_RECIPIENT_QUANTITY);
  return [
    { account: 'cheeseburger', name: 'transfer', authorization: first.authorization, data: { from: sender, to: CRYPT_ROUTER_ACCOUNT, quantity: `${(total / 10000).toFixed(4)} CHEESE`, memo: FEE_MEMO } },
    { account: CRYPT_ROUTER_ACCOUNT, name: 'sendmsg', authorization: first.authorization, data: { sender, parts, copies } },
  ];
}

/**
 * Router deliveries arrive as `crypt.cheese → recipient` transfers. The real sender comes only from the
 * `sendmsg` action in the same transaction, authorized by that sender (the contract also requires it).
 * Returns every authenticated copy as a direct-style row; memo-only claims are never trusted.
 */
export function expandRouterActions(txId: string, time: number, actions: unknown[]): ChainMemo[] {
  const out: ChainMemo[] = [];
  for (const raw of actions) {
    const act = (raw as { act?: { account?: string; name?: string; authorization?: { actor?: string }[]; data?: { sender?: string; copies?: { to?: string; memo?: string }[] } } })?.act;
    if (act?.account !== CRYPT_ROUTER_ACCOUNT || act.name !== 'sendmsg') continue;
    const sender = act.data?.sender;
    if (!sender || !act.authorization?.some(a => a.actor === sender) || !Array.isArray(act.data?.copies)) continue;
    for (const c of act.data!.copies!) {
      if (typeof c?.to === 'string' && typeof c.memo === 'string' && c.to !== sender)
        out.push({ txId, time, from: sender, to: c.to, memo: c.memo, quantity: MESSAGE_RECIPIENT_QUANTITY });
    }
  }
  return out;
}

const routerTxCache = new Map<string, ChainMemo[]>();
async function routerTransaction(txId: string, time: number): Promise<ChainMemo[] | null> {
  const hit = routerTxCache.get(txId);
  if (hit) return hit;
  for (const raw of await resolveEndpoints('hyperion-v2')) {
    const base = normalizeEndpoint(raw);
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 10000);
      const r = await fetch(`${base}/v2/history/get_transaction?id=${encodeURIComponent(txId)}`, { signal: ctl.signal }).finally(() => clearTimeout(t));
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      if (!Array.isArray(j.actions) || !j.actions.length) throw new Error('Transaction not indexed yet');
      const rows = expandRouterActions(txId, time, j.actions);
      if (routerTxCache.size > 5000) routerTxCache.clear();
      routerTxCache.set(txId, rows);
      return rows;
    } catch { benchEndpoint(base); }
  }
  return null;
}

/** Replaces router-delivered rows with their authenticated sender rows; unresolved ones are dropped until a later poll. */
export async function resolveRouterRows(account: string, rows: ChainMemo[]): Promise<ChainMemo[]> {
  const direct = rows.filter(r => r.from !== CRYPT_ROUTER_ACCOUNT && r.to !== CRYPT_ROUTER_ACCOUNT);
  const txs = new Map<string, number>();
  for (const r of rows) if (r.from === CRYPT_ROUTER_ACCOUNT || r.to === CRYPT_ROUTER_ACCOUNT) if (!txs.has(r.txId)) txs.set(r.txId, r.time);
  const entries = [...txs];
  const resolved: ChainMemo[] = [];
  for (let i = 0; i < entries.length; i += 4) {
    const batch = await Promise.all(entries.slice(i, i + 4).map(([id, time]) => routerTransaction(id, time)));
    for (const b of batch) if (b) resolved.push(...b.filter(m => m.from === account || m.to === account));
  }
  return direct.concat(resolved);
}

/** Both fee legs carry the key; lookup reads the eosio.null leg. */
export function buildPublishKeyActions(from: string, publicKey: string, auth: unknown[]) {
  return buildCryptFeeActions(from, MESSAGE_FEE_QUANTITY, auth, keyMemo(publicKey));
}

export interface ChainMemo { txId: string; time: number; from: string; to: string; memo: string; quantity: string }

async function hyperionTransfers(query: string): Promise<ChainMemo[]> {
  let lastErr: unknown = null;
  for (const raw of await resolveEndpoints('hyperion-v2')) {
    const base = normalizeEndpoint(raw);
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 10000);
      const r = await fetch(`${base}/v2/history/get_actions?${query}`, { signal: ctl.signal }).finally(() => clearTimeout(t));
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      return (j.actions || []).map((a: any) => ({
        txId: a.trx_id, time: Date.parse((a['@timestamp'] || a.timestamp) + 'Z'),
        from: a.act?.data?.from, to: a.act?.data?.to, memo: a.act?.data?.memo || '',
        quantity: a.act?.data?.quantity || '',
      }));
    } catch (e) { lastErr = e; benchEndpoint(base); }
  }
  throw lastErr instanceof Error ? lastErr : new Error('History lookup failed');
}

// Continue reading legacy WAX messages and published keys.
const FILTER = 'filter=eosio.token:transfer,cheeseburger:transfer';

/** Newest key the account published on chain (new or legacy prefix), if any. */
export async function lookupPublishedKey(account: string): Promise<string | null> {
  return newestPublishedKey(account, await hyperionTransfers(`account=${account}&${FILTER}&transfer.to=${KEY_PUBLISH_TO}&sort=desc&limit=100`));
}

/** Rows are newest first; the first valid key memo from the account wins, whichever prefix it uses. */
export function newestPublishedKey(account: string, rows: ChainMemo[]): string | null {
  for (const r of rows) {
    const prefix = keyPrefixOf(r.memo);
    if (r.from !== account || !prefix) continue;
    const k = r.memo.slice(prefix.length).trim();
    if (validKey(k, 32)) return k;
  }
  return null;
}

export const HISTORY_PAGE = 500;
export const MAX_HISTORY_PAGES = 4;

/**
 * Encrypted messages sent or received by the account (newest first, deduped).
 * `pages` > 1 reads further back by timestamp, so multi-transaction voice notes are not cut in half.
 */
export async function fetchMessages(account: string, pages = 1): Promise<ChainMemo[]> {
  let rows: ChainMemo[] = [];
  let before: string | null = null;
  for (let p = 0; p < Math.min(Math.max(1, pages), MAX_HISTORY_PAGES); p++) {
    const page = await hyperionTransfers(`account=${account}&${FILTER}&sort=desc&limit=${HISTORY_PAGE}${before ? `&before=${encodeURIComponent(before)}` : ''}`);
    rows = rows.concat(page);
    if (page.length < HISTORY_PAGE) break;
    const oldest = Math.min(...page.map(r => r.time).filter(Number.isFinite));
    if (!Number.isFinite(oldest)) break;
    before = new Date(oldest).toISOString();
  }
  rows = await resolveRouterRows(account, rows);
  const seen = new Set<string>();
  return rows.filter((r) => {
    if (!msgPrefixOf(r.memo) || (r.from !== account && r.to !== account)) return false;
    const id = `${r.txId}:${r.memo}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export const ROOM_SCAN_PAGES = 4;
/** Recent CHEESE transfers to eosio.null whose memo starts with `prefix` (bounded, newest first, deduped). */
export async function fetchRoomMemos(prefix: string, pages = ROOM_SCAN_PAGES): Promise<ChainMemo[]> {
  let rows: ChainMemo[] = [];
  let before: string | null = null;
  for (let p = 0; p < Math.max(1, pages); p++) {
    const page = await hyperionTransfers(`account=${KEY_PUBLISH_TO}&filter=cheeseburger:transfer&transfer.to=${KEY_PUBLISH_TO}&sort=desc&limit=${HISTORY_PAGE}${before ? `&before=${encodeURIComponent(before)}` : ''}`);
    rows = rows.concat(page);
    if (page.length < HISTORY_PAGE) break;
    const oldest = Math.min(...page.map(r => r.time).filter(Number.isFinite));
    if (!Number.isFinite(oldest)) break;
    before = new Date(oldest).toISOString();
  }
  const seen = new Set<string>();
  return rows.filter(r => {
    if (r.to !== KEY_PUBLISH_TO || !r.memo.startsWith(prefix)) return false;
    const id = `${r.txId}:${r.from}:${r.memo}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
