/**
 * Air-gapped device transfer: the Anchor-locked key envelope plus this account's local CHEESECrypt
 * lists are compressed, encrypted with a one-time code (PBKDF2 → AES-256-GCM) and shown as cycling
 * QR frames. Nothing touches the network. The key stays wallet-sealed; plain keys are never exported.
 */
import { parseLockedKeyFile, type LockedKeyFile } from '@/lib/cryptKeyLock';

export const TRANSFER_PREFIX = 'CXFER1';
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 symbols, no 0/O/1/I
export const CODE_LENGTH = 12; // 60 bits
export const FRAME_CHARS = 700;
export const PBKDF2_ITERATIONS = 600_000;
const ACCOUNT = /^[a-z1-5.]{1,12}$/;
const ID = /^[a-f0-9]{8}$/;

/** Local stores that move with the account (`cheesecrypt-<kind>-<account>`). Instant keys, read marks and safety marks never move. */
export const OBJECT_KINDS = ['contacts', 'avatars', 'names', 'nicknames', 'room-requests', 'listed-rooms', 'join-declines', 'invite-groups', 'invite-decisions'] as const;
export const ARRAY_KINDS = ['removed-contacts', 'blocked', 'groups', 'hidden-groups', 'invite-friend-decisions'] as const;
type Kind = typeof OBJECT_KINDS[number] | typeof ARRAY_KINDS[number];
const storeKey = (kind: Kind, account: string) => `cheesecrypt-${kind}-${account}`;

export interface TransferBundle {
  v: 1; account: string; lockedKey: LockedKeyFile; createdAt: number;
  stores: Partial<Record<Kind, unknown>>;
}

export interface StorageLike { getItem(k: string): string | null; setItem(k: string, v: string): void }

const readJson = (s: StorageLike, k: string): unknown => { try { return JSON.parse(s.getItem(k) || 'null'); } catch { return null; } };
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

export function buildBundle(account: string, lockedKey: unknown, storage: StorageLike = localStorage, now = Date.now()): TransferBundle {
  const locked = parseLockedKeyFile(lockedKey);
  if (!locked || locked.account !== account) throw new Error('Only a wallet-locked key can be moved to another device.');
  const stores: TransferBundle['stores'] = {};
  for (const k of OBJECT_KINDS) { const v = readJson(storage, storeKey(k, account)); if (isObj(v) && Object.keys(v).length) stores[k] = v; }
  for (const k of ARRAY_KINDS) { const v = readJson(storage, storeKey(k, account)); if (Array.isArray(v) && v.length) stores[k] = v; }
  return { v: 1, account, lockedKey: locked, createdAt: now, stores };
}

export function summarize(b: TransferBundle) {
  const count = (k: Kind) => { const v = b.stores[k]; return Array.isArray(v) ? v.length : isObj(v) ? Object.keys(v).length : 0; };
  return { friends: count('contacts'), nicknames: count('nicknames'), rooms: count('invite-groups') + count('groups'), blocked: count('blocked') };
}

const stamp = (v: unknown) => isObj(v) ? (typeof v.at === 'number' ? v.at : typeof v.time === 'number' ? v.time : typeof v.c === 'number' ? v.c : null) : typeof v === 'number' ? v : null;

/** Merge into this device: nothing is wiped; timestamped entries keep the newer one, others keep this device's copy. */
export function mergeBundle(b: TransferBundle, storage: StorageLike = localStorage) {
  const a = b.account;
  const localRemoved = new Set((readJson(storage, storeKey('removed-contacts', a)) as unknown[] | null ?? []).filter((x): x is string => typeof x === 'string'));
  for (const k of OBJECT_KINDS) {
    const incoming = b.stores[k];
    if (!isObj(incoming)) continue;
    const local = readJson(storage, storeKey(k, a));
    const out: Record<string, unknown> = isObj(local) ? { ...local } : {};
    for (const [id, v] of Object.entries(incoming)) {
      if (id === '__proto__' || id === 'constructor' || id === 'prototype') continue;
      if ((k === 'contacts' || k === 'avatars') && localRemoved.has(id)) continue;
      if (!(id in out)) { out[id] = v; continue; }
      const ni = stamp(v), lo = stamp(out[id]);
      if (k === 'join-declines' && typeof v === 'number' && typeof out[id] === 'number') out[id] = Math.max(v, out[id] as number);
      else if (ni !== null && lo !== null && ni > lo) out[id] = v;
    }
    storage.setItem(storeKey(k, a), JSON.stringify(out));
  }
  for (const k of ARRAY_KINDS) {
    const incoming = b.stores[k];
    if (!Array.isArray(incoming)) continue;
    const local = readJson(storage, storeKey(k, a));
    const base = Array.isArray(local) ? local : [];
    let out: unknown[];
    if (k === 'groups') {
      const ids = new Set(base.map(g => isObj(g) ? g.id : null));
      out = [...base, ...incoming.filter(g => isObj(g) && typeof g.id === 'string' && !ids.has(g.id))];
    } else {
      out = [...new Set([...base, ...incoming].filter((x): x is string => typeof x === 'string'))];
    }
    if (k === 'removed-contacts') {
      const contacts = readJson(storage, storeKey('contacts', a));
      if (isObj(contacts)) out = out.filter(n => !(typeof n === 'string' && n in contacts && !localRemoved.has(n)));
    }
    storage.setItem(storeKey(k, a), JSON.stringify(out));
  }
}

function validBundle(raw: unknown, account: string): TransferBundle | null {
  if (!isObj(raw) || raw.v !== 1 || raw.account !== account || typeof raw.createdAt !== 'number' || !isObj(raw.stores)) return null;
  const locked = parseLockedKeyFile(raw.lockedKey);
  if (!locked || locked.account !== account) return null;
  const stores: TransferBundle['stores'] = {};
  for (const k of OBJECT_KINDS) if (k in raw.stores) { const v = raw.stores[k]; if (!isObj(v)) return null; stores[k] = v; }
  for (const k of ARRAY_KINDS) if (k in raw.stores) { const v = raw.stores[k]; if (!Array.isArray(v)) return null; stores[k] = v; }
  const contacts = stores.contacts as Record<string, unknown> | undefined;
  if (contacts) for (const [n, pk] of Object.entries(contacts)) if (!ACCOUNT.test(n) || typeof pk !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(pk)) return null;
  return { v: 1, account, lockedKey: locked, createdAt: raw.createdAt, stores };
}

// ---- one-time code ----
export function generateCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return Array.from(bytes, b => CODE_ALPHABET[b & 31]).join('');
}
export const formatCode = (c: string) => c.match(/.{1,4}/g)?.join('-') ?? c;
export const normalizeCode = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, '');

// ---- crypto ----
const enc = new TextEncoder();
const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s: string) => { const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - s.length % 4) % 4)); return Uint8Array.from(bin, c => c.charCodeAt(0)); };
async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream) {
  return new Uint8Array(await new Response(new Response(data).body!.pipeThrough(stream)).arrayBuffer());
}
async function deriveKey(code: string, salt: Uint8Array, iterations: number) {
  const base = await crypto.subtle.importKey('raw', enc.encode(normalizeCode(code)), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
const aad = (id: string, account: string) => enc.encode(`${TRANSFER_PREFIX}:${id}:${account}`);

export async function encryptBundle(b: TransferBundle, code: string, iterations = PBKDF2_ITERATIONS): Promise<string[]> {
  const id = Array.from(crypto.getRandomValues(new Uint8Array(4)), x => x.toString(16).padStart(2, '0')).join('');
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const packed = await pipe(enc.encode(JSON.stringify(b)), new CompressionStream('deflate-raw'));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(id, b.account) }, await deriveKey(code, salt, iterations), packed));
  const blob = new Uint8Array(salt.length + iv.length + ct.length);
  blob.set(salt); blob.set(iv, 16); blob.set(ct, 28);
  const data = b64u(blob);
  const chunks = data.match(new RegExp(`.{1,${FRAME_CHARS}}`, 'g')) ?? [];
  return chunks.map((c, i) => `${TRANSFER_PREFIX}:${id}:${b.account}:${i + 1}/${chunks.length}:${c}`);
}

export interface Frame { id: string; account: string; n: number; total: number; data: string }
export function parseFrame(s: string): Frame | null {
  const m = /^CXFER1:([a-f0-9]{8}):([a-z1-5.]{1,12}):(\d{1,3})\/(\d{1,3}):([A-Za-z0-9_-]+)$/.exec(s.trim());
  if (!m) return null;
  const n = +m[3], total = +m[4];
  if (!ID.test(m[1]) || n < 1 || total < 1 || n > total || total > 64) return null;
  return { id: m[1], account: m[2], n, total, data: m[5] };
}

/** Collects frames of one transfer; a frame from a different transfer restarts collection. */
export class FrameCollector {
  id: string | null = null; account = ''; total = 0; parts = new Map<number, string>();
  add(raw: string): boolean {
    const f = parseFrame(raw);
    if (!f) return false;
    if (f.id !== this.id || f.total !== this.total || f.account !== this.account) { this.id = f.id; this.account = f.account; this.total = f.total; this.parts = new Map(); }
    this.parts.set(f.n, f.data);
    return true;
  }
  get complete() { return this.total > 0 && this.parts.size === this.total; }
  joined() { return Array.from({ length: this.total }, (_, i) => this.parts.get(i + 1) ?? '').join(''); }
}

export async function decryptFrames(frames: readonly string[], code: string, account: string, iterations = PBKDF2_ITERATIONS): Promise<TransferBundle> {
  const c = new FrameCollector();
  for (const f of frames) for (const line of f.split(/\s+/)) if (line) c.add(line);
  if (!c.complete) throw new Error('Some parts of the transfer are missing. Keep scanning.');
  if (c.account !== account) throw new Error(`This transfer is for ${c.account}. Connect that account first.`);
  const blob = unb64u(c.joined());
  if (blob.length < 29) throw new Error('The transfer is damaged.');
  let plain: Uint8Array;
  try {
    plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: blob.slice(16, 28), additionalData: aad(c.id!, account) }, await deriveKey(code, blob.slice(0, 16), iterations), blob.slice(28)));
  } catch { throw new Error('Wrong code, or the transfer was changed.'); }
  const bundle = validBundle(JSON.parse(new TextDecoder().decode(await pipe(plain, new DecompressionStream('deflate-raw')))), account);
  if (!bundle) throw new Error('The transfer contents are not valid.');
  return bundle;
}
