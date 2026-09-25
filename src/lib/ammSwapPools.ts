// Finds Defibox and TacoSwap pools that pair two tokens directly, and reads
// their live reserves for a quote. The list of which pools exist is kept for a
// while (and saved in the browser); reserves are always read fresh.

import { chainPost, readTable, DEFIBOX_CONTRACT, TACO_CONTRACT } from "./lpVenues";
import type { AmmPoolState, AmmToken, AmmVenue } from "./ammQuote";
import type { SwapToken } from "./swapApi";
import { logger } from "./logger";

interface IndexEntry {
  id: string;
  a: AmmToken;
  b: AmmToken;
}

const INDEX_TTL_MS = 30 * 60_000;
const SAVED_TTL_MS = 6 * 60 * 60_000;
const SAVED_KEY = (v: AmmVenue) => `amm-pair-index-v1-${v}`;
/** The whole Defibox/Taco lookup must never hold up a quote for longer than this. */
export const AMM_FETCH_BUDGET_MS = 4_000;

const memIndex = new Map<AmmVenue, { at: number; data: IndexEntry[] }>();
const inflight = new Map<AmmVenue, Promise<IndexEntry[]>>();

/** "7.2224 CHEESE" → { raw: "72224", decimals: 4, symbol: "CHEESE" } */
export function parseAsset(asset: string | undefined): { raw: string; decimals: number; symbol: string } | null {
  if (!asset) return null;
  const [amount, symbol] = asset.trim().split(/\s+/);
  if (!amount || !symbol) return null;
  const [whole, frac = ""] = amount.split(".");
  const raw = (whole + frac).replace(/^0+(?=\d)/, "") || "0";
  return { raw, decimals: frac.length, symbol };
}

interface TacoRow {
  id?: string;
  pool1?: { quantity?: string; contract?: string };
  pool2?: { quantity?: string; contract?: string };
}
interface DefiboxRow {
  id?: number | string;
  token0?: { contract?: string; symbol?: string };
  token1?: { contract?: string; symbol?: string };
  reserve0?: string;
  reserve1?: string;
}

function tacoTokens(row: TacoRow): { a: AmmToken; b: AmmToken; ra: string; rb: string } | null {
  const p1 = parseAsset(row.pool1?.quantity);
  const p2 = parseAsset(row.pool2?.quantity);
  if (!p1 || !p2 || !row.pool1?.contract || !row.pool2?.contract) return null;
  return {
    a: { symbol: p1.symbol, contract: row.pool1.contract, decimals: p1.decimals },
    b: { symbol: p2.symbol, contract: row.pool2.contract, decimals: p2.decimals },
    ra: p1.raw,
    rb: p2.raw,
  };
}

function defiboxTokens(row: DefiboxRow): { a: AmmToken; b: AmmToken; ra: string; rb: string } | null {
  const sym = (s?: string) => {
    const [d, code] = (s ?? "").split(",");
    return code ? { decimals: Number(d), symbol: code } : null;
  };
  const s0 = sym(row.token0?.symbol);
  const s1 = sym(row.token1?.symbol);
  const r0 = parseAsset(row.reserve0);
  const r1 = parseAsset(row.reserve1);
  if (!s0 || !s1 || !r0 || !r1 || !row.token0?.contract || !row.token1?.contract) return null;
  return {
    a: { symbol: s0.symbol, contract: row.token0.contract, decimals: s0.decimals },
    b: { symbol: s1.symbol, contract: row.token1.contract, decimals: s1.decimals },
    ra: r0.raw,
    rb: r1.raw,
  };
}

function readSaved(venue: AmmVenue): IndexEntry[] | null {
  try {
    const raw = localStorage.getItem(SAVED_KEY(venue));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; data: IndexEntry[] };
    if (!parsed?.data || Date.now() - parsed.at > SAVED_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

async function loadIndex(venue: AmmVenue): Promise<IndexEntry[]> {
  const mem = memIndex.get(venue);
  if (mem && Date.now() - mem.at < INDEX_TTL_MS) return mem.data;
  const saved = readSaved(venue);
  if (saved) {
    memIndex.set(venue, { at: Date.now(), data: saved });
    return saved;
  }
  let p = inflight.get(venue);
  if (!p) {
    p = (async () => {
      const entries: IndexEntry[] = [];
      if (venue === "taco") {
        const rows = await readTable<TacoRow>(TACO_CONTRACT, TACO_CONTRACT, "pairs");
        for (const r of rows) {
          const t = tacoTokens(r);
          if (t && r.id) entries.push({ id: String(r.id), a: t.a, b: t.b });
        }
      } else {
        const rows = await readTable<DefiboxRow>(DEFIBOX_CONTRACT, DEFIBOX_CONTRACT, "pairs");
        for (const r of rows) {
          const t = defiboxTokens(r);
          if (t && r.id != null) entries.push({ id: String(r.id), a: t.a, b: t.b });
        }
      }
      memIndex.set(venue, { at: Date.now(), data: entries });
      try {
        localStorage.setItem(SAVED_KEY(venue), JSON.stringify({ at: Date.now(), data: entries }));
      } catch {
        /* storage full — memory cache still works */
      }
      return entries;
    })().finally(() => inflight.delete(venue));
    inflight.set(venue, p);
  }
  return p;
}

const matches = (t: AmmToken, s: SwapToken) =>
  t.symbol.toUpperCase() === s.ticker.toUpperCase() && t.contract === s.contract;

async function freshPool(venue: AmmVenue, id: string): Promise<AmmPoolState | null> {
  const code = venue === "taco" ? TACO_CONTRACT : DEFIBOX_CONTRACT;
  const res = await chainPost<{ rows?: Array<TacoRow & DefiboxRow> }>("/v1/chain/get_table_rows", {
    json: true,
    code,
    scope: code,
    table: "pairs",
    lower_bound: id,
    upper_bound: id,
    limit: 1,
  });
  const row = res.rows?.[0];
  if (!row || String(row.id) !== id) return null;
  const t = venue === "taco" ? tacoTokens(row) : defiboxTokens(row);
  if (!t || t.ra === "0" || t.rb === "0") return null;
  return {
    venue,
    id,
    contract: venue === "taco" ? "swap.taco" : "swap.box",
    tokenA: t.a,
    tokenB: t.b,
    reserveA: t.ra,
    reserveB: t.rb,
  };
}

async function poolsForVenue(venue: AmmVenue, tokenIn: SwapToken, tokenOut: SwapToken): Promise<AmmPoolState[]> {
  const index = await loadIndex(venue);
  const ids = index
    .filter((e) => (matches(e.a, tokenIn) && matches(e.b, tokenOut)) || (matches(e.a, tokenOut) && matches(e.b, tokenIn)))
    .map((e) => e.id);
  const fresh = await Promise.all(ids.map((id) => freshPool(venue, id).catch(() => null)));
  return fresh.filter((p): p is AmmPoolState => !!p);
}

/** Warm the pool lists as soon as both tokens are picked. */
export function prefetchAmmIndexes(): void {
  void loadIndex("defibox").catch(() => {});
  void loadIndex("taco").catch(() => {});
}

/**
 * Live Defibox + Taco pools that pair the two tokens directly. Never throws and
 * never waits longer than the budget: a venue that fails or is slow is left out.
 */
export async function fetchAmmPoolsFor(tokenIn: SwapToken, tokenOut: SwapToken): Promise<AmmPoolState[]> {
  const venues: AmmVenue[] = ["defibox", "taco"];
  const results = await Promise.all(
    venues.map((v) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<AmmPoolState[]>((resolve) => {
        timer = setTimeout(() => {
          logger.warn(`[amm-router] ${v} pools too slow — quoting without them`);
          resolve([]);
        }, AMM_FETCH_BUDGET_MS);
      });
      return Promise.race([
        poolsForVenue(v, tokenIn, tokenOut).catch((e) => {
          logger.warn(`[amm-router] ${v} pools unavailable`, e);
          return [] as AmmPoolState[];
        }),
        timeout,
      ]).finally(() => clearTimeout(timer));
    }),
  );
  return results.flat();
}
