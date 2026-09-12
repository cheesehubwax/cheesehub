// CHEESEAnal — CSV exports for a pool snapshot and for one account's history.
import { downloadCsvFile } from '@/lib/airdropCsv';
import { LP_VENUE_LABELS, type LpDayFile, type LpIndexDay, type LpVenue } from '@/lib/lpPools';

function cell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function venueLabel(venue: LpVenue | undefined): string {
  return venue ? (LP_VENUE_LABELS[venue] ?? venue) : '';
}

/** Every provider of every tracked pool, for one snapshot. */
export function downloadSnapshotCsv(snapshot: LpDayFile): void {
  const lines = [
    `# CHEESEAnal pool snapshot · ${snapshot.date} · taken ${new Date(snapshot.t).toISOString()}`,
    ...(snapshot.cheeseUsd ? [`# CHEESE price used: $${snapshot.cheeseUsd}`] : []),
    ...(snapshot.partial?.length ? [`# Venues missing from this snapshot: ${snapshot.partial.join(', ')}`] : []),
    'venue,pool,paired_token,cheese_price_usd,cheese_price_in_paired,account,usd_value,cheese,paired_amount,positions,positions_in_range',
  ];
  for (const pool of snapshot.pools) {
    for (const row of pool.providers) {
      lines.push(
        [
          cell(venueLabel(pool.venue)),
          cell(pool.label),
          cell(pool.symbol),
          pool.priceUsd ?? '',
          pool.priceInPaired ?? '',
          cell(row.a),
          row.usd,
          row.cheese,
          row.paired,
          row.pos,
          row.inRange,
        ].join(','),
      );
    }
  }
  downloadCsvFile(`cheeseanal-snapshot-${snapshot.date}.csv`, lines);
}

/** Pool-level totals per recorded day. */
export function downloadPoolHistoryCsv(days: LpIndexDay[], poolKey: string, label: string): void {
  const lines = [
    `# CHEESEAnal history · ${label}`,
    'date,venue,usd_value,cheese,paired_amount,accounts,positions,cheese_price_usd,cheese_price_in_paired',
  ];
  for (const day of days) {
    const pool = day.pools.find((p) => p.key === poolKey);
    if (!pool) continue;
    lines.push(
      [
        day.date,
        cell(venueLabel(pool.venue)),
        pool.usd,
        pool.cheese,
        pool.paired,
        pool.accounts,
        pool.positions,
        pool.priceUsd ?? '',
        pool.priceInPaired ?? '',
      ].join(','),
    );
  }
  downloadCsvFile(`cheeseanal-${poolKey.replace(/[:/]/g, '-')}-history.csv`, lines);
}

export interface AccountHistoryRow {
  date: string;
  venue?: LpVenue;
  pool: string;
  symbol: string;
  usd: number;
  cheese: number;
  paired: number;
  positions: number;
}

/** One account's position across pools and days. */
export function downloadAccountHistoryCsv(account: string, rows: AccountHistoryRow[], poolKey?: string): void {
  const lines = [
    `# CHEESEAnal account history · ${account}${poolKey ? ` · ${poolKey}` : ''}`,
    'date,venue,pool,paired_token,usd_value,cheese,paired_amount,positions',
  ];
  for (const row of rows) {
    lines.push(
      [
        row.date,
        cell(venueLabel(row.venue)),
        cell(row.pool),
        cell(row.symbol),
        row.usd,
        row.cheese,
        row.paired,
        row.positions,
      ].join(','),
    );
  }
  const suffix = poolKey ? `-${poolKey.replace(/[:/]/g, '-')}` : '';
  downloadCsvFile(`cheeseanal-account-${account}${suffix}.csv`, lines);
}
