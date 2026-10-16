/**
 * CHEESEFolio daily token price recorder.
 *
 * Records one file per UTC day with the WAX price of every priced Alcor token
 * plus the WAX/USD rate. Public market data only — never any user data.
 * Run by .github/workflows/token-price-history.yml.
 *
 * Env:
 *   TOKEN_PRICE_DIR  data directory (contains index.json and days/)
 *   FORCE=1          overwrite today's file if it already exists
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { recordTokenRegistry } from './registry';

const ALCOR_TOKENS_URL = "https://wax.alcor.exchange/api/v2/tokens";
const TIMEOUT_MS = 20_000;

interface AlcorToken {
  symbol?: string;
  contract?: string;
  system_price?: number | string;
  usd_price?: number | string;
  is_scam?: boolean;
  decimals?: number;
}

async function fetchTokens(): Promise<AlcorToken[]> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(ALCOR_TOKENS_URL, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`Alcor tokens returned ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Alcor tokens returned an unexpected payload");
      return data as AlcorToken[];
    } catch (error) {
      lastError = error;
      await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Alcor tokens unavailable");
}

async function main() {
  const dir = process.env.TOKEN_PRICE_DIR;
  if (!dir) throw new Error("TOKEN_PRICE_DIR is required");
  const force = process.env.FORCE === "1";
  const date = new Date().toISOString().slice(0, 10);
  const daysDir = join(dir, "days");
  mkdirSync(daysDir, { recursive: true });
  const dayFile = join(daysDir, `${date}.json`);
  const tokens = await fetchTokens();
  await recordTokenRegistry(dir, tokens);
  if (existsSync(dayFile) && !force) {
    console.log(`${date} already recorded — nothing to do.`);
    return;
  }

  const prices: Record<string, number> = {};
  let waxUsd = 0;
  for (const t of tokens) {
    if (!t.symbol || !t.contract || t.is_scam) continue;
    const px = Number(t.system_price ?? 0);
    if (!(px > 0) || !Number.isFinite(px)) continue;
    prices[`${t.contract}:${t.symbol}`] = Number(px.toPrecision(8));
    if (t.symbol === "WAX" && t.contract === "eosio.token") waxUsd = Number(t.usd_price ?? 0);
  }
  if (!waxUsd) {
    const usdc = tokens.find((t) => t.symbol === "WAXUSDC" && t.contract === "eth.token");
    const px = Number(usdc?.system_price ?? 0);
    if (px > 0) waxUsd = 1 / px;
  }
  const count = Object.keys(prices).length;
  if (count < 50) throw new Error(`Only ${count} priced tokens returned — refusing to record a partial day`);

  writeFileSync(dayFile, JSON.stringify({ date, waxUsd, prices }));
  // Keep the consolidated WAX/USD map (written by backfill.ts) current.
  if (waxUsd > 0) {
    const historyFile = join(dir, "wax-usd-history.json");
    const history: Record<string, number> = existsSync(historyFile)
      ? JSON.parse(readFileSync(historyFile, "utf8"))
      : {};
    history[date] = Number(waxUsd.toPrecision(6));
    const sorted = Object.fromEntries(Object.entries(history).sort(([a], [b]) => a.localeCompare(b)));
    writeFileSync(historyFile, JSON.stringify(sorted));
  }
  // Keep the consolidated CHEESE map (written by cheese-backfill.ts) current.
  const cheeseWax = prices["cheeseburger:CHEESE"];
  if (cheeseWax > 0) {
    const cheeseFile = join(dir, "cheese-usd-history.json");
    const cheese: Record<string, { wax: number; usd: number | null }> = existsSync(cheeseFile)
      ? JSON.parse(readFileSync(cheeseFile, "utf8"))
      : {};
    cheese[date] = {
      wax: cheeseWax,
      usd: waxUsd > 0 ? Number((cheeseWax * waxUsd).toPrecision(6)) : null,
    };
    const sortedCheese = Object.fromEntries(Object.entries(cheese).sort(([a], [b]) => a.localeCompare(b)));
    writeFileSync(cheeseFile, JSON.stringify(sortedCheese));
  }
  const indexFile = join(dir, "index.json");
  const index = existsSync(indexFile)
    ? (JSON.parse(readFileSync(indexFile, "utf8")) as { dates?: string[] })
    : { dates: [] };
  const dates = new Set(index.dates ?? []);
  dates.add(date);
  writeFileSync(indexFile, JSON.stringify({ updatedAt: new Date().toISOString(), dates: [...dates].sort() }));
  console.log(`Recorded ${count} token prices for ${date} (WAX $${waxUsd.toFixed(5)}).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
