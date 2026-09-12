/**
 * CHEESELytics LP snapshot sampler.
 *
 * Once a day, reads every fee tier of the tracked CHEESE pairs on Alcor and
 * records, per pool: total USD value, CHEESE held, paired token held, provider
 * count and position count — plus one row per provider account with the same
 * figures. Run by .github/workflows/lp-history.yml.
 *
 * Env:
 *   LP_HISTORY_DIR  directory of the data branch checkout (required).
 *                   Writes <dir>/lp-history-index.json and <dir>/days/<date>.json
 *   FORCE=1         re-record even when today's UTC day already has a snapshot
 */

import {
  TRACKED_LP_PAIRS,
  buildPoolSnapshot,
  indexEntryForDay,
  mergeIndexDay,
  poolsForPair,
  round,
  utcDay,
  type LpDayFile,
  type LpIndexFile,
  type LpPoolSnapshot,
  type RawPool,
  type RawPosition,
} from "../../src/lib/lpPools";

const ALCOR_API = "https://wax.alcor.exchange/api/v2";
const TIMEOUT_MS = 25_000;
const RETRIES = 3;
const RETRY_DELAY_MS = 4_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson<T>(path: string): Promise<T> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(`${ALCOR_API}${path}`, { signal: controller.signal });
      if (!response.ok) throw new Error(`Alcor ${path} returned ${response.status}`);
      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
      console.warn(`Attempt ${attempt}/${RETRIES} for ${path} failed:`, (error as Error).message);
      if (attempt < RETRIES) await sleep(RETRY_DELAY_MS * attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Alcor ${path} unavailable`);
}

/** USD price of 1 CHEESE, derived via the WAXUSDC bridge like the frontend does. */
async function fetchCheeseUsd(): Promise<number | undefined> {
  try {
    const tokens = await fetchJson<
      { id?: string; symbol?: string; contract?: string; system_price?: number | string }[]
    >("/tokens");
    const find = (symbol: string, contract: string) =>
      tokens.find(
        (t) =>
          t.id === `${symbol.toLowerCase()}-${contract}` ||
          (t.symbol === symbol && t.contract === contract),
      );
    const waxPerCheese = Number(find("CHEESE", "cheeseburger")?.system_price ?? 0);
    const waxPerUsdc = Number(find("WAXUSDC", "eth.token")?.system_price ?? 0);
    if (waxPerCheese > 0 && waxPerUsdc > 0) return round(waxPerCheese / waxPerUsdc, 8);
  } catch (error) {
    console.warn("CHEESE USD price unavailable:", (error as Error).message);
  }
  return undefined;
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  const handle = Bun.file(file);
  if (!(await handle.exists())) return fallback;
  const text = (await handle.text()).trim();
  if (!text) return fallback;
  return JSON.parse(text) as T;
}

async function main() {
  const dir = process.env.LP_HISTORY_DIR;
  if (!dir) throw new Error("LP_HISTORY_DIR is required");
  const force = process.env.FORCE === "1";

  const now = Date.now();
  const date = utcDay(now);
  const indexFile = `${dir}/lp-history-index.json`;
  const dayFile = `${dir}/days/${date}.json`;

  const index = await readJson<LpIndexFile>(indexFile, { updatedAt: 0, days: [] });
  const alreadyHaveDay = index.days.some((d) => d.date === date);
  console.log(`Now ${new Date(now).toISOString()} → UTC day ${date}.`);
  if (alreadyHaveDay && !force) {
    console.log("Day already recorded — skipping.");
    return;
  }
  if (alreadyHaveDay && force) console.log("Day already recorded, but FORCE=1 — re-recording.");

  const allPools = await fetchJson<RawPool[]>("/swap/pools");

  const snapshots: LpPoolSnapshot[] = [];
  for (const target of TRACKED_LP_PAIRS) {
    const pools = poolsForPair(allPools, target);
    if (pools.length === 0) {
      throw new Error(`No active Alcor pool found for ${target.label}`);
    }
    const withPositions: { pool: RawPool; positions: RawPosition[] }[] = [];
    for (const pool of pools) {
      // Sequential on purpose: Alcor rate-limits bursts, and a partial day is
      // worse than a slow one.
      const positions = await fetchJson<RawPosition[]>(`/swap/pools/${pool.id}/positions`);
      withPositions.push({ pool, positions: Array.isArray(positions) ? positions : [] });
      await sleep(400);
    }
    const snapshot = buildPoolSnapshot(target, withPositions);
    console.log(
      `${target.label}: $${snapshot.usd.toFixed(2)} • ${snapshot.cheese.toFixed(4)} CHEESE • ` +
        `${snapshot.paired} ${target.symbol} • ${snapshot.accounts} accounts • ` +
        `${snapshot.positions} positions across ${snapshot.poolIds.length} tier(s)`,
    );
    snapshots.push(snapshot);
  }

  const cheeseUsd = await fetchCheeseUsd();

  const day: LpDayFile = {
    date,
    t: now,
    ...(cheeseUsd !== undefined ? { cheeseUsd } : {}),
    pools: snapshots,
  };

  await Bun.write(dayFile, `${JSON.stringify(day)}\n`);

  const nextIndex: LpIndexFile = {
    updatedAt: now,
    days: mergeIndexDay(index.days, indexEntryForDay(day)),
  };
  await Bun.write(indexFile, `${JSON.stringify(nextIndex)}\n`);

  console.log(`Recorded ${date} (${nextIndex.days.length} days in index).`);
}

main().catch((error) => {
  console.error("LP snapshot failed:", error);
  process.exit(1);
});
