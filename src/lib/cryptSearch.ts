// In-chat keyword search over already-decrypted messages. Runs locally only; nothing is sent or stored.
import { parseReply } from '@/lib/cryptReply';

type Searchable = { key: string; text: string | null; collapsed?: boolean };

/** Human text a message shows: reply body only (not the quote), NFT tokens removed. Voice/no-text → ''. */
export function searchableText(text: string | null): string {
  if (!text) return '';
  const body = parseReply(text)?.body ?? text;
  return body.replace(/\[nft:\d+\]/gi, ' ').trim();
}

/** Keys of matching messages in thread order. Case-insensitive; blank queries and hidden (collapsed, unrevealed) messages never match. */
export function findMatches(thread: Searchable[], query: string, revealed: Set<string> = new Set()): string[] {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return [];
  return thread
    .filter(m => !(m.collapsed && !revealed.has(m.key)) && searchableText(m.text).toLocaleLowerCase().includes(q))
    .map(m => m.key);
}
