/** Wallet-unlocked, account/key-bound encrypted folder backups; no plaintext rosters on disk. */
import nacl from 'tweetnacl';
import { decodeBase64, decodeUTF8, encodeBase64, encodeUTF8 } from 'tweetnacl-util';
import type { ChainMemo, MessagingKey } from './cheeseCrypt';
import { validateHistory } from './cryptHistoryCache';
import { memberKey, validateInvite, type InviteGroup, type LocalDecision } from './cryptInviteGroups';
import type { RoomRequest } from './cryptRooms';
import type { DirHandle } from './cryptVault';

export interface GroupBackup {
  invites: Record<string, InviteGroup>;
  decisions: Record<string, LocalDecision>;
  requests: Record<string, RoomRequest>;
  controls: ChainMemo[];
}
export const groupBackupName = (account: string) => `${account}-cheesecrypt-groups.json`;
const backupKey = (key: MessagingKey) => nacl.hash(decodeUTF8(`CHEESECrypt groups v1:${key.account}:${key.secretKey}`)).slice(0, 32);

function validate(raw: unknown, key: MessagingKey): GroupBackup | null {
  const b = raw as Partial<GroupBackup> | null;
  if (!b || !b.invites || !b.decisions || !b.requests || !Array.isArray(b.controls)) return null;
  const invites: GroupBackup['invites'] = {}, decisions: GroupBackup['decisions'] = {}, requests: GroupBackup['requests'] = {};
  const mine = [key.publicKey, ...(key.retired ?? []).map(k => k.publicKey)];
  for (const [id, g] of Object.entries(b.invites)) {
    if (!g || typeof g !== 'object') return null;
    const parsed = validateInvite({ i: g.id, n: g.name, o: g.creator, c: g.created, m: g.members?.map(m => [m.account, m.publicKey]), ...(g.avatar ? { a: g.avatar.pixels } : {}) }, g.publicRoom === true);
    if (!parsed || parsed.id !== id || !mine.includes(memberKey(parsed, key.account) ?? '')) return null;
    invites[id] = parsed;
  }
  for (const [id, d] of Object.entries(b.decisions)) {
    if (!/^[a-f0-9]{16}$/.test(id) || !d || !['joined', 'left', 'declined'].includes(d.status) || !Number.isFinite(d.at) || d.at < 0) return null;
    decisions[id] = { status: d.status, at: d.at };
  }
  for (const [id, r] of Object.entries(b.requests)) {
    if (!r || r.id !== id || !/^[a-f0-9]{16}$/.test(id) || !/^[a-z1-5.]{1,12}$/.test(r.creator) || r.creator === key.account || !Number.isFinite(r.time) || r.time < 0 || decodeBase64(r.publicKey).length !== 32) return null;
    requests[id] = { id, creator: r.creator, publicKey: r.publicKey, time: r.time, ...(typeof r.name === 'string' && r.name.length <= 64 ? { name: r.name } : {}) };
  }
  const history = validateHistory({ version: 1, account: key.account, mode: 'standard', rows: b.controls, cursor: Date.now(), depth: 1 }, key.account, 'standard');
  return history ? { invites, decisions, requests, controls: history.rows } : null;
}

export async function readGroupBackup(root: DirHandle, key: MessagingKey): Promise<GroupBackup | null> {
  try {
    const file = await root.getFileHandle(groupBackupName(key.account));
    if (!file.getFile) return null;
    const text = await (await file.getFile()).text();
    if (text.length > 16_000_000) return null;
    const envelope = JSON.parse(text);
    if (envelope.type !== 'cheesecrypt-groups' || envelope.version !== 1 || envelope.account !== key.account) return null;
    const ring = [key, ...(key.retired ?? []).map(k => ({ ...key, ...k }))];
    const matched = ring.find(k => k.publicKey === envelope.publicKey);
    if (!matched) return null;
    const plain = nacl.secretbox.open(decodeBase64(envelope.box), decodeBase64(envelope.nonce), backupKey(matched));
    return plain ? validate(JSON.parse(encodeUTF8(plain)), key) : null;
  } catch (error) {
    if (['NotAllowedError', 'NotReadableError'].includes((error as DOMException)?.name)) throw error;
    return null;
  }
}

export async function writeGroupBackup(root: DirHandle, key: MessagingKey, data: GroupBackup): Promise<void> {
  const checked = validate(data, key);
  if (!checked) throw new Error('Invalid group backup');
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const envelope = { type: 'cheesecrypt-groups', version: 1, account: key.account, publicKey: key.publicKey,
    nonce: encodeBase64(nonce), box: encodeBase64(nacl.secretbox(decodeUTF8(JSON.stringify(checked)), nonce, backupKey(key))) };
  const writer = await (await root.getFileHandle(groupBackupName(key.account), { create: true })).createWritable();
  try { await writer.write(JSON.stringify(envelope)); await writer.close(); }
  catch (error) { await writer.abort?.().catch(() => {}); throw error; }
}