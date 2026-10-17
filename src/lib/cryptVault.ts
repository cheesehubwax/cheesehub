// CHEESECrypt key folder: Desktop/cheesecrypt/{my private key, friends}.
// Uses the browser's folder access (Chromium only). Browsers never let a site
// write to the Desktop silently — the user picks the folder once (the picker
// requests Desktop as its starting location) and the remembered handle is reused afterwards.
// Select/create cheesecrypt there: Chromium can reject access to Desktop itself.
import type { MessagingKey, PublicKeyFile } from './cheeseCrypt';

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
  getFileHandle(name: string, o?: { create?: boolean }): Promise<{ createWritable(): Promise<{ write(d: string): Promise<void>; close(): Promise<void> }> }>;
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

export async function writeFriendKey(root: DirHandle, file: PublicKeyFile) {
  const name = friendKeyName(file.account);
  await writeNew(await root.getDirectoryHandle(FRIENDS_DIR, { create: true }), name, file, `${VAULT_DIR}/${FRIENDS_DIR}/${name}`);
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
export async function rememberVault(account: string, h: DirHandle) {
  const d = await db();
  await new Promise<void>((res, rej) => {
    const t = d.transaction(STORE, 'readwrite'); t.objectStore(STORE).put(h, account);
    t.oncomplete = () => res(); t.onerror = () => rej(t.error);
  });
}
export async function recallVault(account: string): Promise<DirHandle | null> {
  if (typeof indexedDB === 'undefined') return null;
  try {
    const d = await db();
    return await new Promise((res) => {
      const r = d.transaction(STORE).objectStore(STORE).get(account);
      r.onsuccess = () => res((r.result as DirHandle) ?? null); r.onerror = () => res(null);
    });
  } catch { return null; }
}

/** True when we may write; asks only if `ask` (must be inside a click). */
export async function vaultWritable(h: DirHandle, ask: boolean) {
  if (!h.queryPermission) return true;
  if ((await h.queryPermission({ mode: 'readwrite' })) === 'granted') return true;
  return ask && !!h.requestPermission && (await h.requestPermission({ mode: 'readwrite' })) === 'granted';
}
