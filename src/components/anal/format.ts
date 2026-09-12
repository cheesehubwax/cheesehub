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

export function amount(value: number, decimals = 4): string {
  if (!Number.isFinite(value)) return '0';
  if (value !== 0 && Math.abs(value) < 0.0001) return value.toExponential(2);
  return value.toLocaleString('en-US', { maximumFractionDigits: decimals });
}

export function shortDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** Percentage change, formatted with a sign, or null when there is no basis. */
export function change(current: number, previous: number): { text: string; up: boolean } | null {
  if (!(previous > 0) || !Number.isFinite(current)) return null;
  const pct = ((current - previous) / previous) * 100;
  if (!Number.isFinite(pct)) return null;
  return { text: `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`, up: pct >= 0 };
}
