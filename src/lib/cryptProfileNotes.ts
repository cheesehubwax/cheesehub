// CHEESECrypt profile notes: your name and avatar sent to friends/group members inside encrypted memos.
// Notes never show as chat messages or unread badges; for each sender the newest note (by chain time) wins.
import { buildSendMessageActions, encryptMemo, MessagingKey, splitMessage, partCount } from '@/lib/cheeseCrypt';
import { groupMessageCost } from '@/lib/cryptGroups';
import { parseAvatar, type CryptAvatar } from '@/lib/cryptAvatar';
import { parseCryptName } from '@/lib/cryptNames';

export const PROFILE_PREFIX = '\u0002CP1:';
/** Recipient transfers per transaction; the shared platform fee rides in the first one. */
export const PROFILE_RECIPIENTS_PER_TX = 15;

export interface ProfileNote { displayName?: string; avatar: CryptAvatar }

export function profileNotePayload(key: Pick<MessagingKey, 'avatar' | 'displayName'>): string {
  const avatar = parseAvatar(key.avatar);
  if (!avatar) throw new Error('Choose an avatar first.');
  const displayName = parseCryptName(key.displayName);
  return PROFILE_PREFIX + JSON.stringify(displayName ? { displayName, avatar } : { avatar });
}

export const isProfileNote = (text: string | null | undefined) => !!text && text.startsWith(PROFILE_PREFIX);

export function parseProfileNote(text: string | null | undefined): ProfileNote | null {
  if (!isProfileNote(text)) return null;
  try {
    const raw = JSON.parse(text!.slice(PROFILE_PREFIX.length));
    const avatar = parseAvatar(raw?.avatar);
    if (!avatar) return null;
    if (raw.displayName !== undefined && !parseCryptName(raw.displayName)) return null;
    const displayName = parseCryptName(raw.displayName);
    return displayName ? { displayName, avatar } : { avatar };
  } catch { return null; }
}

/** Newest complete, valid note per sender; your own notes are ignored. */
export function latestProfiles(entries: readonly { from: string; time: number; text: string | null; missing: number }[], account: string) {
  const out: Record<string, ProfileNote & { time: number }> = {};
  for (const e of entries) {
    if (e.from === account || e.missing) continue;
    const note = parseProfileNote(e.text);
    if (note && (out[e.from]?.time ?? -1) < e.time) out[e.from] = { ...note, time: e.time };
  }
  return out;
}

/** Friends and group members with a known key, minus you and blocked/removed accounts. */
export function profileRecipients(account: string, contacts: Record<string, string>, groupMembers: string[][], exclude: readonly string[]) {
  const set = new Set<string>([...Object.keys(contacts), ...groupMembers.flat()]);
  return [...set].filter(a => a !== account && contacts[a] && !exclude.includes(a)).sort();
}

export function profileNoteParts(key: Pick<MessagingKey, 'avatar' | 'displayName'>) {
  return partCount(profileNotePayload(key));
}

export const profileNoteCost = (parts: number, recipients: number) => groupMessageCost(parts, recipients);

/** One transaction per batch of recipients; only the first batch pays the shared platform fee. */
export function buildProfileNoteBatches(key: MessagingKey, recipients: string[], contacts: Record<string, string>, auth: unknown[]) {
  if (!recipients.length) throw new Error('No friends to update.');
  const payload = profileNotePayload(key);
  const batches: unknown[][] = [];
  for (let i = 0; i < recipients.length; i += PROFILE_RECIPIENTS_PER_TX) {
    batches.push(recipients.slice(i, i + PROFILE_RECIPIENTS_PER_TX).flatMap((to, j) => {
      if (!contacts[to]) throw new Error(`Missing key for ${to}`);
      const parts = splitMessage(payload).map(p => encryptMemo(p, contacts[to], key.secretKey));
      return buildSendMessageActions(key.account, to, parts, auth, false, i === 0 && j === 0);
    }));
  }
  return batches;
}
