// CHEESEAnal — small shared formatters.

export function usd(value: number): string {
  if (!Number.isFinite(value)) return '$0.00';
  if (Math.abs(value) >= 1000) {
    return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  }
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Token price in USD — keeps precision on sub-cent values like CHEESE. */
export function usdPrice(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '$0';
  if (Math.abs(value) >= 1) return usd(value);
  return `$${value.toLocaleString('en-US', { maximumSignificantDigits: 4, minimumSignificantDigits: 2 })}`;
}

/**
 * CHEESE price expressed in the paired token. Very small prices (WAXWBTC,
 * WAXWETH) stay readable decimals rather than exponent notation.
 */
export function tokenPrice(value: number, symbol?: string): string {
  if (!Number.isFinite(value) || value <= 0) return '—';
  const decimals = value >= 1 ? 6 : Math.min(18, Math.max(6, 4 - Math.floor(Math.log10(value))));
  const text = value
    .toFixed(decimals)
    .replace(/(\.\d*?[1-9])0+$/, '$1')
    .replace(/\.0+$/, '');
  return symbol ? `${text} ${symbol}` : text;
}

export function amount(value: number, decimals = 4): string {
  if (!Number.isFinite(value)) return '0';
  if (value !== 0 && Math.abs(value) < 0.0001) return value.toExponential(2);
  return value.toLocaleString('en-US', { maximumFractionDigits: decimals });
}

/** Axis-friendly date. Handles both `YYYY-MM-DD` and 12h slot `YYYY-MM-DDTHH` keys. */
export function shortDate(date: string): string {
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** Tooltip date — adds the slot time when the key is a 12h slot, e.g. "12 Sep · 12:00 UTC". */
export function tooltipDate(date: string): string {
  const slot = date.length > 10 ? date.slice(11) : '';
  const base = shortDate(date);
  return slot ? `${base} · ${slot}:00 UTC` : base;
}

/** Percentage change, formatted with a sign, or null when there is no basis. */
export function change(current: number, previous: number): { text: string; up: boolean } | null {
  if (!(previous > 0) || !Number.isFinite(current)) return null;
  const pct = ((current - previous) / previous) * 100;
  if (!Number.isFinite(pct)) return null;
  return { text: `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`, up: pct >= 0 };
}
