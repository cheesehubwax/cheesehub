// CHEESEFolio number, currency and label formatting.
import type { FolioEventType } from '@/lib/folio/types';
import { CRYPTO_CURRENCIES, type DisplayCode } from '@/lib/folio/fxCore';

/** WAX, or the fiat/crypto currency the figures are shown in. */
export type Currency = 'WAX' | DisplayCode;

const fiatFormatters = new Map<string, Intl.NumberFormat>();
/** Fiat amount; `small` keeps up to 6 decimals for sub-unit prices. */
export function fiatFmt(v: number, code: DisplayCode, small = false): string {
  const crypto = CRYPTO_CURRENCIES.find((c) => c.code === code);
  if (crypto) {
    // Intl has no BTC/ETH currency; use the symbol with fixed decimals.
    return `${v < 0 ? '-' : ''}${crypto.symbol}${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: crypto.decimals, maximumFractionDigits: crypto.decimals })}`;
  }
  const digits = small && Math.abs(v) < 1 && v !== 0 ? 6 : undefined;
  const key = `${code}:${digits ?? ''}`;
  let f = fiatFormatters.get(key);
  if (!f) {
    const base = new Intl.NumberFormat(undefined, { style: 'currency', currency: code });
    const def = base.resolvedOptions().maximumFractionDigits ?? 2;
    f = new Intl.NumberFormat(undefined, {
      style: 'currency', currency: code, currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: digits ? 0 : def, maximumFractionDigits: digits ?? def,
    });
    fiatFormatters.set(key, f);
  }
  return f.format(v);
}

export const fmt = (v: number, max = 4) =>
  v.toLocaleString(undefined, { maximumFractionDigits: Math.abs(v) < 1 && v !== 0 ? Math.max(max, 6) : max });

export const waxFmt = (v: number | null | undefined) => (v == null ? '—' : `${fmt(v, 2)} WAX`);
/** A WAX amount converted at `rate` (fiat per WAX) into `code`. */
export const usdFmt = (wax: number | null | undefined, rate: number, code: DisplayCode = 'USD') =>
  wax == null || !rate ? '' : fiatFmt(wax * rate, code);

/** An amount already in `cur`. */
export const money = (v: number | null | undefined, cur: Currency) =>
  v == null ? '—' : cur !== 'WAX' ? fiatFmt(v, cur) : `${fmt(v, 2)} WAX`;
export const signedMoney = (v: number, cur: Currency) => `${v >= 0 ? '+' : ''}${money(v, cur)}`;

export const plClass = (v: number | null | undefined) => (v == null ? 'text-muted-foreground' : v >= 0 ? 'text-positive' : 'text-destructive');
export const signed = (v: number) => `${v >= 0 ? '+' : ''}${fmt(v, 2)}`;

export const EVENT_LABELS: Record<FolioEventType, string> = {
  trade: 'Trade',
  'order-placed': 'Order placed',
  'order-returned': 'Order returned',
  reward: 'Reward',
  received: 'Received',
  sent: 'Sent',
  nulled: 'Nulled',
  'liquidity-add': 'Added liquidity',
  'liquidity-remove': 'Removed liquidity',
};
export const VENUE_LABELS: Record<string, string> = { alcor: 'Alcor', defibox: 'Defibox', taco: 'Taco', 'alcor-orderbook': 'Alcor order book' };
