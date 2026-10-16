/**
 * One-time (re-runnable) RAM price backfill for the ram-price-data branch.
 *
 * Source: Hyperion `get_deltas` for the `eosio::rammarket` table. Every change
 * to the Bancor reserves is stored as a table delta, so the exact on-chain
 * state (RAM bytes + WAX reserve) at any past moment can be read back. The
 * price is computed the same way the live sampler does it:
 *   waxPerKb = quote WAX / base bytes × 1024
 *
 * For each 12h UTC slot (same slot rule as sample.ts) the first rammarket
 * state inside the slot is recorded. Slots that already hold a sample are
 * never touched, so live samples always win and re-runs only fill gaps.
 * The current slot is left to the live sampler.
 *
 * Backfilled records have `cheesePerKb` / `waxPerCheese` set to null — no
 * CHEESE price history exists for those dates. `usdPerKb` comes from the
 * consolidated WAX/USD history (null when that day has no USD rate).
 *
 * Env:
 *   RAM_HISTORY_FILE  JSON file to merge into (required)
 *   FROM              first UTC day to backfill (default 2019-06-20)
 *   TO                last UTC day to backfill (default: up to the slot before now)
 *   WAX_USD_URL       override for the consolidated WAX/USD map
 */
import { applyHealthOrder } from "../shared/herdcheck";
import { cheeseFields, loadCheeseDays, type CheeseDays } from "./cheesePrice";

/** Only these providers index rammarket table deltas back to WAX genesis. */
const DELTA_ENDPOINTS = ["https://wax-history.eosdac.io", "https://wax.eosdac.io"];

const WAX_USD_URL =
  process.env.WAX_USD_URL ??
  "https://raw.githubusercontent.com/cheesehubwax/cheesehub/token-price-data/data/wax-usd-history.json";

const SLOT_LENGTH_MS = 12 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;
const MAX_RECORDS = 20_000;
const CONCURRENCY = 3;
const ATTEMPTS = 4;
const TIMEOUT_MS = 30_000;
const CHECKPOINT_EVERY = 400;
/** Carry a WAX/USD rate forward this many days at most when a day is missing. */
const USD_CARRY_DAYS = 7;

interface RamHistoryRecord {
  t: number;
  waxPerKb: number;
  cheesePerKb: number | null;
  waxPerCheese: number | null;
  usdPerKb: number | null;
}

interface RamMarketDelta {
  timestamp?: string;
  present?: number | boolean;
  data?: { base?: { balance?: string }; quote?: { balance?: string } };
}

const slotStart = (t: number) => Math.floor(t / SLOT_LENGTH_MS) * SLOT_LENGTH_MS;
const iso = (t: number) => new Date(t).toISOString();
const parseAsset = (v: unknown) => parseFloat(String(v ?? "").split(" ")[0]) || 0;
const round = (v: number, d: number) => Number(v.toFixed(d));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function parseDay(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const t = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(t)) throw new Error(`Invalid date: ${value}`);
  return t;
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${res.status} from ${new URL(url).host}`);
  return res.json();
}

/**
 * First rammarket state inside [start, start + 12h). Returns null when the
 * deep providers agree the slot has no change; throws when none answered.
 */
async function fetchSlot(start: number): Promise<RamHistoryRecord | null> {
  const end = start + SLOT_LENGTH_MS - 1;
  const query =
    `/v2/history/get_deltas?code=eosio&scope=eosio&table=rammarket&limit=1&sort=asc` +
    `&after=${iso(start)}&before=${iso(end)}`;
  let lastError: unknown = null;
  let answered = false;

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    for (const base of DELTA_ENDPOINTS) {
      try {
        const data = (await getJson(`${base}${query}`)) as { deltas?: RamMarketDelta[] };
        answered = true;
        const delta = (data.deltas ?? []).find((d) => d.present === undefined || Number(d.present) === 1);
        if (!delta) continue; // try the other deep provider before calling the slot empty
        const bytes = parseAsset(delta.data?.base?.balance);
        const wax = parseAsset(delta.data?.quote?.balance);
        const t = Date.parse(`${String(delta.timestamp).replace(/Z?$/, "Z")}`);
        if (!(bytes > 0) || !(wax > 0) || !Number.isFinite(t) || t < start || t > end) {
          lastError = new Error(`${base} returned an invalid rammarket delta`);
          continue;
        }
        return { t, waxPerKb: round((wax / bytes) * 1024, 8), cheesePerKb: null, waxPerCheese: null, usdPerKb: null };
      } catch (error) {
        lastError = error;
      }
    }
    if (answered) return null;
    // Rate limits (429) come in bursts lasting tens of seconds: back off much longer.
    const limited = lastError instanceof Error && lastError.message.startsWith("429");
    await sleep((limited ? 15_000 : 2000) * (attempt + 1));
  }
  throw lastError instanceof Error ? lastError : new Error("rammarket deltas unavailable");
}

async function loadWaxUsd(): Promise<Map<string, number>> {
  try {
    const map = (await getJson(WAX_USD_URL)) as Record<string, number>;
    const out = new Map<string, number>();
    for (const [day, rate] of Object.entries(map)) if (Number(rate) > 0) out.set(day, Number(rate));
    console.log(`Loaded ${out.size} WAX/USD days.`);
    return out;
  } catch (error) {
    console.warn("WAX/USD history unavailable — usdPerKb left empty:", (error as Error).message);
    return new Map();
  }
}

function usdOn(rates: Map<string, number>, t: number): number | null {
  for (let i = 0; i <= USD_CARRY_DAYS; i++) {
    const rate = rates.get(new Date(t - i * DAY_MS).toISOString().slice(0, 10));
    if (rate) return rate;
  }
  return null;
}

async function readHistory(file: string): Promise<RamHistoryRecord[]> {
  const handle = Bun.file(file);
  if (!(await handle.exists())) return [];
  const text = (await handle.text()).trim();
  if (!text) return [];
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error(`${file} does not contain a JSON array`);
  return parsed as RamHistoryRecord[];
}

async function writeMerged(file: string, existing: RamHistoryRecord[], added: RamHistoryRecord[]) {
  // Every existing record is kept as-is (older runs may hold two live samples
  // in one slot); a backfilled record only lands in a slot nothing else holds.
  const kept = existing.filter((r) => Number.isFinite(r?.t) && r.waxPerKb > 0);
  const taken = new Set(kept.map((r) => slotStart(r.t)));
  const merged = [...kept, ...added.filter((r) => !taken.has(slotStart(r.t)))];
  const next = merged.sort((a, b) => a.t - b.t).slice(-MAX_RECORDS);
  await Bun.write(file, `${JSON.stringify(next)}\n`);
  return next.length;
}

async function main() {
  const file = process.env.RAM_HISTORY_FILE;
  if (!file) throw new Error("RAM_HISTORY_FILE is required");
  await applyHealthOrder(DELTA_ENDPOINTS, "hyperion-v2");

  const from = slotStart(parseDay(process.env.FROM, Date.parse("2019-06-20T00:00:00.000Z")));
  const lastAllowed = slotStart(Date.now()) - SLOT_LENGTH_MS; // current slot belongs to the sampler
  const to = process.env.TO
    ? Math.min(lastAllowed, parseDay(process.env.TO, 0) + DAY_MS - SLOT_LENGTH_MS)
    : lastAllowed;

  const existing = await readHistory(file);
  const filled = new Set(existing.map((r) => slotStart(r.t)));
  const slots: number[] = [];
  for (let s = from; s <= to; s += SLOT_LENGTH_MS) if (!filled.has(s)) slots.push(s);
  console.log(
    `Backfilling ${iso(from)} → ${iso(to + SLOT_LENGTH_MS)}: ${slots.length} empty slots ` +
      `(${existing.length} existing samples kept).`,
  );

  const rates = await loadWaxUsd();
  const cheeseDays = await loadCheeseDays().catch((error) => {
    console.warn("CHEESE history unavailable — CHEESE fields left empty:", (error as Error).message);
    return new Map() as CheeseDays;
  });
  const added: RamHistoryRecord[] = [];
  const failed: number[] = [];
  let empty = 0;
  let done = 0;
  let cursor = 0;

  const worker = async () => {
    while (cursor < slots.length) {
      const slot = slots[cursor++];
      try {
        const record = await fetchSlot(slot);
        if (record) {
          const usd = usdOn(rates, record.t);
          record.usdPerKb = usd ? round(record.waxPerKb * usd, 8) : null;
          const cheese = cheeseFields(cheeseDays, record.t, record.waxPerKb);
          if (cheese) Object.assign(record, cheese);
          added.push(record);
        } else {
          empty++;
        }
      } catch (error) {
        failed.push(slot);
        console.warn(`Slot ${iso(slot)} failed:`, (error as Error).message);
      }
      done++;
      if (done % CHECKPOINT_EVERY === 0) {
        const total = await writeMerged(file, existing, added);
        console.log(`…${done}/${slots.length} slots, ${added.length} recorded, ${total} in file.`);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const total = await writeMerged(file, existing, added);
  console.log(
    `Done: ${added.length} slots recorded, ${empty} slots had no RAM market change, ` +
      `${failed.length} failed. ${total} samples in file.`,
  );
  if (failed.length) {
    console.error(`Failed slots (re-run to retry): ${failed.sort((a, b) => a - b).map(iso).join(", ")}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("RAM price backfill failed:", error);
  process.exit(1);
});
