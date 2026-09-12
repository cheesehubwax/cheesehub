/**
 * CHEESEAnal LP snapshot sampler.
 *
 * Twice a day (once per UTC 12h slot, keyed `YYYY-MM-DDTHH`), reads every
 * CHEESE pool on Alcor, Taco and Defibox and records, per pool: total USD
 * value, CHEESE held, paired token held, provider count, position count and
 * the CHEESE price in that pair — plus one row per provider account with the
 * same figures. Run by .github/workflows/lp-history.yml.
 *
 * Env:
 *   LP_HISTORY_DIR  directory of the data branch checkout (required).
 *                   Writes <dir>/lp-history-index.json and <dir>/days/<slot>.json
 *   FORCE=1         re-record even when the current 12h slot already has a snapshot
 */

import {
  alcorCheesePairs,
  buildPoolSnapshot,
  indexEntryForDay,
  mergeIndexDay,
  poolsForPair,
  round,
  selectVenuePairs,
  utcSlot,
  venuePair,
  type LpDayFile,
  type LpIndexFile,
  type LpPoolSnapshot,
  type LpVenue,
  type RawPool,
  type RawPosition,
} from "../../src/lib/lpPools";
import {
  cheeseUsdFrom,
  fetchUsdPrices,
  priceKey,
  snapshotAmmVenue,
  type UsdPrices,
} from "../../src/lib/lpVenues";

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

/** Alcor pools, read sequentially so the API is never hammered. */
async function sampleAlcor(prices: UsdPrices): Promise<LpPoolSnapshot[]> {
  const allPools = await fetchJson<RawPool[]>("/swap/pools");
  const selected = selectVenuePairs(alcorCheesePairs(allPools));
  const cheeseUsd = cheeseUsdFrom(prices);
  const snapshots: LpPoolSnapshot[] = [];

  for (const { pair } of selected) {
    const pools = poolsForPair(allPools, pair);
    if (pools.length === 0) continue;
    const withPositions: { pool: RawPool; positions: RawPosition[] }[] = [];
    for (const pool of pools) {
      // Sequential on purpose: Alcor rate-limits bursts, and a partial day is
      // worse than a slow one.
      const positions = await fetchJson<RawPosition[]>(`/swap/pools/${pool.id}/positions`);
      withPositions.push({ pool, positions: Array.isArray(positions) ? positions : [] });
      await sleep(400);
    }
    const snapshot = buildPoolSnapshot(venuePair("alcor", pair), withPositions, {
      cheeseUsd,
      pairedUsd: prices.get(priceKey(pair.symbol, pair.contract)),
    });
    if (snapshot.accounts === 0) continue;
    console.log(
      `alcor ${snapshot.label}: $${snapshot.usd.toFixed(2)} • ${snapshot.cheese.toFixed(4)} CHEESE • ` +
        `${snapshot.paired} ${snapshot.symbol} • ${snapshot.accounts} accounts • ` +
        `${snapshot.positions} positions across ${snapshot.poolIds.length} tier(s)`,
    );
    snapshots.push(snapshot);
  }
  return snapshots;
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
  const date = utcSlot(now);
  const indexFile = `${dir}/lp-history-index.json`;
  const dayFile = `${dir}/days/${date}.json`;

  const index = await readJson<LpIndexFile>(indexFile, { updatedAt: 0, days: [] });
  const alreadyHaveSlot = index.days.some((d) => d.date === date);
  console.log(`Now ${new Date(now).toISOString()} → UTC 12h slot ${date}.`);
  if (alreadyHaveSlot && !force) {
    console.log("Slot already recorded — skipping.");
    return;
  }
  if (alreadyHaveSlot && force) console.log("Slot already recorded, but FORCE=1 — re-recording.");

  const prices = await fetchUsdPrices();
  const cheeseUsd = cheeseUsdFrom(prices);
  console.log(`CHEESE price: ${cheeseUsd !== undefined ? `$${cheeseUsd}` : "unavailable"}.`);

  const snapshots: LpPoolSnapshot[] = [];
  const partial: LpVenue[] = [];

  for (const venue of ["alcor", "taco", "defibox"] as const) {
    try {
      const pools =
        venue === "alcor"
          ? await sampleAlcor(prices)
          : await snapshotAmmVenue(venue, prices, {
              pause: () => sleep(300),
              log: (message) => console.log(message),
            });
      if (pools.length === 0) throw new Error(`No CHEESE pools read on ${venue}`);
      snapshots.push(...pools);
    } catch (error) {
      // One venue failing must not cost the whole day.
      console.warn(`${venue} failed:`, (error as Error).message);
      partial.push(venue);
    }
  }

  if (snapshots.length === 0) throw new Error("No venue could be read — refusing to record a snapshot");

  snapshots.sort((a, b) => b.usd - a.usd || a.key.localeCompare(b.key));

  const day: LpDayFile = {
    date,
    t: now,
    ...(cheeseUsd !== undefined ? { cheeseUsd: round(cheeseUsd, 8) } : {}),
    pools: snapshots,
    ...(partial.length ? { partial } : {}),
  };

  await Bun.write(dayFile, `${JSON.stringify(day)}\n`);

  const nextIndex: LpIndexFile = {
    updatedAt: now,
    days: mergeIndexDay(index.days, indexEntryForDay(day)),
  };
  await Bun.write(indexFile, `${JSON.stringify(nextIndex)}\n`);

  console.log(
    `Recorded ${date}: ${snapshots.length} pools (${nextIndex.days.length} snapshots in index)` +
      `${partial.length ? ` — missing ${partial.join(", ")}` : ""}.`,
  );
}

main().catch((error) => {
  console.error("LP snapshot failed:", error);
  process.exit(1);
});
