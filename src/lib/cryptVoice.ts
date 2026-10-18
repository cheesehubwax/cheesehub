/**
 * CHEESECrypt voice notes: up to 10 s of Opus audio, encrypted as raw bytes into CRYPT1: memos.
 *
 * Every part's plaintext starts with a 12-byte header:
 *   0x03 marker | 6-char id (ascii base36) | index (uint16 BE) | total (uint16 BE) | flags (bit0 = group)
 * Part 0 carries only metadata: mime code, duration (ms, uint16), 32-byte digest of the audio,
 * and (for groups) "groupId|member,member,..". Parts 1..n carry the audio.
 * 0x03 is used because 0x01 marks multipart text and 0x02 starts the group text envelope.
 */
import nacl from 'tweetnacl';
import { buildSendMessageActions, encryptBytesMemo, FEE_MEMO, KEY_PUBLISH_TO, MAX_PLAINTEXT_BYTES, MESSAGE_RECIPIENT_QUANTITY, type MessagingKey } from '@/lib/cheeseCrypt';

export const VOICE_MARK = 0x03;
export const VOICE_HEADER_BYTES = 12;
export const VOICE_BODY_BYTES = MAX_PLAINTEXT_BYTES - VOICE_HEADER_BYTES;
export const VOICE_MAX_MS = 10_000;
/** Recorder stop timing can overshoot slightly; anything past this is rejected. */
export const VOICE_DURATION_TOLERANCE_MS = 500;
export const VOICE_MAX_BYTES = 12 * 1024;
export const VOICE_PARTS_PER_TX = 30;
export const VOICE_MAX_PARTS = 1 + Math.ceil(VOICE_MAX_BYTES / VOICE_BODY_BYTES);
export const VOICE_BITRATE = 6000;
/** A note still missing parts this long after its newest part is treated as incomplete, not loading. */
export const VOICE_LOADING_GRACE_MS = 3 * 60_000;

export const VOICE_MIMES = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus'] as const;
export type VoiceMime = typeof VOICE_MIMES[number];
const mimeCode = (m: VoiceMime) => VOICE_MIMES.indexOf(m) + 1;
const mimeFromCode = (c: number): VoiceMime | null => VOICE_MIMES[c - 1] ?? null;

export interface VoiceClip { bytes: Uint8Array; mime: VoiceMime; durationMs: number }
export interface VoiceGroupRef { id: string; members: string[] }

/** Container type from the file's magic bytes (WebM/EBML or Ogg). */
export function detectMime(bytes: Uint8Array): VoiceMime | null {
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return VOICE_MIMES[0];
  if (bytes.length >= 4 && bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) return VOICE_MIMES[1];
  return null;
}

export const voiceDigest = (bytes: Uint8Array) => nacl.hash(bytes).slice(0, 32);
const sameBytes = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);

export function validateClip(clip: VoiceClip) {
  if (!clip.bytes.length) throw new Error('The recording is empty.');
  if (clip.bytes.length > VOICE_MAX_BYTES) throw new Error('The recording is larger than 12 KB. Record a shorter note.');
  if (!(clip.durationMs > 0) || clip.durationMs > VOICE_MAX_MS + VOICE_DURATION_TOLERANCE_MS) throw new Error('Voice notes can be at most 10 seconds.');
  if (detectMime(clip.bytes) !== clip.mime) throw new Error('Unsupported audio format.');
}

function randomId(): string {
  return Array.from(nacl.randomBytes(6), (x) => (x % 36).toString(36)).join('');
}

const groupText = (g: VoiceGroupRef) => `${g.id}|${[...g.members].sort().join(',')}`;

/** Plaintext payloads (one per memo) for a clip; part 0 is metadata. */
export function splitVoice(clip: VoiceClip, group: VoiceGroupRef | null = null, id = randomId()): Uint8Array[] {
  validateClip(clip);
  if (!/^[0-9a-z]{6}$/.test(id)) throw new Error('Invalid voice id');
  const g = group ? new TextEncoder().encode(groupText(group)) : new Uint8Array(0);
  const meta = new Uint8Array(1 + 2 + 32 + 1 + g.length);
  meta[0] = mimeCode(clip.mime);
  const ms = Math.min(65535, Math.round(clip.durationMs));
  meta[1] = ms >> 8; meta[2] = ms & 0xff;
  meta.set(voiceDigest(clip.bytes), 3);
  meta[35] = g.length;
  meta.set(g, 36);
  if (meta.length > VOICE_BODY_BYTES || g.length > 255) throw new Error('Group is too large for a voice note.');
  const bodies: Uint8Array[] = [meta];
  for (let i = 0; i < clip.bytes.length; i += VOICE_BODY_BYTES) bodies.push(clip.bytes.slice(i, i + VOICE_BODY_BYTES));
  const total = bodies.length;
  if (total > VOICE_MAX_PARTS) throw new Error('The recording is too large.');
  return bodies.map((body, index) => {
    const out = new Uint8Array(VOICE_HEADER_BYTES + body.length);
    out[0] = VOICE_MARK;
    for (let i = 0; i < 6; i++) out[1 + i] = id.charCodeAt(i);
    out[7] = index >> 8; out[8] = index & 0xff;
    out[9] = total >> 8; out[10] = total & 0xff;
    out[11] = group ? 1 : 0;
    out.set(body, VOICE_HEADER_BYTES);
    return out;
  });
}

export const voicePartCount = (clip: VoiceClip) => 1 + Math.ceil(clip.bytes.length / VOICE_BODY_BYTES);
export const voiceTransactions = (parts: number) => Math.ceil(parts / VOICE_PARTS_PER_TX);

export interface VoicePart { id: string; index: number; total: number; isGroup: boolean; body: Uint8Array }
export function parseVoicePart(bytes: Uint8Array): VoicePart | null {
  if (bytes.length < VOICE_HEADER_BYTES || bytes[0] !== VOICE_MARK) return null;
  const id = String.fromCharCode(...bytes.slice(1, 7));
  const index = (bytes[7] << 8) | bytes[8], total = (bytes[9] << 8) | bytes[10];
  if (!/^[0-9a-z]{6}$/.test(id) || total < 2 || total > VOICE_MAX_PARTS || index >= total || bytes[11] > 1) return null;
  return { id, index, total, isGroup: bytes[11] === 1, body: bytes.slice(VOICE_HEADER_BYTES) };
}

interface VoiceMeta { mime: VoiceMime; durationMs: number; digest: Uint8Array; group: VoiceGroupRef | null }
function parseMeta(body: Uint8Array): VoiceMeta | null {
  if (body.length < 36) return null;
  const mime = mimeFromCode(body[0]);
  const len = body[35];
  if (!mime || body.length !== 36 + len) return null;
  let group: VoiceGroupRef | null = null;
  if (len) {
    const [id, list] = new TextDecoder().decode(body.slice(36)).split('|');
    if (!id || !list) return null;
    group = { id, members: list.split(',') };
  }
  return { mime, durationMs: (body[1] << 8) | body[2], digest: body.slice(3, 35), group };
}

export interface VoicePartMemo { txId: string; time: number; from: string; to: string; part: VoicePart }
export type VoiceStatus = 'ready' | 'loading' | 'incomplete' | 'invalid';
export interface VoiceNote {
  key: string; id: string; txId: string; time: number; from: string; to: string;
  total: number; received: number; missing: number; isGroup: boolean;
  group: VoiceGroupRef | null; mime: VoiceMime | null; durationMs: number | null;
  audio: Uint8Array | null; status: VoiceStatus;
}

/** Joins parts by sender + recipient + voice id (across transactions). Audio is only exposed when complete and verified. */
export function assembleVoice(parts: VoicePartMemo[], now = Date.now()): VoiceNote[] {
  const groups = new Map<string, VoicePartMemo[]>();
  for (const p of parts) {
    const k = `${p.from}:${p.to}:${p.part.id}`;
    const list = groups.get(k);
    if (list) list.push(p); else groups.set(k, [p]);
  }
  const out: VoiceNote[] = [];
  for (const [key, list] of groups) {
    const total = list[0].part.total, isGroup = list[0].part.isGroup;
    const byIndex = new Map<number, Uint8Array>();
    list.forEach(({ part }) => { if (part.total === total && part.isGroup === isGroup && !byIndex.has(part.index)) byIndex.set(part.index, part.body); });
    const first = list.reduce((a, b) => (b.time < a.time ? b : a));
    const newest = list.reduce((t, p) => Math.max(t, p.time), 0);
    const meta = byIndex.has(0) ? parseMeta(byIndex.get(0)!) : null;
    const note: VoiceNote = {
      key, id: list[0].part.id, txId: first.txId, time: first.time, from: first.from, to: first.to,
      total, received: byIndex.size, missing: total - byIndex.size, isGroup,
      group: meta?.group ?? null, mime: meta?.mime ?? null, durationMs: meta?.durationMs ?? null, audio: null,
      status: 'invalid',
    };
    if (byIndex.has(0) && (!meta || !!meta.group !== isGroup)) { out.push(note); continue; }
    if (note.missing) { note.status = now - newest < VOICE_LOADING_GRACE_MS ? 'loading' : 'incomplete'; out.push(note); continue; }
    const size = Array.from({ length: total - 1 }, (_, i) => byIndex.get(i + 1)!.length).reduce((a, b) => a + b, 0);
    const audio = new Uint8Array(size);
    let at = 0;
    for (let i = 1; i < total; i++) { audio.set(byIndex.get(i)!, at); at += byIndex.get(i)!.length; }
    if (meta && sameBytes(voiceDigest(audio), meta.digest) && detectMime(audio) === meta.mime && audio.length <= VOICE_MAX_BYTES) {
      note.audio = audio; note.status = 'ready';
    }
    out.push(note);
  }
  return out;
}

/** Flat nulled fee per voice note, whatever its length or number of recipients. */
export const VOICE_FEE_QUANTITY = '1.0000 CHEESE';
const units = (q: string) => Math.round(parseFloat(q) * 10000);

/** Total CHEESE for a voice note: one flat nulled fee plus 0.0010 per part to every recipient. */
export function voiceNoteCost(parts: number, recipients = 1): string {
  return `${((units(VOICE_FEE_QUANTITY) + units(MESSAGE_RECIPIENT_QUANTITY) * parts * recipients) / 10000).toFixed(4)} CHEESE`;
}

/**
 * Transactions to sign, in order. Each carries up to 30 parts; every recipient gets its own encrypted
 * copy of each part paid 0.0010 CHEESE. The flat 1 CHEESE nulled fee is paid once, in the first transaction.
 */
export function buildVoiceBatches(key: MessagingKey, recipients: string[], group: VoiceGroupRef | null, clip: VoiceClip,
  contacts: Record<string, string>, auth: unknown[], id?: string): unknown[][] {
  if (!recipients.length) throw new Error('No recipients');
  if (recipients.some(r => !contacts[r])) throw new Error('Load every recipient’s public key before sending.');
  const plain = splitVoice(clip, group, id);
  const encrypted = recipients.map(to => plain.map(p => encryptBytesMemo(p, contacts[to], key.secretKey)));
  const batches: unknown[][] = [];
  for (let s = 0; s < plain.length; s += VOICE_PARTS_PER_TX) {
    // The message builder alternates recipient payment and per-part fee; keep only the payments.
    const payments = recipients.flatMap((to, ri) =>
      buildSendMessageActions(key.account, to, encrypted[ri].slice(s, s + VOICE_PARTS_PER_TX), auth).filter((_, i) => i % 2 === 0));
    if (s === 0) payments.push({ account: 'cheeseburger', name: 'transfer', authorization: auth,
      data: { from: key.account, to: KEY_PUBLISH_TO, quantity: VOICE_FEE_QUANTITY, memo: FEE_MEMO } });
    batches.push(payments);
  }
  return batches;
}

/** Recording format this browser can produce, or null when voice notes cannot be recorded here. */
export function recordingMime(): VoiceMime | null {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) return null;
  return VOICE_MIMES.find(m => { try { return MediaRecorder.isTypeSupported(m); } catch { return false; } }) ?? null;
}
