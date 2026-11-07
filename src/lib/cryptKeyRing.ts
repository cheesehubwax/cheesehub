/**
 * CHEESECrypt key rotation (pure helpers + device-local settings).
 *
 * Rotation is stealth by default: the new public key is never posted publicly. Each friend gets a rotate
 * notice encrypted with a key they already know me by (an old key), so only the real holder of that old key
 * could have written it. Retired keys stay sealed inside the locked key file for reading until they expire.
 */
import {
  buildPublishKeyActions, buildSendMessageActions, encryptMemo, MESSAGE_FEE_QUANTITY, splitMessage,
  type MessagingKey, type RetiredKey,
} from '@/lib/cheeseCrypt';
import { groupMessageCost } from '@/lib/cryptGroups';
import { decodeBase64 } from 'tweetnacl-util';

export const DAY_MS = 86_400_000;
export const ROTATE_PREFIX = '\u0002CR1:';
export const NUDGE_DAYS = 90;
export const SNOOZE_DAYS = 30;
/** Most recent retired keys a notice is sent from (friends who missed several rotations still catch up). */
export const MAX_NOTICE_SOURCES = 3;
export const ROTATE_RECIPIENTS_PER_TX = 15;

// ---- retention ----
/** Days a retired key is kept for reading; 0 = destroy as soon as it is safe; null = forever. */
export const RETENTION_OPTIONS = [0, 7, 30, 90, null] as const;
export type Retention = typeof RETENTION_OPTIONS[number];
export const DEFAULT_RETENTION: Retention = 30;
const retentionStore = (a: string) => `cheesecrypt-key-retention-${a}`;
export function loadRetention(account: string): Retention {
  try {
    const raw = localStorage.getItem(retentionStore(account));
    if (raw === null) return DEFAULT_RETENTION;
    if (raw === 'forever') return null;
    const n = Number(raw);
    return (RETENTION_OPTIONS as readonly (number | null)[]).includes(n) ? n as Retention : DEFAULT_RETENTION;
  } catch { return DEFAULT_RETENTION; }
}
export const saveRetention = (account: string, r: Retention) => {
  try { localStorage.setItem(retentionStore(account), r === null ? 'forever' : String(r)); } catch { /* ignore */ }
};
export const retentionLabel = (r: Retention) => r === null ? 'Forever' : r === 0 ? 'Destroy now' : `${r} days`;
export const expiryFor = (retiredAt: number, r: Retention): string | null => r === null ? null : new Date(retiredAt + r * DAY_MS).toISOString();

// ---- age + nudge ----
export function keyAgeDays(created: string, now: number): number | null {
  const t = Date.parse(created);
  return Number.isNaN(t) ? null : Math.max(0, Math.floor((now - t) / DAY_MS));
}
const snoozeStore = (a: string) => `cheesecrypt-rotate-snooze-${a}`;
export const loadSnooze = (account: string) => { try { return Number(localStorage.getItem(snoozeStore(account))) || 0; } catch { return 0; } };
export const saveSnooze = (account: string, until: number) => { try { localStorage.setItem(snoozeStore(account), String(until)); } catch { /* ignore */ } };
export function shouldNudge(now: number, created: string, snoozedUntil: number): boolean {
  const age = keyAgeDays(created, now);
  return age !== null && age >= NUDGE_DAYS && now >= snoozedUntil;
}

// ---- rotate notices ----
const validPub = (k: unknown) => { if (typeof k !== 'string') return false; try { return decodeBase64(k).length === 32; } catch { return false; } };
export const encodeRotateNotice = (newPublicKey: string, time: number) => ROTATE_PREFIX + JSON.stringify({ k: newPublicKey, t: time });
export const isRotateNotice = (text: string | null | undefined) => !!text && text.startsWith(ROTATE_PREFIX);
export function parseRotateNotice(text: string | null | undefined): { k: string; t: number } | null {
  if (!isRotateNotice(text)) return null;
  try {
    const raw = JSON.parse(text!.slice(ROTATE_PREFIX.length));
    return validPub(raw?.k) && Number.isSafeInteger(raw?.t) && raw.t > 0 ? { k: raw.k, t: raw.t } : null;
  } catch { return null; }
}

/**
 * Key changes to apply on the receiving side, in chain order. A notice counts only when it is complete, came from a
 * friend, and was opened with that friend's CURRENT key (`usedKey`), so a stolen retired key can never redirect a friend.
 */
export function pendingContactRotations(
  entries: readonly { from: string; time: number; text: string | null; missing: number; usedKey?: string; group?: unknown; igroup?: string }[],
  account: string, contacts: Record<string, string>, previous: Record<string, string[]>,
): { from: string; publicKey: string }[] {
  const current = { ...contacts };
  const out: { from: string; publicKey: string }[] = [];
  for (const e of [...entries].sort((a, b) => a.time - b.time)) {
    if (e.from === account || e.missing || e.group || e.igroup || !current[e.from] || e.usedKey !== current[e.from]) continue;
    const n = parseRotateNotice(e.text);
    if (!n || n.k === current[e.from] || previous[e.from]?.includes(n.k)) continue;
    current[e.from] = n.k;
    out.push({ from: e.from, publicKey: n.k });
  }
  return out;
}

// ---- my rotation state (who has been told my current key) ----
export interface RotationState { to: string; announced: string[] }
const rotationStore = (a: string) => `cheesecrypt-rotation-${a}`;
export function loadRotation(account: string): RotationState | null {
  try {
    const raw = JSON.parse(localStorage.getItem(rotationStore(account)) || 'null');
    return raw && validPub(raw.to) && Array.isArray(raw.announced) ? { to: raw.to, announced: raw.announced.filter((a: unknown): a is string => typeof a === 'string') } : null;
  } catch { return null; }
}
export const saveRotation = (account: string, s: RotationState) => localStorage.setItem(rotationStore(account), JSON.stringify(s));
export function markAnnounced(account: string, to: string, friends: string[]) {
  const s = loadRotation(account);
  if (!s || s.to !== to) return;
  saveRotation(account, { to, announced: [...new Set([...s.announced, ...friends])] });
}
/** Friends who may still only know one of my retired keys. */
export function unannouncedFriends(key: MessagingKey, contacts: Record<string, string>, state: RotationState | null, exclude: readonly string[] = []): string[] {
  if (!key.retired?.length || !state || state.to !== key.publicKey) return [];
  return Object.keys(contacts).filter(f => f !== key.account && !state.announced.includes(f) && !exclude.includes(f)).sort();
}

/** Encrypted rotate notices for one friend: one from each recent retired key, telling them my active key. */
export function noticeMemos(key: MessagingKey, theirPublic: string, now: number): string[] {
  const payload = encodeRotateNotice(key.publicKey, now);
  return [...(key.retired ?? [])].sort((a, b) => Date.parse(b.retiredAt) - Date.parse(a.retiredAt)).slice(0, MAX_NOTICE_SOURCES)
    .flatMap(r => splitMessage(payload).map(p => encryptMemo(p, theirPublic, r.secretKey)));
}
export const noticeSources = (key: MessagingKey) => Math.min(MAX_NOTICE_SOURCES, key.retired?.length ?? 0);

/**
 * Transactions for the stealth broadcast. Like profile notes, one shared platform fee rides on the first batch.
 * `publishPublicly` (default off) adds the ordinary key-publish fee to the first batch.
 */
export function buildRotateBatches(key: MessagingKey, recipients: string[], contacts: Record<string, string>, auth: unknown[], now: number, publishPublicly = false): unknown[][] {
  if (!key.retired?.length) throw new Error('Nothing to announce: this key has not been rotated.');
  const batches: unknown[][] = [];
  for (let i = 0; i < recipients.length; i += ROTATE_RECIPIENTS_PER_TX) {
    batches.push(recipients.slice(i, i + ROTATE_RECIPIENTS_PER_TX).flatMap((to, j) => {
      if (!contacts[to]) throw new Error(`Missing key for ${to}`);
      return buildSendMessageActions(key.account, to, noticeMemos(key, contacts[to], now), auth, false, i === 0 && j === 0);
    }));
  }
  if (publishPublicly) {
    const pub = buildPublishKeyActions(key.account, key.publicKey, auth);
    if (batches.length) batches[0] = [...pub, ...batches[0]]; else batches.push(pub);
  }
  return batches;
}
const units = (q: string) => Math.round(parseFloat(q) * 10000);
export function rotateCost(recipients: number, sources: number, publishPublicly: boolean): string {
  const notices = recipients ? units(groupMessageCost(sources, recipients)) : 0;
  return `${((notices + (publishPublicly ? units(MESSAGE_FEE_QUANTITY) : 0)) / 10000).toFixed(4)} CHEESE`;
}

// ---- rotation + shredding ----
export function rotatedRing(old: MessagingKey, fresh: MessagingKey, now: number, retention: Retention): MessagingKey {
  if (fresh.account !== old.account || fresh.publicKey === old.publicKey) throw new Error('Invalid rotation');
  const retired: RetiredKey[] = [{ publicKey: old.publicKey, secretKey: old.secretKey, retiredAt: new Date(now).toISOString(), expiresAt: expiryFor(now, retention) }, ...(old.retired ?? [])];
  return { ...fresh, avatar: old.avatar, displayName: old.displayName, retired };
}

/**
 * Retired keys that may be destroyed now. A key pinned by an invite room roster is never destroyed (room members
 * still encrypt to it). Automatic expiry also waits until every friend has been told the new key.
 */
export function shreddable(key: MessagingKey, now: number, pinned: ReadonlySet<string>, friendsPending: boolean): RetiredKey[] {
  return (key.retired ?? []).filter(r => r.expiresAt !== null && Date.parse(r.expiresAt) <= now && !pinned.has(r.publicKey) && !friendsPending);
}
export const withoutRetired = (key: MessagingKey, drop: readonly string[]): MessagingKey => {
  const retired = (key.retired ?? []).filter(r => !drop.includes(r.publicKey));
  const { retired: _r, ...rest } = key;
  return retired.length ? { ...rest, retired } : rest;
};
