// CHEESECrypt replies: a reply carries a short quote header inside the encrypted text, so it works
// the same in DMs, legacy groups and invite groups and costs only the quote's bytes.
// Wire form: "\u0004R1:<author>:<time base36>:<quote>\n<body>"
import { parseNftMessage } from '@/lib/cryptNft';

export const REPLY_MARK = '\u0004R1:';
export const QUOTE_MAX_CHARS = 60;
const HEADER = /^\u0004R1:([a-z1-5.]{1,12}):([0-9a-z]{1,12}):([^\n]*)\n/;

export interface ReplyRef { author: string; time: number; quote: string }
export interface ParsedReply extends ReplyRef { body: string }

/** One-line snippet of a message for quoting: nested quotes dropped, NFTs shown as a label, capped length. */
export function quoteOf(text: string | null, voice = false): string {
  if (voice) return '🎙️ Voice note';
  if (text == null) return '';
  const body = parseReply(text)?.body ?? text;
  const flat = parseNftMessage(body).map(s => s.type === 'nft' ? '🖼️ NFT' : s.text).join(' ').replace(/\s+/g, ' ').trim();
  const chars = Array.from(flat);
  return chars.length > QUOTE_MAX_CHARS ? `${chars.slice(0, QUOTE_MAX_CHARS - 1).join('')}…` : flat;
}

export function encodeReply(ref: ReplyRef, body: string): string {
  if (!/^[a-z1-5.]{1,12}$/.test(ref.author) || !Number.isSafeInteger(ref.time) || ref.time < 0) throw new Error('Invalid reply');
  const quote = quoteOf(ref.quote);
  return `${REPLY_MARK}${ref.author}:${ref.time.toString(36)}:${quote}\n${body}`;
}

/** Null when the text is not a reply. */
export function parseReply(text: string | null): ParsedReply | null {
  if (!text) return null;
  const m = HEADER.exec(text);
  if (!m) return null;
  const time = parseInt(m[2], 36);
  if (!Number.isSafeInteger(time)) return null;
  return { author: m[1], time, quote: m[3], body: text.slice(m[0].length) };
}

/** True when an incoming message replies to one of this account's own messages. */
export const repliesTo = (text: string | null | undefined, account: string) => parseReply(text ?? null)?.author === account;
