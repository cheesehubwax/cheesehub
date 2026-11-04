// CHEESECrypt emoji reactions: an ordinary encrypted message whose text is a reaction control line,
// so it reaches exactly the same recipients as a message and needs no contract support.
// Wire form: "\u0006R1:<+|->:<author>:<time base36>:<emoji>" — targets a row by author + original send time
// (edits keep the original time), the same reference replies use.

export const REACTION_MARK = '\u0006R1:';
export const REACTION_EMOJIS = ['👍', '❤️', '🔥', '😂', '🧀', '🚀'] as const;
export type ReactionEmoji = typeof REACTION_EMOJIS[number];
const LINE = /^\u0006R1:([+-]):([a-z1-5.]{1,12}):([0-9a-z]{1,12}):(.+)$/;

export interface ParsedReaction { add: boolean; author: string; time: number; emoji: ReactionEmoji }
export interface ReactionRow { key: string; from: string; time: number; text: string | null; missing: number }

export const isReaction = (text: string | null | undefined) => !!text?.startsWith(REACTION_MARK);
export const targetRef = (author: string, time: number) => `${author}:${time}`;

export function encodeReaction(r: ParsedReaction): string {
  if (!/^[a-z1-5.]{1,12}$/.test(r.author) || !Number.isSafeInteger(r.time) || r.time < 0 || !REACTION_EMOJIS.includes(r.emoji)) throw new Error('Invalid reaction');
  return `${REACTION_MARK}${r.add ? '+' : '-'}:${r.author}:${r.time.toString(36)}:${r.emoji}`;
}

/** Null for anything that is not a well-formed reaction with a palette emoji. */
export function parseReaction(text: string | null | undefined): ParsedReaction | null {
  const m = text ? LINE.exec(text) : null;
  if (!m) return null;
  const time = parseInt(m[3], 36);
  if (!Number.isSafeInteger(time) || !(REACTION_EMOJIS as readonly string[]).includes(m[4])) return null;
  return { add: m[1] === '+', author: m[2], time, emoji: m[4] as ReactionEmoji };
}

export interface ActiveReaction { key: string; from: string; time: number; emoji: ReactionEmoji; target: string }

/**
 * Replays complete reactions oldest-first: the newest add/remove per reactor + target + emoji wins.
 * Returns the reactions still standing, each carrying the message key that last added it.
 */
export function activeReactions(rows: ReactionRow[], targets: Set<string>): ActiveReaction[] {
  const state = new Map<string, ActiveReaction | null>();
  for (const row of [...rows].sort((a, b) => a.time - b.time || a.key.localeCompare(b.key))) {
    if (row.missing) continue;
    const r = parseReaction(row.text);
    if (!r) continue;
    const target = targetRef(r.author, r.time);
    if (!targets.has(target)) continue;
    const id = `${row.from}|${target}|${r.emoji}`;
    state.set(id, r.add ? { key: row.key, from: row.from, time: row.time, emoji: r.emoji, target } : null);
  }
  return [...state.values()].filter((x): x is ActiveReaction => !!x);
}

export interface ReactionPill { emoji: ReactionEmoji; count: number; mine: boolean; from: string[] }

/** Pills per target, in palette order. */
export function reactionPills(active: ActiveReaction[], account: string): Map<string, ReactionPill[]> {
  const out = new Map<string, ReactionPill[]>();
  for (const emoji of REACTION_EMOJIS) {
    const by = new Map<string, string[]>();
    for (const r of active) if (r.emoji === emoji) by.set(r.target, [...(by.get(r.target) ?? []), r.from]);
    for (const [target, from] of by) out.set(target, [...(out.get(target) ?? []), { emoji, count: from.length, mine: from.includes(account), from }]);
  }
  return out;
}

/** Reactions other people placed on this account's own messages. */
export const reactionsToMe = (active: ActiveReaction[], account: string) =>
  active.filter(r => r.from !== account && r.target.startsWith(`${account}:`));
