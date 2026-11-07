/** Prototype-only opaque framing. Never wrap ratchet messages in recoverable static-key self copies. */
import nacl from 'tweetnacl';
import { decodeUTF8, encodeBase64 } from 'tweetnacl-util';

export const SECRET_MEMO_PREFIX = 'CRYPTS1:';
export const SECRET_MEMO_BYTES = 256;
export const SECRET_MAX_PARTS = 35;
const HEADER_BYTES = 112;
const BODY_BYTES = SECRET_MEMO_BYTES - HEADER_BYTES;
const HEX_ID = /^[a-f0-9]{32}$/;
const HEX_DIGEST = /^[a-f0-9]{64}$/;
const hex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');

/** Whole-envelope corruption check, not sender authentication (the ratchet authenticates that). */
const digest = (body: string) => hex(nacl.hash(decodeUTF8(body)).slice(0, 32));

export function frameSecretPrototype(ciphertext: { type: 0 | 1; body: string }, id = hex(nacl.randomBytes(16))): string[] {
  if (!HEX_ID.test(id) || (ciphertext.type !== 0 && ciphertext.type !== 1) || !/^[A-Za-z0-9+/]+={0,2}$/.test(ciphertext.body)) throw new Error('Invalid Secret Chat envelope');
  const body = encodeBase64(decodeUTF8(JSON.stringify(ciphertext)));
  const total = Math.ceil(body.length / BODY_BYTES);
  if (!total || total > SECRET_MAX_PARTS) throw new Error('Secret Chat envelope exceeds transaction limits');
  const hash = digest(body);
  return Array.from({ length: total }, (_, index) => `${SECRET_MEMO_PREFIX}${id}:${index.toString(36).padStart(2, '0')}:${total.toString(36).padStart(2, '0')}:${hash}:${body.slice(index * BODY_BYTES, (index + 1) * BODY_BYTES).padEnd(BODY_BYTES, '.')}`);
}

export interface SecretWireCopy { txId: string; from: string; to: string; memo: string }
interface Fragment { id: string; index: number; total: number; hash: string; body: string }

function parseFragment(memo: string): Fragment | null {
  if (memo.length !== SECRET_MEMO_BYTES || !memo.startsWith(SECRET_MEMO_PREFIX)) return null;
  const [id, rawIndex, rawTotal, hash, padded] = memo.slice(SECRET_MEMO_PREFIX.length).split(':');
  if (!HEX_ID.test(id ?? '') || !HEX_DIGEST.test(hash ?? '') || !/^[0-9a-z]{2}$/.test(rawIndex ?? '') || !/^[0-9a-z]{2}$/.test(rawTotal ?? '') || !/^[A-Za-z0-9+/=]+\.*$/.test(padded ?? '')) return null;
  const index = parseInt(rawIndex, 36), total = parseInt(rawTotal, 36);
  if (total < 1 || total > SECRET_MAX_PARTS || index >= total) return null;
  if (index < total - 1 && padded.includes('.')) return null;
  return { id, index, total, hash, body: padded.replace(/\.+$/, '') };
}

/** One complete transaction and account pair only. No partial/conflicting envelope reaches decryption. */
export function assembleSecretPrototype(copies: SecretWireCopy[]): { id: string; encoded: string } | null {
  if (!copies.length || copies.length > SECRET_MAX_PARTS * 2) return null;
  const first = copies[0], reference = parseFragment(first.memo);
  if (!reference) return null;
  const fragments = new Map<number, string>();
  for (const copy of copies) {
    const part = parseFragment(copy.memo);
    if (copy.txId !== first.txId || copy.from !== first.from || copy.to !== first.to || !part || part.id !== reference.id || part.hash !== reference.hash || part.total !== reference.total) return null;
    const previous = fragments.get(part.index);
    if (previous !== undefined && previous !== part.body) return null;
    fragments.set(part.index, part.body);
  }
  if (fragments.size !== reference.total) return null;
  const encoded = Array.from({ length: reference.total }, (_, i) => fragments.get(i) ?? '').join('');
  return digest(encoded) === reference.hash ? { id: reference.id, encoded } : null;
}