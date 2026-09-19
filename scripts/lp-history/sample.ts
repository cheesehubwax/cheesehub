/**
 * CHEESEAnal LP snapshot sampler.
 *
 * Twice a day (once per UTC 12h slot, keyed `YYYY-MM-DDTHH`), reads every pool
 * of the chosen base token (CHEESE or HOLE) on Alcor, Taco and Defibox and
 * records, per pool: total USD value, base token held, paired token held,
 * provider count, position count and the base token's price in that pair — plus
 * one row per provider account with the same figures.
 * Run by .github/workflows/lp-history.yml.
 *
 * Env:
 *   LP_HISTORY_DIR  directory of the data branch checkout (required).
 *                   CHEESE writes <dir>/lp-history-index.json and <dir>/days/<slot>.json
 *                   HOLE writes the same files under <dir>/hole/
 *   LP_TOKEN        `cheese` (default) or `hole`
 *   FORCE=1         re-record even when the current 12h slot already has a snapshot
 */

import {
  alcorCheesePairs,
  alcorPairVolume,
  buildPoolSnapshot,
  indexEntryForDay,
  isTrackedPairKey,
  lpTokenConfig,
  mergeIndexDay,
  poolsForPair,
  round,
  selectVenuePairs,
  utcSlot,
  venuePair,
  type LpDayFile,
  type LpIndexFile,
  type LpPoolSnapshot,
  type LpToken,
  type LpTokenKey,
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

/**
 * Alcor pools, read sequentially so the API is never hammered.
 * `withVolume` is true only on the first snapshot of a UTC day, so the recorded
 * rolling-24h volume figures never overlap between the day's two snapshots.
 */
async function sampleAlcor(
  prices: UsdPrices,
  withVolume: boolean,
  token: LpToken,
  isTracked: (pairKey: string) => boolean,
): Promise<LpPoolSnapshot[]> {
  const allPools = await fetchJson<RawPool[]>("/swap/pools");
  const selected = selectVenuePairs(
    alcorCheesePairs(allPools, token, prices),
    undefined,
    undefined,
    isTracked,
  );
  const cheeseUsd = cheeseUsdFrom(prices, token);
  const snapshots: LpPoolSnapshot[] = [];

  for (const { pair } of selected) {
    const pools = poolsForPair(allPools, pair, token);
    if (pools.length === 0) continue;
    const withPositions: { pool: RawPool; positions: RawPosition[] }[] = [];
    for (const pool of pools) {
      // Sequential on purpose: Alcor rate-limits bursts, and a partial day is
      // worse than a slow one.
      const positions = await fetchJson<RawPosition[]>(`/swap/pools/${pool.id}/positions`);
      withPositions.push({ pool, positions: Array.isArray(positions) ? positions : [] });
      await sleep(400);
    }
    const built = buildPoolSnapshot(
      venuePair("alcor", pair),
      withPositions,
      { cheeseUsd, pairedUsd: prices.get(priceKey(pair.symbol, pair.contract)) },
      token,
    );
    const snapshot: LpPoolSnapshot = withVolume
      ? { ...built, ...alcorPairVolume(pools, token) }
      : built;
    if (snapshot.accounts === 0) continue;
    console.log(
      `alcor ${snapshot.label}: $${snapshot.usd.toFixed(2)} • ${snapshot.cheese.toFixed(4)} ${token.symbol} • ` +
        `${snapshot.paired} ${snapshot.symbol} • ${snapshot.accounts} accounts • ` +
        `${snapshot.positions} positions across ${snapshot.poolIds.length} tier(s)` +
        (snapshot.volumeUsd24 !== undefined
          ? ` • 24h volume $${snapshot.volumeUsd24.toFixed(2)} / ${(snapshot.volumeCheese24 ?? 0).toFixed(4)} ${token.symbol}`
          : ""),
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

  const tokenKey = (process.env.LP_TOKEN ?? "cheese").toLowerCase() as LpTokenKey;
  if (tokenKey !== "cheese" && tokenKey !== "hole") {
    throw new Error(`LP_TOKEN must be 'cheese' or 'hole' (got '${process.env.LP_TOKEN}')`);
  }
  const config = lpTokenConfig(tokenKey);
  const token: LpToken = { symbol: config.symbol, contract: config.contract };
  // CHEESE keeps its explicit always-recorded pair list; HOLE is discovery only,
  // so every HOLE pair has to clear the USD floor on its own.
  const isTracked = tokenKey === "cheese" ? isTrackedPairKey : () => false;

  const root = config.dataPath ? `${dir}/${config.dataPath}` : dir;
  const now = Date.now();
  const date = utcSlot(now);
  const indexFile = `${root}/lp-history-index.json`;
  const dayFile = `${root}/days/${date}.json`;

  const index = await readJson<LpIndexFile>(indexFile, { updatedAt: 0, days: [] });
  const alreadyHaveSlot = index.days.some((d) => d.date === date);
  console.log(`[${token.symbol}] Now ${new Date(now).toISOString()} → UTC 12h slot ${date}.`);
  if (alreadyHaveSlot && !force) {
    console.log(`[${token.symbol}] Slot already recorded — skipping.`);
    return;
  }
  if (alreadyHaveSlot && force) {
    console.log(`[${token.symbol}] Slot already recorded, but FORCE=1 — re-recording.`);
  }

  // Surface dropped cron ticks: if the previous 12h slot never got a snapshot,
  // GitHub skipped every tick in it and the recorded series has a visible gap.
  const previousSlot = utcSlot(now - 12 * 60 * 60 * 1000);
  if (index.days.length > 0 && !index.days.some((d) => d.date === previousSlot)) {
    console.warn(
      `Gap detected — no snapshot was ever recorded for slot ${previousSlot}. ` +
        "GitHub's cron queue likely dropped every tick in that slot.",
    );
  }

  // Volume is a rolling 24h figure, so record it once per UTC day only — on the
  // first snapshot of that day — to keep the series free of overlapping points.
  const utcDayPrefix = date.slice(0, 10);
  const earlierSlotToday = index.days.some(
    (d) => d.date.slice(0, 10) === utcDayPrefix && d.date < date,
  );
  const withVolume = !earlierSlotToday;
  console.log(
    withVolume
      ? "First snapshot of this UTC day — recording 24h volume."
      : "Later snapshot of this UTC day — skipping 24h volume.",
  );

  const prices = await fetchUsdPrices();
  const cheeseUsd = cheeseUsdFrom(prices, token);
  console.log(`${token.symbol} price: ${cheeseUsd !== undefined ? `$${cheeseUsd}` : "unavailable"}.`);

  const snapshots: LpPoolSnapshot[] = [];
  const partial: LpVenue[] = [];

  for (const venue of ["alcor", "taco", "defibox"] as const) {
    try {
      const pools =
        venue === "alcor"
          ? await sampleAlcor(prices, withVolume, token, isTracked)
          : await snapshotAmmVenue(venue, prices, {
              pause: () => sleep(300),
              log: (message) => console.log(message),
              withVolume,
              token,
              isTracked,
            });
      // With a tracked pair list, zero pools means the read failed. For a
      // discovery-only token it just means nothing there clears the minimum.
      if (pools.length === 0) {
        if (tokenKey === "cheese") throw new Error(`No ${token.symbol} pools read on ${venue}`);
        console.log(`${venue}: no ${token.symbol} pools above the minimum.`);
        continue;
      }
      snapshots.push(...pools);
    } catch (error) {
      // One venue failing must not cost the whole day.
      console.warn(`${venue} failed:`, (error as Error).message);
      partial.push(venue);
    }
  }

  if (snapshots.length === 0) {
    throw new Error(`No venue could be read for ${token.symbol} — refusing to record a snapshot`);
  }

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
    `[${token.symbol}] Recorded ${date}: ${snapshots.length} pools ` +
      `(${nextIndex.days.length} snapshots in index)` +
      `${partial.length ? ` — missing ${partial.join(", ")}` : ""}.`,
  );
}

main().catch((error) => {
  console.error("LP snapshot failed:", error);
  process.exit(1);
});
