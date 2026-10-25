// CHEESECrypt key folder: Desktop/cheesecrypt/{my private key, friends}.
// Uses the browser's folder access (Chromium only). Browsers never let a site
// write to the Desktop silently — the user picks the folder once (the picker
// requests Desktop as its starting location) and the remembered handle is reused afterwards.
// Select/create cheesecrypt there: Chromium can reject access to Desktop itself.
import { parseKeyFile, type MessagingKey, type PublicKeyFile } from './cheeseCrypt';
import { readKeyFileJson, skipFileName } from './cryptKeyFileText';
import { parseLockedKeyFile, withProfile, type LockedKeyFile } from './cryptKeyLock';
import { parseReadStateFile, toReadStateFile, type ReadMarks } from './cryptUnread';

export const VAULT_DIR = 'cheesecrypt';
export const PRIVATE_DIR = 'my private key';
export const FRIENDS_DIR = 'friends';
export const privateKeyName = (account: string) => `${account}-cheesecrypt-key-PRIVATE.json`;
export const friendKeyName = (account: string) => `${account}-cheesecrypt-public.json`;

/** Thrown when the target file already exists — nothing is ever overwritten. */
export class VaultFileExistsError extends Error {
  constructor(public path: string) { super(`${path} already exists`); }
}

// Minimal shape of FileSystemDirectoryHandle used here (keeps this testable).
export interface DirHandle {
  name: string;
  getDirectoryHandle(name: string, o?: { create?: boolean }): Promise<DirHandle>;
  getFileHandle(name: string, o?: { create?: boolean }): Promise<{ getFile?(): Promise<{ size?: number; arrayBuffer?(): Promise<ArrayBuffer>; text(): Promise<string> }>; createWritable(): Promise<{ write(d: string): Promise<void>; close(): Promise<void>; abort?(): Promise<void> }> }>;
  values?(): AsyncIterable<{ kind: string; name: string }>;
  queryPermission?(o: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission?(o: { mode: 'readwrite' }): Promise<PermissionState>;
  isSameEntry?(other: DirHandle): Promise<boolean>;
}

type Picker = (o: { id?: string; mode: 'readwrite'; startIn?: string }) => Promise<DirHandle>;
const picker = (): Picker | undefined =>
  typeof window !== 'undefined' ? (window as unknown as { showDirectoryPicker?: Picker }).showDirectoryPicker : undefined;

export const vaultSupported = () => !!picker() && window.self === window.top;

/** Folder names accepted as the private-key folder, any casing. */
const KEY_DIR_NAMES = [PRIVATE_DIR, 'my private keys', 'private key', 'private keys'];

/** Ensures both subfolders exist; reuses a picked folder that already is (or contains) the vault. */
export async function prepareVault(picked: DirHandle): Promise<DirHandle> {
  const root = await resolveVaultRoot(picked);
  await root.getDirectoryHandle(PRIVATE_DIR, { create: true });
  await root.getDirectoryHandle(FRIENDS_DIR, { create: true });
  return root;
}

async function exists(dir: DirHandle, name: string) {
  try { await dir.getFileHandle(name); return true; }
  catch (e) { if ((e as DOMException)?.name === 'NotFoundError') return false; throw e; }
}

async function writeNew(dir: DirHandle, name: string, data: unknown, path: string) {
  if (await exists(dir, name)) throw new VaultFileExistsError(path);
  const w = await (await dir.getFileHandle(name, { create: true })).createWritable();
  await w.write(JSON.stringify(data, null, 2));
  await w.close();
}

export async function writePrivateKey(root: DirHandle, key: MessagingKey) {
  const name = privateKeyName(key.account);
  await writeNew(await root.getDirectoryHandle(PRIVATE_DIR, { create: true }), name, key, `${VAULT_DIR}/${PRIVATE_DIR}/${name}`);
}

/** Refresh profile fields only in an existing backup of the exact same key pair (plain or wallet-locked). */
export async function updatePrivateKeyProfile(root: DirHandle, key: MessagingKey) {
  const incoming = parseKeyFile(key);
  if (!incoming || incoming.type !== 'gpk-msg-key') throw new Error('Invalid private key');
  const dir = await root.getDirectoryHandle(PRIVATE_DIR);
  const file = await dir.getFileHandle(privateKeyName(key.account));
  if (!file.getFile) throw new Error('Cannot verify existing backup');
  const raw = JSON.parse(await (await file.getFile()).text());
  const existing = parseKeyFile(raw);
  const locked = existing ? null : parseLockedKeyFile(raw);
  let next: unknown;
  if (existing && existing.type === 'gpk-msg-key' && existing.account === incoming.account
    && existing.publicKey === incoming.publicKey && existing.secretKey === incoming.secretKey) {
    next = { ...existing, avatar: incoming.avatar, displayName: incoming.displayName };
  } else if (locked && locked.account === incoming.account && locked.publicKey === incoming.publicKey) {
    // Profile fields sit outside the seal; the locked secret is copied unchanged.
    next = withProfile(locked, incoming);
  } else {
    throw new Error('Existing backup does not match this private key');
  }
  await stagedWrite(file, next);
}

// File System Access stages writes until close; abort leaves the original intact.
async function stagedWrite(file: { createWritable(): Promise<{ write(d: string): Promise<void>; close(): Promise<void>; abort?(): Promise<void> }> }, data: unknown) {
  const writable = await file.createWritable();
  try {
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();
  } catch (error) {
    await writable.abort?.().catch(() => {});
    throw error;
  }
}

/**
 * Replaces this account's plain key file with its locked form, in place, only when the file holds the same key pair.
 * Writes a new file when none exists. Anything else (another key, unreadable file) is left untouched and throws.
 */
export async function replaceWithLocked(root: DirHandle, locked: LockedKeyFile, plain: MessagingKey) {
  if (locked.account !== plain.account || locked.publicKey !== plain.publicKey) throw new Error('Locked file does not match this key');
  const dir = await root.getDirectoryHandle(PRIVATE_DIR, { create: true });
  const name = privateKeyName(locked.account);
  if (!(await exists(dir, name))) { await writeNew(dir, name, locked, `${VAULT_DIR}/${PRIVATE_DIR}/${name}`); return; }
  const file = await dir.getFileHandle(name);
  if (!file.getFile) throw new Error('Cannot verify existing backup');
  const raw = JSON.parse(await (await file.getFile()).text());
  const existing = parseKeyFile(raw);
  const existingLocked = existing ? null : parseLockedKeyFile(raw);
  const same = (existing && existing.type === 'gpk-msg-key' && existing.account === plain.account && existing.publicKey === plain.publicKey && existing.secretKey === plain.secretKey)
    || (existingLocked && existingLocked.account === plain.account && existingLocked.publicKey === plain.publicKey);
  if (!same) throw new Error('Existing backup does not match this private key');
  await stagedWrite(file, locked);
}

/** Saves a friend's public key. `replace` (explicit user save) refreshes an existing file for that friend. */
export async function writeFriendKey(root: DirHandle, file: PublicKeyFile, replace = false) {
  const name = friendKeyName(file.account);
  const dir = await root.getDirectoryHandle(FRIENDS_DIR, { create: true });
  if (!replace) { await writeNew(dir, name, file, `${VAULT_DIR}/${FRIENDS_DIR}/${name}`); return; }
  const writable = await (await dir.getFileHandle(name, { create: true })).createWritable();
  try { await writable.write(JSON.stringify(file, null, 2)); await writable.close(); }
  catch (error) { await writable.abort?.().catch(() => {}); throw error; }
}

/** Saves (or refreshes) your own public key beside your private key, ready for sharing. */
export async function writeOwnPublicKey(root: DirHandle, file: PublicKeyFile) {
  if (file.type !== 'gpk-msg-pubkey' || 'secretKey' in file) throw new Error('Not a public key file');
  const dir = await root.getDirectoryHandle(PRIVATE_DIR, { create: true });
  const writable = await (await dir.getFileHandle(friendKeyName(file.account), { create: true })).createWritable();
  try { await writable.write(JSON.stringify(file, null, 2)); await writable.close(); }
  catch (error) { await writable.abort?.().catch(() => {}); throw error; }
}

/** Exact name first, then any casing ("My Private Key", "FRIENDS"); null when missing. */
async function findSubdir(root: DirHandle, name: string): Promise<DirHandle | null> {
  try { return await root.getDirectoryHandle(name); } catch { /* try other casings */ }
  if (!root.values) return null;
  for await (const e of root.values()) {
    if (e.kind === 'directory' && e.name.toLowerCase() === name.toLowerCase()) {
      try { return await root.getDirectoryHandle(e.name); } catch { return null; }
    }
  }
  return null;
}

/** Every file in a folder that parses as a CHEESECrypt key file, whatever its name, extension or text encoding. */
async function keyFilesIn(dir: DirHandle): Promise<(MessagingKey | PublicKeyFile | LockedKeyFile)[]> {
  if (!dir.values) return [];
  const names: string[] = [];
  for await (const e of dir.values()) if (e.kind === 'file' && !skipFileName(e.name)) names.push(e.name);
  names.sort();
  const out: (MessagingKey | PublicKeyFile | LockedKeyFile)[] = [];
  for (const name of names) {
    try {
      const handle = await dir.getFileHandle(name);
      if (!handle.getFile) continue;
      const json = await readKeyFileJson(await handle.getFile());
      const parsed = parseKeyFile(json) ?? parseLockedKeyFile(json);
      if (parsed) out.push(parsed);
    } catch { /* skip unreadable files */ }
  }
  return out;
}

/**
 * Resolves whatever the user picked to the vault root. The cheesecrypt folder itself, a key or friends
 * folder, a folder containing cheesecrypt, or a folder already holding key files are used as-is;
 * anything else (such as a fresh Desktop) gets cheesecrypt created inside it by prepareVault.
 */
export async function resolveVaultRoot(picked: DirHandle): Promise<DirHandle> {
  const name = picked.name.toLowerCase();
  if (name === VAULT_DIR || name === FRIENDS_DIR || KEY_DIR_NAMES.includes(name)) return picked;
  const inner = await findSubdir(picked, VAULT_DIR);
  if (inner) return inner;
  for (const n of KEY_DIR_NAMES) if (await findSubdir(picked, n)) return picked;
  if (await findSubdir(picked, FRIENDS_DIR)) return picked;
  if ((await keyFilesIn(picked)).length > 0) return picked;
  return picked.getDirectoryHandle(VAULT_DIR, { create: true });
}

const MAX_SCAN_DEPTH = 3;
const isKeyDirName = (n: string) => KEY_DIR_NAMES.includes(n.toLowerCase());

/**
 * Walks the vault for private key files: key-named folders first, then the folder itself, then other
 * subfolders (a stray nested cheesecrypt included), skipping friends/. Bounded depth; content decides.
 */
async function scanPrivateKeys(root: DirHandle): Promise<(MessagingKey | LockedKeyFile)[]> {
  const keys: (MessagingKey | LockedKeyFile)[] = [];
  const walk = async (dir: DirHandle, depth: number) => {
    for (const f of await keyFilesIn(dir)) if (f.type === 'gpk-msg-key') keys.push(f as MessagingKey | LockedKeyFile);
    if (depth >= MAX_SCAN_DEPTH || !dir.values) return;
    const subdirs: string[] = [];
    for await (const e of dir.values()) if (e.kind === 'directory' && e.name.toLowerCase() !== FRIENDS_DIR) subdirs.push(e.name);
    subdirs.sort((a, b) => Number(isKeyDirName(b)) - Number(isKeyDirName(a)));
    for (const n of subdirs) {
      try { await walk(await dir.getDirectoryHandle(n), depth + 1); } catch { /* unreadable folder */ }
    }
  };
  await walk(root, 0);
  return keys;
}

/** Reads every valid public key file in the shared friends folder (shared by all accounts on this device). */
export async function readFriendKeys(root: DirHandle): Promise<PublicKeyFile[]> {
  const dir = await findSubdir(root, FRIENDS_DIR);
  if (!dir) return [];
  const out = new Map<string, PublicKeyFile>();
  for (const f of await keyFilesIn(dir)) if (f.type === 'gpk-msg-pubkey') out.set(f.account, f as PublicKeyFile);
  return [...out.values()];
}

/**
 * Finds this account's private key in the vault by contents: key-named folders first, then the vault
 * folder itself, then other subfolders. File names never matter. Null when no file holds a valid key.
 */
export async function findPrivateKey(root: DirHandle, account: string): Promise<MessagingKey | LockedKeyFile | null> {
  const wanted = account.trim().toLowerCase();
  return (await scanPrivateKeys(root)).find(f => f.account.trim().toLowerCase() === wanted) ?? null;
}

/** Accounts of the private keys found in the vault; used to explain a miss. */
export async function listPrivateKeyAccounts(root: DirHandle): Promise<string[]> {
  return [...new Set((await scanPrivateKeys(root)).map(k => k.account))];
}

export const readStateName = (account: string) => `${account}-cheesecrypt-reads.json`;

/** This account's read markers saved in the vault; null when there is no valid file. */
export async function readVaultMarks(root: DirHandle, account: string): Promise<ReadMarks | null> {
  try {
    const handle = await root.getFileHandle(readStateName(account));
    return handle.getFile ? parseReadStateFile(await readKeyFileJson(await handle.getFile()), account) : null;
  } catch { return null; }
}

/** Replaces the vault's read-state file (staged write; abort keeps the old copy). */
export async function writeVaultMarks(root: DirHandle, account: string, marks: ReadMarks) {
  const w = await (await root.getFileHandle(readStateName(account), { create: true })).createWritable();
  try { await w.write(JSON.stringify(toReadStateFile(account, marks), null, 2)); await w.close(); }
  catch (error) { await w.abort?.().catch(() => {}); throw error; }
}

/** Requests Desktop as the picker's starting location; users create/select cheesecrypt there. */
export async function pickVault(): Promise<DirHandle> {
  const p = picker();
  if (!p) throw new Error('This browser cannot create folders');
  return prepareVault(await p({ id: 'cheesecrypt', mode: 'readwrite', startIn: 'desktop' }));
}

// ---- remembered folder (IndexedDB; folder handles can't go in localStorage) ----
const DB = 'cheesecrypt-vault';
const STORE = 'handles';
function db(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
// One folder serves every account on this device (private keys sit side by side, friends are shared).
const SHARED = '*shared*';
export async function rememberVault(account: string, h: DirHandle) {
  const d = await db();
  await new Promise<void>((res, rej) => {
    const t = d.transaction(STORE, 'readwrite'); t.objectStore(STORE).put(h, account); t.objectStore(STORE).put(h, SHARED);
    t.oncomplete = () => res(); t.onerror = () => rej(t.error);
  });
}
export async function recallVault(account: string): Promise<DirHandle | null> {
  if (typeof indexedDB === 'undefined') return null;
  try {
    const d = await db();
    return await new Promise((res) => {
      const store = d.transaction(STORE).objectStore(STORE);
      const r = store.get(SHARED);
      r.onsuccess = () => {
        if (r.result) { res(r.result as DirHandle); return; }
        const own = store.get(account);
        own.onsuccess = () => res((own.result as DirHandle) ?? null); own.onerror = () => res(null);
      };
      r.onerror = () => res(null);
    });
  } catch { return null; }
}

/** True when we may write; asks only if `ask` (must be inside a click). */
export async function vaultWritable(h: DirHandle, ask: boolean) {
  if (!h.queryPermission) return true;
  if ((await h.queryPermission({ mode: 'readwrite' })) === 'granted') return true;
  return ask && !!h.requestPermission && (await h.requestPermission({ mode: 'readwrite' })) === 'granted';
}

/** True when the error means the folder (or a file in it) no longer exists on disk. */
export const isMissingFolderError = (e: unknown) =>
  ['NotFoundError', 'InvalidStateError'].includes((e as DOMException)?.name);

/**
 * Whether a remembered folder still exists. Needs read access already granted; a handle to a folder
 * that was deleted or moved fails on first read. Other errors (such as missing permission) are not
 * proof the folder is gone, so they count as present.
 */
export async function vaultExists(h: DirHandle): Promise<boolean> {
  try {
    if (h.values) { for await (const _entry of h.values()) break; }
    return true;
  } catch (e) { return !isMissingFolderError(e); }
}

/** "ready" when usable now, "needs-permission" when a click must grant access, "missing" when deleted or moved. */
export async function vaultStatus(h: DirHandle): Promise<'ready' | 'needs-permission' | 'missing'> {
  if (h.queryPermission && (await h.queryPermission({ mode: 'readwrite' }).catch(() => 'denied' as PermissionState)) !== 'granted')
    return 'needs-permission';
  return (await vaultExists(h)) ? 'ready' : 'missing';
}

/** Forgets the remembered folder, but only if it is still the given one (a newer pick is never erased). */
export async function forgetVault(h: DirHandle): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const cur = await recallVault('');
    if (!cur) return;
    if (cur !== h) {
      // Each read from storage is a new object, so compare the folders themselves; unprovable means keep it.
      const same = cur.isSameEntry ? await cur.isSameEntry(h).catch(() => false) : false;
      if (!same) return;
    }
    const d = await db();
    await new Promise<void>((res, rej) => {
      const t = d.transaction(STORE, 'readwrite'); t.objectStore(STORE).delete(SHARED);
      t.oncomplete = () => res(); t.onerror = () => rej(t.error);
    });
  } catch { /* nothing remembered */ }
}
