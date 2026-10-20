/**
 * Daily fiat exchange rates (units per 1 USD) for CHEESEFolio.
 *
 * Sources: European Central Bank reference rates via Frankfurter (29 currencies)
 * and the Central Bank of Russia for RUB (the ECB stopped RUB in March 2022).
 * Days without a published rate carry the previous rate forward for up to 7 days.
 *
 * BTC/ETH: Binance daily closes (Bitfinex fallback), stored inverted as coins per 1 USD.
 *
 * Writes data/fx-usd-history.json:
 *   { "updatedAt": ISO, "currencies": { "AUD": { "YYYY-MM-DD": perUsd }, ... } }
 *
 * Env: TOKEN_PRICE_DIR (data directory)
 *      FULL=1 rebuilds from FROM (default 2019-12-01); otherwise only the last
 *      21 days are fetched and merged. Existing days are never replaced with blanks.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { carryForward, CRYPTO_CURRENCIES, ECB_CODES, invertUsd, parseBinanceKlines, parseBitfinexCandles, parseCbrDynamic } from "../../src/lib/folio/fxCore";

const DAY = 86_400_000;
const dayOf = (ts: number) => new Date(ts).toISOString().slice(0, 10);
const sig = (v: number) => Number(v.toPrecision(6));

async function getText(url: string): Promise<string> {
  let last: unknown;
  for (let i = 0; i < 4; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000), redirect: "follow" });
      if (!res.ok) throw new Error(`${res.status} from ${url}`);
      return await res.text();
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 3000 * (i + 1)));
    }
  }
  throw last instanceof Error ? last : new Error(`Failed: ${url}`);
}

/** ECB rates per USD, one request per calendar year. */
async function ecb(from: string, to: string): Promise<Record<string, Record<string, number>>> {
  const out: Record<string, Record<string, number>> = Object.fromEntries(ECB_CODES.map((c) => [c, {}]));
  let start = from;
  while (start <= to) {
    const yearEnd = `${start.slice(0, 4)}-12-31`;
    const end = yearEnd < to ? yearEnd : to;
    const data = JSON.parse(await getText(
      `https://api.frankfurter.dev/v1/${start}..${end}?base=USD&symbols=${ECB_CODES.join(",")}`,
    )) as { rates?: Record<string, Record<string, number>> };
    for (const [d, row] of Object.entries(data.rates ?? {})) {
      for (const c of ECB_CODES) if (row[c] > 0) out[c][d] = row[c];
    }
    start = `${Number(start.slice(0, 4)) + 1}-01-01`;
    await new Promise((r) => setTimeout(r, 500));
  }
  return out;
}

/** CBR official USD rate (RUB per USD), one request per calendar year. */
async function cbr(from: string, to: string): Promise<Record<string, number>> {
  const fmt = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
  const out: Record<string, number> = {};
  let start = from;
  while (start <= to) {
    const yearEnd = `${start.slice(0, 4)}-12-31`;
    const end = yearEnd < to ? yearEnd : to;
    const xml = await getText(
      `https://www.cbr.ru/scripts/XML_dynamic.asp?date_req1=${fmt(start)}&date_req2=${fmt(end)}&VAL_NM_RQ=R01235`,
    );
    Object.assign(out, parseCbrDynamic(xml));
    start = `${Number(start.slice(0, 4)) + 1}-01-01`;
    await new Promise((r) => setTimeout(r, 500));
  }
  return out;
}

/** Daily USD closes for a coin: Binance <COIN>USDT in 1,000-day pages, Bitfinex t<COIN>USD as fallback. */
async function cryptoUsd(coin: string, from: string, to: string): Promise<Record<string, number>> {
  const endTs = Date.parse(`${to}T23:59:59Z`);
  for (const host of ["https://data-api.binance.vision", "https://api.binance.com"]) {
    try {
      const out: Record<string, number> = {};
      let start = Date.parse(`${from}T00:00:00Z`);
      while (start <= endTs) {
        const rows = JSON.parse(await getText(`${host}/api/v3/klines?symbol=${coin}USDT&interval=1d&startTime=${start}&limit=1000`)) as [number][];
        if (!Array.isArray(rows) || !rows.length) break;
        Object.assign(out, parseBinanceKlines(rows));
        start = rows[rows.length - 1][0] + DAY;
        if (rows.length < 1000) break;
        await new Promise((r) => setTimeout(r, 300));
      }
      if (Object.keys(out).length) return out;
    } catch (e) {
      console.warn(`${coin}: ${host} failed (${e instanceof Error ? e.message : e}); trying next source.`);
    }
  }
  const out: Record<string, number> = {};
  let start = Date.parse(`${from}T00:00:00Z`);
  while (start <= endTs) {
    const rows = JSON.parse(await getText(
      `https://api-pub.bitfinex.com/v2/candles/trade:1D:t${coin}USD/hist?start=${start}&end=${endTs}&limit=10000&sort=1`,
    )) as [number][];
    if (!Array.isArray(rows) || !rows.length) break;
    Object.assign(out, parseBitfinexCandles(rows));
    start = rows[rows.length - 1][0] + DAY;
    if (rows.length < 10000) break;
  }
  return out;
}

async function main() {
  const dir = process.env.TOKEN_PRICE_DIR;
  if (!dir) throw new Error("TOKEN_PRICE_DIR is required");
  const full = process.env.FULL === "1";
  const file = join(dir, "fx-usd-history.json");
  const prior = existsSync(file)
    ? (JSON.parse(readFileSync(file, "utf8")) as { currencies?: Record<string, Record<string, number>> }).currencies ?? {}
    : {};
  const today = dayOf(Date.now());
  const incremental = !full && Object.keys(prior).length > 0;
  // Start a little before the window so carry-forward has a published day to start from.
  const from = incremental ? dayOf(Date.now() - 21 * DAY) : process.env.FROM || "2019-12-01";
  const fetchFrom = dayOf(Date.parse(`${from}T00:00:00Z`) - 10 * DAY);

  const [ecbRates, rub] = await Promise.all([ecb(fetchFrom, today), cbr(fetchFrom, today)]);
  const fresh: Record<string, Record<string, number>> = { ...ecbRates, RUB: rub };
  // Coins are stored like fiat (units per 1 USD). A coin missing from the file gets its full history even on nightly runs.
  const fullFrom = dayOf(Date.parse(`${process.env.FROM || "2019-12-01"}T00:00:00Z`) - 10 * DAY);
  for (const { code } of CRYPTO_CURRENCIES) {
    const has = prior[code] && Object.keys(prior[code]).length > 0;
    fresh[code] = invertUsd(await cryptoUsd(code, incremental && has ? fetchFrom : fullFrom, today));
  }

  for (const [c, s] of Object.entries(fresh)) {
    const coinBackfill = CRYPTO_CURRENCIES.some((x) => x.code === c) && !(prior[c] && Object.keys(prior[c]).length);
    const minDays = incremental && !coinBackfill ? 1 : 1500;
    if (Object.keys(s).length < minDays) {
      if (!incremental || coinBackfill) throw new Error(`${c}: only ${Object.keys(s).length} published days — refusing to write`);
      console.warn(`${c}: no new published days; keeping existing history.`);
    }
  }

  const currencies: Record<string, Record<string, number>> = {};
  for (const c of [...ECB_CODES, "RUB", ...CRYPTO_CURRENCIES.map((x) => x.code)]) {
    // Carry only from genuinely published days (prior entries may themselves be carried).
    const filled = carryForward(fresh[c], today);
    const merged: Record<string, number> = { ...(prior[c] ?? {}) };
    for (const [d, v] of Object.entries(filled)) merged[d] = sig(v);
    currencies[c] = Object.fromEntries(Object.entries(merged).sort(([a], [b]) => a.localeCompare(b)));
  }

  writeFileSync(file, JSON.stringify({ updatedAt: new Date().toISOString(), currencies }));
  const aud = Object.keys(currencies.AUD);
  console.log(`FX history: ${Object.keys(currencies).length} currencies, ${aud.length} days (${aud[0]} → ${aud[aud.length - 1]}).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
