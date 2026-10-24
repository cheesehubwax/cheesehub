/**
 * Wallet-locked CHEESECrypt key files (CHEESECrypt's own scheme, never WAXCrypt's).
 * The messaging secret key is sealed with a key derived from an Anchor signature over a fixed,
 * already-expired, zero-amount CHEESE transfer that is never broadcast. Only the WAX account's own
 * wallet can reproduce that signature, so a copied locked file is useless on its own.
 */
import nacl from 'tweetnacl';
import { decodeBase64, encodeBase64, decodeUTF8 } from 'tweetnacl-util';
import { parseAvatar, type CryptAvatar } from '@/lib/cryptAvatar';
import { parseCryptName } from '@/lib/cryptNames';
import type { MessagingKey } from '@/lib/cheeseCrypt';

export const LOCK_SCHEME = 'cheesecrypt-anchor-sig-v1';
const DOMAIN = 'CHEESECrypt-keylock-v1';
/** Fixed past expiry: the lock transaction can never be accepted by the chain. */
export const LOCK_TX_EXPIRATION = '2020-01-01T00:00:00';
export const LOCK_TOKEN_CONTRACT = 'cheeseburger';
export const LOCK_QUANTITY = '0.0000 CHEESE';
export const LOCK_MEMO_PREFIX = 'CHEESECrypt key lock v1 ';

export interface KeyLock { scheme: typeof LOCK_SCHEME; salt: string; nonce: string; ciphertext: string }

/** Version 2 private key file: the secret is sealed to the owning WAX account's wallet. */
export interface LockedKeyFile {
  type: 'gpk-msg-key';
  version: 2;
  account: string;
  publicKey: string;
  lock: KeyLock;
  created: string;
  avatar?: CryptAvatar;
  displayName?: string;
}

/** Deterministic transaction the wallet signs; zero amount + 2020 expiry make it doubly unbroadcastable. */
export function buildLockTransaction(account: string, permission: string, publicKey: string) {
  return {
    expiration: LOCK_TX_EXPIRATION,
    ref_block_num: 1,
    ref_block_prefix: 1,
    max_net_usage_words: 0,
    max_cpu_usage_ms: 0,
    delay_sec: 0,
    actions: [{
      account: LOCK_TOKEN_CONTRACT,
      name: 'transfer',
      authorization: [{ actor: account, permission }],
      data: { from: account, to: 'eosio.null', quantity: LOCK_QUANTITY, memo: LOCK_MEMO_PREFIX + publicKey },
    }],
  };
}

const SIG_RE = /^SIG_[A-Z0-9]+_[1-9A-HJ-NP-Za-km-z]+$/;

async function deriveKey(signature: string, salt: Uint8Array): Promise<Uint8Array> {
  if (!SIG_RE.test(signature)) throw new Error('The wallet returned an invalid signature');
  const d = decodeUTF8(DOMAIN), s = decodeUTF8(signature);
  const buf = new Uint8Array(d.length + salt.length + s.length);
  buf.set(d, 0); buf.set(salt, d.length); buf.set(s, d.length + salt.length);
  return new Uint8Array(await crypto.subtle.digest('SHA-256', buf));
}

export async function lockSecret(secretKeyB64: string, signature: string): Promise<KeyLock> {
  const salt = nacl.randomBytes(16);
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const key = await deriveKey(signature, salt);
  return { scheme: LOCK_SCHEME, salt: encodeBase64(salt), nonce: encodeBase64(nonce), ciphertext: encodeBase64(nacl.secretbox(decodeBase64(secretKeyB64), nonce, key)) };
}

/** Returns the Base64 secret key, or throws if the signature is wrong or the file was altered. */
export async function unlockSecret(lock: KeyLock, signature: string, publicKeyB64: string): Promise<string> {
  if (lock.scheme !== LOCK_SCHEME) throw new Error('Unsupported key lock');
  const key = await deriveKey(signature, decodeBase64(lock.salt));
  let secret: Uint8Array | null = null;
  try { secret = nacl.secretbox.open(decodeBase64(lock.ciphertext), decodeBase64(lock.nonce), key); } catch { secret = null; }
  if (!secret || secret.length !== nacl.box.secretKeyLength) throw new Error('This wallet could not unlock the key file');
  if (encodeBase64(nacl.box.keyPair.fromSecretKey(secret).publicKey) !== publicKeyB64) throw new Error('Key file is damaged: secret does not match its public key');
  return encodeBase64(secret);
}

const b64Len = (v: unknown, len: number) => {
  if (typeof v !== 'string') return false;
  try { return decodeBase64(v).length === len; } catch { return false; }
};

/** Strict parse of a v2 locked file; null for anything else (plain v1 files go through parseKeyFile). */
export function parseLockedKeyFile(raw: unknown): LockedKeyFile | null {
  const o = raw as Record<string, unknown> | null;
  if (!o || typeof o !== 'object' || o.type !== 'gpk-msg-key' || o.version !== 2) return null;
  if (typeof o.account !== 'string' || !o.account || !b64Len(o.publicKey, 32)) return null;
  if ('secretKey' in o) return null;
  const l = o.lock as Record<string, unknown> | null;
  if (!l || l.scheme !== LOCK_SCHEME || !b64Len(l.salt, 16) || !b64Len(l.nonce, nacl.secretbox.nonceLength) || typeof l.ciphertext !== 'string' || !b64Len(l.ciphertext, 32 + nacl.secretbox.overheadLength)) return null;
  const avatar = parseAvatar(o.avatar), displayName = parseCryptName(o.displayName);
  return {
    type: 'gpk-msg-key', version: 2, account: o.account, publicKey: o.publicKey as string,
    lock: { scheme: LOCK_SCHEME, salt: l.salt as string, nonce: l.nonce as string, ciphertext: l.ciphertext },
    created: typeof o.created === 'string' ? o.created : '',
    ...(avatar ? { avatar } : {}), ...(displayName ? { displayName } : {}),
  };
}

export function toLockedFile(k: MessagingKey, lock: KeyLock): LockedKeyFile {
  const displayName = parseCryptName(k.displayName);
  return { type: 'gpk-msg-key', version: 2, account: k.account, publicKey: k.publicKey, lock, created: k.created, ...(k.avatar ? { avatar: k.avatar } : {}), ...(displayName ? { displayName } : {}) };
}

export function fromLockedFile(f: LockedKeyFile, secretKey: string): MessagingKey {
  return { type: 'gpk-msg-key', version: 1, account: f.account, publicKey: f.publicKey, secretKey, created: f.created, avatar: f.avatar, displayName: f.displayName };
}

/** Copies the current (unsealed) profile fields onto a locked envelope; the sealed secret never changes. */
export const withProfile = (f: LockedKeyFile, k: Pick<MessagingKey, 'avatar' | 'displayName'>): LockedKeyFile => {
  const { avatar: _a, displayName: _d, ...rest } = f;
  const displayName = parseCryptName(k.displayName);
  return { ...rest, ...(k.avatar ? { avatar: k.avatar } : {}), ...(displayName ? { displayName } : {}) };
};

// The browser remembers the locked envelope (no secret inside) so Back up hands out the locked file.
const envelopeStore = (a: string) => `cheesecrypt-keylock-${a}`;
export function loadLockedEnvelope(account: string, publicKey?: string): LockedKeyFile | null {
  try {
    const f = parseLockedKeyFile(JSON.parse(localStorage.getItem(envelopeStore(account)) || 'null'));
    return f && f.account === account && (!publicKey || f.publicKey === publicKey) ? f : null;
  } catch { return null; }
}
export const saveLockedEnvelope = (f: LockedKeyFile) => localStorage.setItem(envelopeStore(f.account), JSON.stringify(f));
export const clearLockedEnvelope = (account: string) => localStorage.removeItem(envelopeStore(account));

export const ANCHOR_REQUIRED = 'Locking and unlocking keys needs the Anchor wallet.';

interface LockSession {
  actor: { toString(): string };
  permission: { toString(): string };
  walletPlugin: { id: string };
  transact(args: unknown, options: unknown): Promise<{ resolved?: { transaction: { expiration: { toString(): string } } }; signatures: { toString(): string }[] }>;
}

export const isAnchorSession = (s: { walletPlugin?: { id?: unknown } } | null | undefined) => String(s?.walletPlugin?.id ?? '') === 'anchor';

/** Free, never-broadcast Anchor signature over the fixed lock transaction. */
export async function signLock(session: LockSession, publicKey: string): Promise<string> {
  if (!isAnchorSession(session)) throw new Error(ANCHOR_REQUIRED);
  const result = await session.transact(
    buildLockTransaction(String(session.actor), String(session.permission), publicKey),
    { broadcast: false, allowModify: false, transactPlugins: [] },
  );
  if (String(result.resolved?.transaction.expiration) !== LOCK_TX_EXPIRATION) throw new Error('The wallet changed the lock request; nothing was locked');
  if (result.signatures.length !== 1) throw new Error('The wallet did not return exactly one signature');
  return String(result.signatures[0]);
}

/** Signs twice and refuses to lock unless both match and the sealed file reopens to the same secret. */
export async function sealKey(sign: (publicKey: string) => Promise<string>, key: MessagingKey, account: string): Promise<LockedKeyFile> {
  if (key.account !== account) throw new Error(`This key belongs to ${key.account}, not ${account}`);
  const first = await sign(key.publicKey);
  const second = await sign(key.publicKey);
  if (first !== second) throw new Error("Your wallet gave two different signatures, so it can't lock keys. Nothing was locked.");
  const file = toLockedFile(key, await lockSecret(key.secretKey, first));
  if ((await unlockSecret(file.lock, second, file.publicKey)) !== key.secretKey) throw new Error('Lock check failed. Nothing was locked.');
  return file;
}

export async function openLockedKey(sign: (publicKey: string) => Promise<string>, file: LockedKeyFile, account: string): Promise<MessagingKey> {
  if (file.account !== account) throw new Error(`This key is locked to ${file.account}. Sign in with that Anchor account to unlock it.`);
  return fromLockedFile(file, await unlockSecret(file.lock, await sign(file.publicKey), file.publicKey));
}
