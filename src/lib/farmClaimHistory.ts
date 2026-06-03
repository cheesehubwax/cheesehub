// Lifetime "total claimed" tracker per (account, farm).
//
// Strategy:
//  1. One-time Hyperion baseline per account -> persisted in localStorage.
//  2. After every in-app claim we add the just-claimed amounts to the snapshot.
//  3. UI reads from the snapshot via useFarmClaimTotals (useSyncExternalStore).
//
// We fail soft everywhere: a missing or broken snapshot just means the
// "You've claimed" row isn't rendered - it never breaks the page.

import { FARM_CONTRACT } from "./farm";

export interface ClaimedToken {
  contract: string;
  symbol: string;
  amount: number;
}

export type ClaimTotals = Record<string /* farm_name */, ClaimedToken[]>;

export interface ClaimSnapshot {
  account: string;
  totals: ClaimTotals;
  baselineFetchedAt: number; // unix ms
  lastClaimSeenAt: number;   // unix ms of newest claim included
  version: 1;
}

const STORAGE_PREFIX = "cheesehub:farmClaims:v1:";
const SCHEMA_VERSION = 1 as const;

const HYPERION_ENDPOINTS = [
  "https://wax.eosusa.io",
  "https://wax.greymass.com",
  "https://wax.eu.eosamsterdam.net",
  "https://api.wax.alohaeos.com",
  "https://wax.eosphere.io",
  "https://wax.pink.gg",
];

// ── Storage ────────────────────────────────────────────────────────────────

function storageKey(account: string): string {
  return `${STORAGE_PREFIX}${account}`;
}

export function loadSnapshot(account: string): ClaimSnapshot | null {
  if (!account || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(account));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ClaimSnapshot;
    if (parsed?.version !== SCHEMA_VERSION || parsed.account !== account) return null;
    if (!parsed.totals || typeof parsed.totals !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSnapshot(snap: ClaimSnapshot): void {
  if (!snap.account || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(snap.account), JSON.stringify(snap));
  } catch {
    // Quota / private mode - ignore.
  }
}

export function clearSnapshot(account: string): void {
  if (!account || typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey(account));
  } catch {
    // ignore
  }
}

// ── Pure helpers ───────────────────────────────────────────────────────────

function parseAsset(quantity: string): ClaimedToken | null {
  if (!quantity || typeof quantity !== "string") return null;
  const parts = quantity.trim().split(/\s+/);
  if (parts.length !== 2) return null;
  const amount = parseFloat(parts[0]);
  if (!Number.isFinite(amount)) return null;
  return { contract: "", symbol: parts[1], amount };
}

export function addClaimToTotals(
  totals: ClaimTotals,
  farmName: string,
  claimed: ClaimedToken[],
): ClaimTotals {
  if (!farmName || !claimed?.length) return totals;
  const existing = totals[farmName] || [];
  const merged: ClaimedToken[] = existing.map((t) => ({ ...t }));
  for (const c of claimed) {
    if (!c.symbol || !Number.isFinite(c.amount) || c.amount <= 0) continue;
    const idx = merged.findIndex(
      (m) => m.symbol === c.symbol && m.contract === c.contract,
    );
    if (idx >= 0) {
      merged[idx].amount += c.amount;
    } else {
      merged.push({ ...c });
    }
  }
  return { ...totals, [farmName]: merged };
}

// ── Hyperion baseline fetch ────────────────────────────────────────────────

interface HyperionAction {
  "@timestamp"?: string;
  trx_id?: string;
  act?: {
    account?: string;
    name?: string;
    data?: Record<string, unknown>;
  };
}

interface HyperionActionsResponse {
  actions?: HyperionAction[];
}

interface HyperionTransactionResponse {
  actions?: HyperionAction[];
  trx_id?: string;
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

async function withHyperionFallback<T>(
  build: (base: string) => string,
  signal?: AbortSignal,
): Promise<T> {
  let lastErr: unknown = null;
  for (const base of HYPERION_ENDPOINTS) {
    try {
      return await fetchJson<T>(build(base), signal);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("All Hyperion mirrors failed");
}

export async function fetchBaselineFromHyperion(
  account: string,
  signal?: AbortSignal,
): Promise<{ totals: ClaimTotals; lastClaimSeenAt: number }> {
  if (!account) return { totals: {}, lastClaimSeenAt: 0 };

  const PAGE_SIZE = 1000;
  const MAX_PAGES = 10;
  type ClaimRef = { trxId: string; farmName: string; ts: number };
  const claimRefs: ClaimRef[] = [];
  let skip = 0;
  let newestTs = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await withHyperionFallback<HyperionActionsResponse>(
      (base) =>
        `${base}/v2/history/get_actions` +
        `?account=${encodeURIComponent(account)}` +
        `&filter=${encodeURIComponent(`${FARM_CONTRACT}:claim`)}` +
        `&limit=${PAGE_SIZE}&skip=${skip}&sort=desc`,
      signal,
    );
    const actions = data.actions || [];
    if (actions.length === 0) break;

    for (const a of actions) {
      const trxId = a.trx_id;
      const ad = (a.act?.data || {}) as Record<string, unknown>;
      const farmName = String(ad.farmname || ad.farm_name || "");
      const user = String(ad.user || "");
      if (!trxId || !farmName) continue;
      if (user && user !== account) continue;
      const ts = a["@timestamp"] ? Date.parse(a["@timestamp"]) : 0;
      if (Number.isFinite(ts) && ts > newestTs) newestTs = ts;
      claimRefs.push({ trxId, farmName, ts });
    }

    if (actions.length < PAGE_SIZE) break;
    skip += PAGE_SIZE;
  }

  if (claimRefs.length === 0) {
    return { totals: {}, lastClaimSeenAt: 0 };
  }

  const uniqueTrxIds = Array.from(new Set(claimRefs.map((c) => c.trxId)));
  const farmByTrx = new Map<string, string>();
  for (const c of claimRefs) {
    if (!farmByTrx.has(c.trxId)) farmByTrx.set(c.trxId, c.farmName);
  }

  const totals: ClaimTotals = {};
  const CONCURRENCY = 5;

  async function processOne(trxId: string): Promise<void> {
    const farmName = farmByTrx.get(trxId);
    if (!farmName) return;
    let resp: HyperionTransactionResponse;
    try {
      resp = await withHyperionFallback<HyperionTransactionResponse>(
        (base) =>
          `${base}/v2/history/get_transaction?id=${encodeURIComponent(trxId)}`,
        signal,
      );
    } catch {
      return;
    }
    const traces = resp.actions || [];
    const claimed: ClaimedToken[] = [];
    for (const t of traces) {
      if (t.act?.name !== "transfer") continue;
      const tokenContract = String(t.act?.account || "");
      const d = (t.act?.data || {}) as Record<string, unknown>;
      const to = String(d.to || "");
      const from = String(d.from || "");
      if (to !== account) continue;
      if (from !== FARM_CONTRACT) continue;
      const qty = String(d.quantity || "");
      const parsed = parseAsset(qty);
      if (!parsed) continue;
      parsed.contract = tokenContract;
      claimed.push(parsed);
    }
    if (claimed.length > 0) {
      const next = addClaimToTotals(totals, farmName, claimed);
      totals[farmName] = next[farmName];
    }
  }

  for (let i = 0; i < uniqueTrxIds.length; i += CONCURRENCY) {
    const batch = uniqueTrxIds.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(processOne));
  }

  return { totals, lastClaimSeenAt: newestTs };
}

// ── In-memory store + subscription ─────────────────────────────────────────

type Listener = () => void;

interface AccountState {
  snapshot: ClaimSnapshot | null;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  fetchPromise: Promise<void> | null;
}

const accountStates = new Map<string, AccountState>();
const listeners = new Map<string, Set<Listener>>();

function getAccountState(account: string): AccountState {
  let s = accountStates.get(account);
  if (!s) {
    s = {
      snapshot: loadSnapshot(account),
      status: "idle",
      error: null,
      fetchPromise: null,
    };
    accountStates.set(account, s);
  }
  return s;
}

function emit(account: string): void {
  const set = listeners.get(account);
  if (!set) return;
  for (const l of set) l();
}

export function subscribeAccount(account: string, listener: Listener): () => void {
  let set = listeners.get(account);
  if (!set) {
    set = new Set();
    listeners.set(account, set);
  }
  set.add(listener);
  return () => {
    const s = listeners.get(account);
    if (!s) return;
    s.delete(listener);
    if (s.size === 0) listeners.delete(account);
  };
}

export function getAccountSnapshot(account: string): ClaimSnapshot | null {
  return getAccountState(account).snapshot;
}

export function getAccountStatus(account: string): AccountState["status"] {
  return getAccountState(account).status;
}

export function ensureBaseline(
  account: string,
  opts: { force?: boolean; staleAfterMs?: number } = {},
): Promise<void> {
  const { force = false, staleAfterMs = 24 * 60 * 60 * 1000 } = opts;
  const state = getAccountState(account);

  if (state.fetchPromise) return state.fetchPromise;

  const isStale =
    !state.snapshot ||
    Date.now() - state.snapshot.baselineFetchedAt > staleAfterMs;

  if (!force && !isStale && state.snapshot) {
    state.status = "ready";
    return Promise.resolve();
  }

  state.status = state.snapshot ? "ready" : "loading";
  emit(account);

  const p = (async () => {
    try {
      const { totals, lastClaimSeenAt } = await fetchBaselineFromHyperion(account);
      const next: ClaimSnapshot = {
        account,
        totals,
        baselineFetchedAt: Date.now(),
        lastClaimSeenAt,
        version: SCHEMA_VERSION,
      };
      state.snapshot = next;
      state.status = "ready";
      state.error = null;
      saveSnapshot(next);
    } catch (e) {
      state.status = state.snapshot ? "ready" : "error";
      state.error = e instanceof Error ? e.message : "Failed to load claim history";
    } finally {
      state.fetchPromise = null;
      emit(account);
    }
  })();

  state.fetchPromise = p;
  return p;
}

export function applyClaimToAccount(
  account: string,
  farmName: string,
  claimed: ClaimedToken[],
): void {
  if (!account || !farmName || !claimed?.length) return;
  const state = getAccountState(account);
  const prev: ClaimSnapshot =
    state.snapshot ?? {
      account,
      totals: {},
      baselineFetchedAt: 0,
      lastClaimSeenAt: 0,
      version: SCHEMA_VERSION,
    };
  const nextTotals = addClaimToTotals(prev.totals, farmName, claimed);
  const next: ClaimSnapshot = {
    ...prev,
    totals: nextTotals,
    lastClaimSeenAt: Date.now(),
  };
  state.snapshot = next;
  state.status = "ready";
  saveSnapshot(next);
  emit(account);
}

export function claimableBalancesToClaimed(
  balances: Array<{ quantity: string; contract: string }> | undefined,
): ClaimedToken[] {
  if (!balances?.length) return [];
  const out: ClaimedToken[] = [];
  for (const b of balances) {
    const parsed = parseAsset(b.quantity);
    if (!parsed) continue;
    if (parsed.amount <= 0) continue;
    parsed.contract = b.contract || "";
    out.push(parsed);
  }
  return out;
}
