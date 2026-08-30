/**
 * CHEESERam price sampler.
 *
 * Reads the live WAX RAM price from eosio::rammarket plus the Alcor
 * CHEESE/WAX and WAXUSDC rates, then appends one record to the history
 * JSON file. Run by .github/workflows/ram-price-history.yml every 4 hours.
 *
 * Env:
 *   RAM_HISTORY_FILE  path to the JSON file to append to (required)
 *   FORCE=1           append even if the last sample is very recent
 */

const ENDPOINTS = [
  "https://wax.greymass.com",
  "https://wax.eosusa.io",
  "https://api.waxsweden.org",
  "https://wax.eosphere.io",
];

const ALCOR_TOKENS_URL = "https://wax.alcor.exchange/api/v2/tokens";

/** Skip the append when the newest record is younger than this. */
const MIN_GAP_MS = 2 * 60 * 60 * 1000;
/** ~2 years of 4-hourly samples. */
const MAX_RECORDS = 4400;
const TIMEOUT_MS = 10_000;

export interface RamHistoryRecord {
  /** Sample time, epoch ms. */
  t: number;
  /** WAX per KB of RAM. */
  waxPerKb: number;
  /** CHEESE per KB of RAM. */
  cheesePerKb: number;
  /** WAX per 1 CHEESE at sample time. */
  waxPerCheese: number;
  /** USD per KB of RAM, derived via the WAXUSDC bridge. */
  usdPerKb: number;
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

const parseAsset = (value: unknown): number =>
  parseFloat(String(value ?? "").split(" ")[0]) || 0;

/** WAX cost of a single byte of RAM, straight from eosio::rammarket. */
async function fetchRamPricePerByte(): Promise<number> {
  let lastError: unknown = null;
  for (const base of ENDPOINTS) {
    try {
      const response = await fetchWithTimeout(`${base}/v1/chain/get_table_rows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          json: true,
          code: "eosio",
          scope: "eosio",
          table: "rammarket",
          limit: 1,
        }),
      });
      if (!response.ok) {
        lastError = new Error(`${base} returned ${response.status}`);
        continue;
      }
      const data = (await response.json()) as {
        rows?: { base: { balance: string }; quote: { balance: string } }[];
      };
      const row = data.rows?.[0];
      if (!row) {
        lastError = new Error(`${base} returned no rammarket row`);
        continue;
      }
      const quote = parseAsset(row.quote?.balance);
      const bytes = parseAsset(row.base?.balance);
      if (!bytes || !quote) {
        lastError = new Error(`${base} returned an invalid rammarket state`);
        continue;
      }
      return quote / bytes;
    } catch (error) {
      lastError = error;
      console.warn(`rammarket via ${base} failed:`, (error as Error).message);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("rammarket unavailable");
}

/**
 * WAX per 1 CHEESE and WAX per 1 WAXUSDC from Alcor. Mirrors the derivation
 * used by src/hooks/useCheesePriceData.ts on the frontend.
 */
async function fetchAlcorRates(): Promise<{ waxPerCheese: number; waxPerUsdc: number }> {
  const response = await fetchWithTimeout(ALCOR_TOKENS_URL);
  if (!response.ok) throw new Error(`Alcor tokens returned ${response.status}`);
  const tokens = (await response.json()) as {
    ticker?: string;
    contract?: string;
    system_price?: number | string;
  }[];
  if (!Array.isArray(tokens)) throw new Error("Alcor tokens returned an unexpected payload");

  const find = (ticker: string, contract: string) =>
    tokens.find((t) => t.ticker === ticker && t.contract === contract);

  const waxPerCheese = Number(find("CHEESE", "cheeseburger")?.system_price ?? 0);
  const waxPerUsdc = Number(find("WAXUSDC", "eth.token")?.system_price ?? 0);
  if (!(waxPerCheese > 0)) throw new Error("Alcor did not return a CHEESE price");
  return { waxPerCheese, waxPerUsdc };
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

const round = (value: number, decimals: number) =>
  Number.isFinite(value) ? Number(value.toFixed(decimals)) : 0;

async function main() {
  const file = process.env.RAM_HISTORY_FILE;
  if (!file) throw new Error("RAM_HISTORY_FILE is required");
  const force = process.env.FORCE === "1";

  const history = await readHistory(file);
  const last = history[history.length - 1];
  const now = Date.now();
  if (!force && last && now - last.t < MIN_GAP_MS) {
    console.log(
      `Last sample is ${Math.round((now - last.t) / 60000)}m old (< ${MIN_GAP_MS / 3600000}h) — skipping.`
    );
    return;
  }

  // Both reads must succeed; a partial sample would poison the series.
  const [waxPerByte, rates] = await Promise.all([fetchRamPricePerByte(), fetchAlcorRates()]);

  const waxPerKb = waxPerByte * 1024;
  const cheesePerKb = waxPerKb / rates.waxPerCheese;
  const usdPerKb = rates.waxPerUsdc > 0 ? waxPerKb / rates.waxPerUsdc : 0;

  const record: RamHistoryRecord = {
    t: now,
    waxPerKb: round(waxPerKb, 8),
    cheesePerKb: round(cheesePerKb, 4),
    waxPerCheese: round(rates.waxPerCheese, 8),
    usdPerKb: round(usdPerKb, 8),
  };

  const next = [...history, record]
    .filter((r) => Number.isFinite(r?.t) && r.waxPerKb > 0)
    .sort((a, b) => a.t - b.t)
    .slice(-MAX_RECORDS);

  await Bun.write(file, `${JSON.stringify(next)}\n`);
  console.log(`Appended sample (${next.length} total):`, record);
}

main().catch((error) => {
  console.error("RAM price sampling failed:", error);
  process.exit(1);
});
