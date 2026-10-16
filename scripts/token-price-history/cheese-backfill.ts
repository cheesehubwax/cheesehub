/**
 * One-time CHEESE price backfill for the token-price-data branch.
 *
 * Source: Alcor CHEESE/WAX pool 1252 daily candles (close = WAX per CHEESE).
 * Alcor pads the series back to 1970 with a flat price, so days before the
 * pool's first traded day are dropped. Quiet days inside the range keep
 * Alcor's carried close (that is the pool price that day — nothing traded).
 * USD = WAX per CHEESE × that day's USD per WAX from wax-usd-history.json.
 *
 * Writes:
 *   data/cheese-usd-history.json  { "YYYY-MM-DD": { "wax": waxPerCheese, "usd": usdPerCheese|null } }
 *   data/days/YYYY-MM-DD.json     adds prices["cheeseburger:CHEESE"] only where it is missing
 *
 * Recorded values are never overwritten. Env: TOKEN_PRICE_DIR
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const POOL_ID = 1252;
const CHEESE_KEY = "cheeseburger:CHEESE";
const dayOf = (ts: number) => new Date(ts).toISOString().slice(0, 10);

interface Candle { time: number; close: string; volume: number }
export interface CheeseDay { wax: number; usd: number | null }

async function getJson(url: string): Promise<unknown> {
  let last: unknown;
  for (let i = 0; i < 4; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`${res.status} from ${url}`);
      return await res.json();
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 3000 * (i + 1)));
    }
  }
  throw last instanceof Error ? last : new Error(`Failed: ${url}`);
}

async function main() {
  const dir = process.env.TOKEN_PRICE_DIR;
  if (!dir) throw new Error("TOKEN_PRICE_DIR is required");

  // Sanity: confirm pool 1252 is still CHEESE (A) / WAX (B), so close = WAX per CHEESE.
  const pool = (await getJson(`https://wax.alcor.exchange/api/v2/swap/pools/${POOL_ID}`)) as {
    tokenA?: { symbol?: string; contract?: string };
    tokenB?: { symbol?: string; contract?: string };
  };
  if (pool.tokenA?.contract !== "cheeseburger" || pool.tokenA?.symbol !== "CHEESE" ||
      pool.tokenB?.contract !== "eosio.token" || pool.tokenB?.symbol !== "WAX") {
    throw new Error(`Pool ${POOL_ID} is not CHEESE/WAX — refusing to write`);
  }

  const candles = (await getJson(
    `https://wax.alcor.exchange/api/v2/swap/pools/${POOL_ID}/candles?resolution=1D&from=0&to=${Date.now()}`,
  )) as Candle[];
  if (!Array.isArray(candles) || candles.length < 100) throw new Error("Alcor returned too few candles — refusing to write");
  candles.sort((a, b) => a.time - b.time);
  const firstTraded = candles.findIndex((c) => c.volume > 0);
  if (firstTraded < 0) throw new Error("No traded candles found");

  const usdFile = join(dir, "wax-usd-history.json");
  if (!existsSync(usdFile)) throw new Error("wax-usd-history.json missing — run the WAX/USD backfill first");
  const waxUsd = JSON.parse(readFileSync(usdFile, "utf8")) as Record<string, number>;

  const histFile = join(dir, "cheese-usd-history.json");
  const history: Record<string, CheeseDay> = existsSync(histFile) ? JSON.parse(readFileSync(histFile, "utf8")) : {};

  let added = 0;
  for (const c of candles.slice(firstTraded)) {
    const d = dayOf(c.time);
    const wax = parseFloat(c.close);
    if (!(wax > 0) || history[d]) continue; // keep recorded days
    const rate = waxUsd[d];
    history[d] = { wax: Number(wax.toPrecision(8)), usd: rate > 0 ? Number((wax * rate).toPrecision(6)) : null };
    added++;
  }
  // Fill USD on earlier entries that lacked a WAX/USD rate at the time.
  for (const [d, v] of Object.entries(history)) {
    if (v.usd == null && waxUsd[d] > 0) v.usd = Number((v.wax * waxUsd[d]).toPrecision(6));
  }
  const sorted = Object.fromEntries(Object.entries(history).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(histFile, JSON.stringify(sorted));

  const daysDir = join(dir, "days");
  mkdirSync(daysDir, { recursive: true });
  let dayUpdated = 0;
  for (const [d, v] of Object.entries(sorted)) {
    const f = join(daysDir, `${d}.json`);
    if (!existsSync(f)) continue; // day files are created by the WAX/USD backfill
    const day = JSON.parse(readFileSync(f, "utf8"));
    day.prices ??= {};
    if (!(day.prices[CHEESE_KEY] > 0)) {
      day.prices[CHEESE_KEY] = v.wax;
      writeFileSync(f, JSON.stringify(day));
      dayUpdated++;
    }
  }
  const dates = Object.keys(sorted);
  console.log(`CHEESE history: ${dates.length} days (${dates[0]} → ${dates[dates.length - 1]}); added ${added}; day files given a CHEESE price ${dayUpdated}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
