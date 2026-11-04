import { useEffect, useRef, useState, type RefObject } from 'react';
import { reactionsToMe, type ActiveReaction } from '@/lib/cryptReactions';

interface State { pending: string[]; seen: string[] }
type Store = Record<string, State>;
const storageKey = (account: string) => `cheesecrypt-reaction-views-${account}`;
function load(account: string): Store {
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey(account)) || '{}');
    const out: Store = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    for (const [id, value] of Object.entries(raw)) {
      const v = value as Partial<State> | null;
      if (v && Array.isArray(v.pending) && Array.isArray(v.seen)) out[id] = {
        pending: v.pending.filter((k): k is string => typeof k === 'string'),
        seen: v.seen.filter((k): k is string => typeof k === 'string'),
      };
    }
    return out;
  } catch { return {}; }
}

/** Unseen reactions to my messages, grouped by target row in chat order. */
export function pendingReactionTargets(reactions: ActiveReaction[], account: string, rowFor: Map<string, { key: string; time: number }>, state: State | undefined, resumeAt: number | null) {
  const seen = new Set(state?.seen ?? []);
  const saved = new Set(state?.pending ?? []);
  const unseen = reactionsToMe(reactions, account).filter(r => !seen.has(r.key) && (saved.has(r.key) || (resumeAt !== null && r.time > resumeAt)));
  const byRow = new Map<string, { key: string; time: number; reactions: string[] }>();
  for (const r of unseen) {
    const row = rowFor.get(r.target);
    if (!row) continue;
    const entry = byRow.get(row.key) ?? { key: row.key, time: row.time, reactions: [] };
    entry.reactions.push(r.key);
    byRow.set(row.key, entry);
  }
  return [...byRow.values()].sort((a, b) => a.time - b.time);
}

/**
 * Independent of reply receipts: a reaction is only marked seen by landing on it with the 🧀 button,
 * never by being on screen during scrolling or a reply jump.
 */
export function useCryptReactionNavigation(account: string, active: string | null, reactions: ActiveReaction[], rowFor: Map<string, { key: string; time: number }>, resumeAt: number | null, list: RefObject<HTMLOListElement>) {
  const [store, setStore] = useState<Store>(() => load(account));
  const [highlighted, setHighlighted] = useState<{ id: string | null; key: string | null }>({ id: null, key: null });
  useEffect(() => { setStore(load(account)); }, [account]);
  const pending = active ? pendingReactionTargets(reactions, account, rowFor, store[active], resumeAt) : [];
  const current = useRef({ active, pending, store });
  current.current = { active, pending, store };

  const save = (next: Store) => { current.current.store = next; localStorage.setItem(storageKey(account), JSON.stringify(next)); setStore(next); };
  // Persist the queue so unseen reactions survive switching chats, reloads and the read marker moving on.
  useEffect(() => {
    if (!active) return;
    const old = store[active] ?? { pending: [], seen: [] };
    const keys = [...new Set([...old.pending, ...pending.flatMap(p => p.reactions)])];
    if (keys.length === old.pending.length) return;
    save({ ...store, [active]: { ...old, pending: keys } });
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const jump = () => {
    const { active: id, pending: queue, store: latest } = current.current;
    const next = queue[0];
    const el = list.current;
    if (!id || !next || !el) return;
    const node = Array.from(el.querySelectorAll<HTMLElement>('[data-reply-key]')).find(n => n.dataset.replyKey === next.key);
    if (node) {
      const top = el.scrollTop + node.getBoundingClientRect().top - el.getBoundingClientRect().top - 12;
      if (typeof el.scrollTo === 'function') el.scrollTo({ top, behavior: 'auto' });
      else el.scrollTop = top;
    }
    const old = latest[id] ?? { pending: [], seen: [] };
    save({ ...latest, [id]: {
      pending: [...new Set([...old.pending, ...queue.flatMap(p => p.reactions)])].filter(k => !next.reactions.includes(k)),
      seen: [...new Set([...old.seen, ...next.reactions])],
    } });
    current.current.pending = queue.slice(1);
    setHighlighted({ id, key: next.key });
  };
  return { pending, jump, highlighted: highlighted.id === active ? highlighted.key : null };
}
