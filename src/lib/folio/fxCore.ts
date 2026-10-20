// Pure FX helpers shared by the recorder script and the app.
// Rates are "units of currency per 1 USD", keyed by UTC day.

/** Currencies offered, in dropdown order. RUB comes from the Central Bank of Russia; the rest from the ECB. */
export const FIAT_CURRENCIES = [
  { code: 'USD', name: 'US dollar' },
  { code: 'AUD', name: 'Australian dollar' },
  { code: 'CAD', name: 'Canadian dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British pound' },
  { code: 'JPY', name: 'Japanese yen' },
  { code: 'CNY', name: 'Chinese yuan' },
  { code: 'INR', name: 'Indian rupee' },
  { code: 'RUB', name: 'Russian ruble' },
  { code: 'NZD', name: 'New Zealand dollar' },
  { code: 'CHF', name: 'Swiss franc' },
  { code: 'SEK', name: 'Swedish krona' },
  { code: 'NOK', name: 'Norwegian krone' },
  { code: 'DKK', name: 'Danish krone' },
  { code: 'PLN', name: 'Polish złoty' },
  { code: 'CZK', name: 'Czech koruna' },
  { code: 'HUF', name: 'Hungarian forint' },
  { code: 'RON', name: 'Romanian leu' },
  { code: 'TRY', name: 'Turkish lira' },
  { code: 'KRW', name: 'South Korean won' },
  { code: 'SGD', name: 'Singapore dollar' },
  { code: 'HKD', name: 'Hong Kong dollar' },
  { code: 'IDR', name: 'Indonesian rupiah' },
  { code: 'MYR', name: 'Malaysian ringgit' },
  { code: 'PHP', name: 'Philippine peso' },
  { code: 'THB', name: 'Thai baht' },
  { code: 'ZAR', name: 'South African rand' },
  { code: 'BRL', name: 'Brazilian real' },
  { code: 'MXN', name: 'Mexican peso' },
  { code: 'ILS', name: 'Israeli shekel' },
  { code: 'ISK', name: 'Icelandic króna' },
] as const;

export type FiatCode = (typeof FIAT_CURRENCIES)[number]['code'];
export const ECB_CODES = FIAT_CURRENCIES.map((c) => c.code).filter((c) => c !== 'USD' && c !== 'RUB');
export const isFiat = (c: string): c is FiatCode => FIAT_CURRENCIES.some((f) => f.code === c);

/** Crypto display currencies; BTC/ETH are stored like fiat, as units per 1 USD. */
export const CRYPTO_CURRENCIES = [
  { code: 'BTC', name: 'Bitcoin', symbol: '₿', decimals: 8 },
  { code: 'ETH', name: 'Ether', symbol: 'Ξ', decimals: 6 },
] as const;
export type CryptoCode = (typeof CRYPTO_CURRENCIES)[number]['code'];
/** Any non-WAX currency figures can be shown in. */
export type DisplayCode = FiatCode | CryptoCode;
export const isCrypto = (c: string): c is CryptoCode => CRYPTO_CURRENCIES.some((f) => f.code === c);
export const isDisplay = (c: string): c is DisplayCode => isFiat(c) || isCrypto(c);

/** Binance 1d klines → close (USD per coin) by UTC day. */
export function parseBinanceKlines(rows: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!Array.isArray(rows)) return out;
  for (const r of rows) {
    if (!Array.isArray(r)) continue;
    const close = parseFloat(String(r[4]));
    if (typeof r[0] === 'number' && close > 0) out[new Date(r[0]).toISOString().slice(0, 10)] = close;
  }
  return out;
}

/** Bitfinex 1D candles [MTS, OPEN, CLOSE, HIGH, LOW, VOL] → close by UTC day. */
export function parseBitfinexCandles(rows: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!Array.isArray(rows)) return out;
  for (const r of rows) {
    if (Array.isArray(r) && typeof r[0] === 'number' && r[2] > 0) out[new Date(r[0]).toISOString().slice(0, 10)] = r[2];
  }
  return out;
}

/** USD per coin → coins per 1 USD. */
export function invertUsd(series: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [d, v] of Object.entries(series)) if (v > 0) out[d] = 1 / v;
  return out;
}

export const FX_CARRY_DAYS = 7;
const DAY = 86_400_000;
const dayOf = (ts: number) => new Date(ts).toISOString().slice(0, 10);

/**
 * Fills days without a published rate (weekends, holidays) with the last
 * published rate for up to FX_CARRY_DAYS days, from the first published day
 * through `toDate`. Longer gaps stay empty.
 */
export function carryForward(raw: Record<string, number>, toDate: string): Record<string, number> {
  const dates = Object.keys(raw).filter((d) => raw[d] > 0).sort();
  const out: Record<string, number> = {};
  if (!dates.length) return out;
  let last = 0, lastTs = 0;
  for (let t = Date.parse(`${dates[0]}T00:00:00Z`); t <= Date.parse(`${toDate}T00:00:00Z`); t += DAY) {
    const d = dayOf(t);
    const px = raw[d];
    if (px > 0) { out[d] = px; last = px; lastTs = t; }
    else if (last > 0 && (t - lastTs) / DAY <= FX_CARRY_DAYS) out[d] = last;
  }
  return out;
}

/** Parses Central Bank of Russia XML_dynamic output into RUB per 1 USD by ISO day. */
export function parseCbrDynamic(xml: string): Record<string, number> {
  const out: Record<string, number> = {};
  const re = /<Record Date="(\d{2})\.(\d{2})\.(\d{4})"[^>]*>\s*<Nominal>([\d,.]+)<\/Nominal>\s*<Value>([\d,.]+)<\/Value>/g;
  for (const m of xml.matchAll(re)) {
    const nominal = parseFloat(m[4].replace(',', '.'));
    const value = parseFloat(m[5].replace(',', '.'));
    if (nominal > 0 && value > 0) out[`${m[3]}-${m[2]}-${m[1]}`] = value / nominal;
  }
  return out;
}

/** Rate on the day of `ts`, or the nearest earlier day within FX_CARRY_DAYS; USD is always exactly 1. */
export function fxLookup(code: DisplayCode, series: Record<string, number> | undefined): (ts: number) => number | null {
  if (code === 'USD') return () => 1;
  const dates = Object.keys(series ?? {}).sort();
  return (ts) => {
    const want = dayOf(ts);
    let lo = 0, hi = dates.length - 1, best = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (dates[mid] <= want) { best = mid; lo = mid + 1; } else hi = mid - 1;
    }
    if (best < 0) return null;
    if ((Date.parse(want) - Date.parse(dates[best])) / DAY > FX_CARRY_DAYS) return null;
    const v = series![dates[best]];
    return v > 0 ? v : null;
  };
}

/** WAX → fiat at a time: WAX/USD that day × fiat/USD that day; unknown when either is. */
export function combineWaxFiat(
  waxUsdAt: (ts: number) => number | null,
  fxAt: (ts: number) => number | null,
): (ts: number) => number | null {
  return (ts) => {
    const w = waxUsdAt(ts);
    if (w == null) return null;
    const f = fxAt(ts);
    return f == null ? null : w * f;
  };
}
