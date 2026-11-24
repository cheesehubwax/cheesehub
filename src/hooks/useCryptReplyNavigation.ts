import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { repliesTo } from '@/lib/cryptReply';
import { findCryptMessageNode } from '@/lib/cryptMessageDom';

interface ReplyMessage { key: string; from: string; time: number; text: string | null; missing: number }
interface ReplyState { pending: string[]; seen: string[] }
type ReplyStore = Record<string, ReplyState>;
const storageKey = (account: string) => `cheesecrypt-reply-views-${account}`;
function load(account: string): ReplyStore {
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey(account)) || '{}');
    const out: ReplyStore = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    for (const [id, value] of Object.entries(raw)) {
      const v = value as Partial<ReplyState> | null;
      if (v && Array.isArray(v.pending) && Array.isArray(v.seen)) out[id] = {
        pending: v.pending.filter((k): k is string => typeof k === 'string'),
        seen: v.seen.filter((k): k is string => typeof k === 'string'),
      };
    }
    return out;
  } catch { return {}; }
}

function save(account: string, store: ReplyStore) {
  // Storage denial/quota must not crash scrolling; retain receipts in memory for this session.
  try { localStorage.setItem(storageKey(account), JSON.stringify(store)); } catch { /* device storage unavailable */ }
}

/** Separate per-message receipts: jumping past a reply never marks that skipped reply viewed. */
export function useCryptReplyNavigation(account: string, active: string | null, thread: ReplyMessage[], resumeAt: number | null, list: RefObject<HTMLOListElement>, onRead?: (time: number) => void, listElement?: HTMLOListElement | null) {
  const [store, setStore] = useState<ReplyStore>(() => load(account));
  const [highlighted, setHighlighted] = useState<{ id: string | null; keys: Set<string> }>({ id: active, keys: new Set() });
  const state = active ? store[active] : undefined;
  const seen = new Set(state?.seen ?? []);
  const savedPending = new Set(state?.pending ?? []);
  const pending = thread.filter(m => m.from !== account && m.missing === 0 && repliesTo(m.text, account)
    && !seen.has(m.key) && (savedPending.has(m.key) || (resumeAt !== null && m.time > resumeAt)));
  const current = useRef({ active, pending, store, thread, onRead });
  current.current = { active, pending, store, thread, onRead };
  const reported = useRef({ active, time: 0 });
  if (reported.current.active !== active) reported.current = { active, time: 0 };

  const consume = useCallback((keys: string[]) => {
    const { active: id, pending: queue, store: latest } = current.current;
    if (!id) return;
    const queued = new Set(queue.map(m => m.key));
    const viewed = keys.filter(k => queued.has(k));
    if (!viewed.length) return;
    const viewedSet = new Set(viewed);
    const old = latest[id] ?? { pending: [], seen: [] };
    const next = { ...latest, [id]: {
      pending: [...new Set([...old.pending, ...queue.map(m => m.key)])].filter(k => !viewedSet.has(k)),
      seen: [...new Set([...old.seen, ...viewed])],
    } };
    current.current.store = next;
    current.current.pending = queue.filter(m => !viewedSet.has(m.key));
    save(account, next);
    setStore(next);
    setHighlighted(prev => ({ id, keys: new Set([...(prev.id === id ? prev.keys : []), ...viewed]) }));
  }, [account]);
  const inspectNow = useCallback(() => {
    const el = list.current;
    if (!el || document.visibilityState === 'hidden') return;
    const bounds = el.getBoundingClientRect();
    const top = Math.max(bounds.top, 0), bottom = Math.min(bounds.bottom, window.innerHeight);
    if (bottom <= top) return;
    const keys: string[] = [];
    for (const node of el.querySelectorAll<HTMLElement>('[data-reply-key]')) {
      const rect = node.getBoundingClientRect();
      if (Math.min(rect.bottom, bottom) - Math.max(rect.top, top) >= Math.min(32, rect.height) && rect.height > 0) {
        const key = node.dataset.replyKey;
        if (key) keys.push(key);
      }
    }
    const visible = new Set(keys);
    const { thread: rows, onRead: read } = current.current;
    const newestVisible = rows.reduce((time, m) => visible.has(m.key) ? Math.max(time, m.time) : time, 0);
    if (read && newestVisible > reported.current.time) {
      reported.current.time = newestVisible;
      read(newestVisible);
    }
    consume(keys);
  }, [list, consume]);
  const frame = useRef<number | null>(null);
  const inspectVisible = useCallback(() => {
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => { frame.current = null; inspectNow(); });
  }, [inspectNow]);
  // Save the queue before a conversation's timestamp marker advances; unseen replies survive switching/reloading.
  useEffect(() => {
    if (!active) return;
    const old = store[active] ?? { pending: [], seen: [] };
    const keys = [...new Set([...old.pending, ...pending.map(m => m.key)])];
    if (keys.length === old.pending.length) return;
    const next = { ...store, [active]: { ...old, pending: keys } };
    current.current.store = next;
    save(account, next);
    setStore(next);
  }, [active, pending, store, account]);
  useEffect(() => {
    const el = list.current;
    if (!el) return;
    const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(inspectVisible, { root: el, threshold: [0, 0.1, 0.5, 1] }) : null;
    const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(inspectVisible) : null;
    resize?.observe(el);
    const observed = new Set<Element>();
    const syncNodes = () => {
      const nodes = new Set(el.querySelectorAll('[data-reply-key]'));
      for (const node of observed) if (!nodes.has(node)) { observer?.unobserve(node); resize?.unobserve(node); observed.delete(node); }
      for (const node of nodes) if (!observed.has(node)) { observer?.observe(node); resize?.observe(node); observed.add(node); }
      inspectVisible();
    };
    syncNodes();
    const mutations = new MutationObserver(syncNodes);
    mutations.observe(el, { childList: true });
    window.addEventListener('scroll', inspectVisible, { passive: true });
    window.addEventListener('resize', inspectVisible);
    document.addEventListener('visibilitychange', inspectVisible);
    return () => {
      observer?.disconnect(); resize?.disconnect(); mutations.disconnect();
      if (frame.current !== null) { cancelAnimationFrame(frame.current); frame.current = null; }
      window.removeEventListener('scroll', inspectVisible); window.removeEventListener('resize', inspectVisible);
      document.removeEventListener('visibilitychange', inspectVisible);
    };
  }, [active, account, list, listElement, inspectVisible]);
  // Updated content/read callbacks use the existing observers, never rebuild them after receipt writes.
  useEffect(() => { inspectVisible(); }, [active, thread, inspectVisible]);
  const jump = () => {
    const el = list.current;
    const next = current.current.pending[0];
    if (!el || !next) return;
    const node = findCryptMessageNode(el, next.key);
    if (!node) return;
    const top = el.scrollTop + node.getBoundingClientRect().top - el.getBoundingClientRect().top - 12;
    if (typeof el.scrollTo === 'function') el.scrollTo({ top, behavior: 'auto' });
    else el.scrollTop = top;
    consume([next.key]);
  };
  return { pending, jump, inspectVisible, highlighted: highlighted.id === active ? highlighted.keys : new Set<string>() };
}