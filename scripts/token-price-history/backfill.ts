/**
 * One-time WAX/USD backfill for the token-price-data branch.
 *
 * Sources: Bitfinex tWAXUSD daily candles (Dec 2019 → Binance listing) and
 * Binance WAXPUSDT daily klines (Aug 2021 → today; preferred where both exist).
 * Missing days carry the previous close forward for up to 7 days.
 *
 * Writes:
 *   data/wax-usd-history.json   { "YYYY-MM-DD": usdPerWax, ... }
 *   data/days/YYYY-MM-DD.json   waxUsd filled in; existing `prices` kept intact
 *   data/index.json             every recorded date
 *
 * Env: TOKEN_PRICE_DIR (data directory), FROM (default 2019-12-01)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DAY = 86_400_000;
const CARRY_DAYS = 7;
const dayOf = (ts: number) => new Date(ts).toISOString().slice(0, 10);

async function getJson(url: string): Promise<unknown> {
  let last: unknown;
  for (let i = 0; i < 4; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      if (res.status === 429) throw new Error("rate limited");
      if (!res.ok) throw new Error(`${res.status} from ${url}`);
      return await res.json();
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 3000 * (i + 1)));
    }
  }
  throw last instanceof Error ? last : new Error(`Failed: ${url}`);
}

async function bitfinex(from: number): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  let start = from;
  while (start < Date.now()) {
    const rows = (await getJson(
      `https://api-pub.bitfinex.com/v2/candles/trade:1D:tWAXUSD/hist?sort=1&limit=1000&start=${start}`,
    )) as number[][];
    if (!Array.isArray(rows) || !rows.length) break;
    for (const r of rows) if (r[2] > 0) out.set(dayOf(r[0]), r[2]); // [MTS, OPEN, CLOSE, ...]
    const next = rows[rows.length - 1][0] + DAY;
    if (rows.length < 1000 || next <= start) break;
    start = next;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return out;
}

async function binance(from: number): Promise<Map<string, number>> {
  for (const host of ["https://data-api.binance.vision", "https://api.binance.com"]) {
    try {
      const out = new Map<string, number>();
      let start = from;
      while (start <= Date.now()) {
        const rows = (await getJson(
          `${host}/api/v3/klines?symbol=WAXPUSDT&interval=1d&startTime=${start}&limit=1000`,
        )) as [number, string, string, string, string][];
        if (!Array.isArray(rows) || !rows.length) break;
        for (const r of rows) {
          const c = parseFloat(r[4]);
          if (c > 0) out.set(dayOf(r[0]), c);
        }
        start = rows[rows.length - 1][0] + DAY;
        if (rows.length < 1000) break;
      }
      if (out.size) return out;
    } catch (e) {
      console.warn(`Binance host ${host} failed:`, e);
    }
  }
  return new Map();
}

async function main() {
  const dir = process.env.TOKEN_PRICE_DIR;
  if (!dir) throw new Error("TOKEN_PRICE_DIR is required");
  const fromDate = process.env.FROM || "2019-12-01";
  const from = Date.parse(`${fromDate}T00:00:00Z`);

  const [bfx, bnb] = await Promise.all([bitfinex(from), binance(from)]);
  console.log(`Bitfinex days: ${bfx.size}, Binance days: ${bnb.size}`);
  if (bnb.size < 1000) throw new Error("Binance returned too little history — refusing to write");
  if (bfx.size < 300) throw new Error("Bitfinex returned too little history — refusing to write");

  const raw = new Map<string, number>([...bfx, ...bnb]); // Binance wins on overlap

  // Existing recorded days keep their own waxUsd where sources have nothing.
  const historyFile = join(dir, "wax-usd-history.json");
  const prior: Record<string, number> = existsSync(historyFile) ? JSON.parse(readFileSync(historyFile, "utf8")) : {};

  const history: Record<string, number> = {};
  let lastPx = 0, lastTs = 0;
  const today = Math.floor(Date.now() / DAY) * DAY;
  for (let t = from; t <= today; t += DAY) {
    const d = dayOf(t);
    const px = raw.get(d) ?? (prior[d] > 0 ? prior[d] : undefined);
    if (px && px > 0) {
      history[d] = Number(px.toPrecision(6));
      lastPx = px;
      lastTs = t;
    } else if (lastPx > 0 && (t - lastTs) / DAY <= CARRY_DAYS) {
      history[d] = Number(lastPx.toPrecision(6));
    }
  }
  const dates = Object.keys(history).sort();
  writeFileSync(historyFile, JSON.stringify(history));

  const daysDir = join(dir, "days");
  mkdirSync(daysDir, { recursive: true });
  let created = 0, updated = 0;
  for (const d of dates) {
    const f = join(daysDir, `${d}.json`);
    if (existsSync(f)) {
      const day = JSON.parse(readFileSync(f, "utf8"));
      if (!(day.waxUsd > 0)) {
        day.waxUsd = history[d];
        writeFileSync(f, JSON.stringify(day));
        updated++;
      }
    } else {
      writeFileSync(f, JSON.stringify({ date: d, waxUsd: history[d], prices: {} }));
      created++;
    }
  }

  const indexFile = join(dir, "index.json");
  const index = existsSync(indexFile) ? (JSON.parse(readFileSync(indexFile, "utf8")) as { dates?: string[] }) : {};
  const all = new Set([...(index.dates ?? []), ...dates]);
  writeFileSync(indexFile, JSON.stringify({ updatedAt: new Date().toISOString(), dates: [...all].sort() }));
  console.log(`WAX/USD history: ${dates.length} days (${dates[0]} → ${dates[dates.length - 1]}); day files created ${created}, updated ${updated}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
