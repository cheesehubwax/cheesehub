// CHEESECrypt key folder: Desktop/cheesecrypt/{my private key, friends}.
// Uses the browser's folder access (Chromium only). Browsers never let a site
// write to the Desktop silently — the user picks the folder once (the picker
// requests Desktop as its starting location) and the remembered handle is reused afterwards.
// Select/create cheesecrypt there: Chromium can reject access to Desktop itself.
import { parseKeyFile, type MessagingKey, type PublicKeyFile } from './cheeseCrypt';

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
  getFileHandle(name: string, o?: { create?: boolean }): Promise<{ getFile?(): Promise<{ text(): Promise<string> }>; createWritable(): Promise<{ write(d: string): Promise<void>; close(): Promise<void>; abort?(): Promise<void> }> }>;
  values?(): AsyncIterable<{ kind: string; name: string }>;
  queryPermission?(o: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission?(o: { mode: 'readwrite' }): Promise<PermissionState>;
}

type Picker = (o: { id?: string; mode: 'readwrite'; startIn?: string }) => Promise<DirHandle>;
const picker = (): Picker | undefined =>
  typeof window !== 'undefined' ? (window as unknown as { showDirectoryPicker?: Picker }).showDirectoryPicker : undefined;

export const vaultSupported = () => !!picker() && window.self === window.top;

/** Ensures cheesecrypt/ plus both subfolders exist; reuses a picked folder already named cheesecrypt. */
export async function prepareVault(picked: DirHandle): Promise<DirHandle> {
  const root = picked.name === VAULT_DIR ? picked : await picked.getDirectoryHandle(VAULT_DIR, { create: true });
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

/** Refresh profile fields only in an existing backup of the exact same key pair. */
export async function updatePrivateKeyProfile(root: DirHandle, key: MessagingKey) {
  const incoming = parseKeyFile(key);
  if (!incoming || incoming.type !== 'gpk-msg-key') throw new Error('Invalid private key');
  const dir = await root.getDirectoryHandle(PRIVATE_DIR);
  const file = await dir.getFileHandle(privateKeyName(key.account));
  if (!file.getFile) throw new Error('Cannot verify existing backup');
  const existing = parseKeyFile(JSON.parse(await (await file.getFile()).text()));
  if (!existing || existing.type !== 'gpk-msg-key' || existing.account !== incoming.account
    || existing.publicKey !== incoming.publicKey || existing.secretKey !== incoming.secretKey) {
    throw new Error('Existing backup does not match this private key');
  }
  // File System Access stages writes until close; abort leaves the original intact.
  const writable = await file.createWritable();
  try {
    await writable.write(JSON.stringify({ ...existing, avatar: incoming.avatar, displayName: incoming.displayName }, null, 2));
    await writable.close();
  } catch (error) {
    await writable.abort?.().catch(() => {});
    throw error;
  }
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

/** Reads every valid public key file in the shared friends folder (shared by all accounts on this device). */
export async function readFriendKeys(root: DirHandle): Promise<PublicKeyFile[]> {
  let dir: DirHandle;
  try { dir = await root.getDirectoryHandle(FRIENDS_DIR); } catch { return []; }
  if (!dir.values) return [];
  const out = new Map<string, PublicKeyFile>();
  for await (const entry of dir.values()) {
    if (entry.kind !== 'file' || !entry.name.toLowerCase().endsWith('.json')) continue;
    try {
      const handle = await dir.getFileHandle(entry.name);
      if (!handle.getFile) continue;
      const parsed = parseKeyFile(JSON.parse(await (await handle.getFile()).text()));
      if (parsed?.type === 'gpk-msg-pubkey') out.set(parsed.account, parsed);
    } catch { /* skip unreadable or malformed files */ }
  }
  return [...out.values()];
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
