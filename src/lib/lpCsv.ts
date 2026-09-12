// CHEESELytics — CSV exports for a pool snapshot and for one account's history.
import { downloadCsvFile } from '@/lib/airdropCsv';
import type { LpDayFile, LpIndexDay } from '@/lib/lpPools';

function cell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Every provider of every tracked pool, for one snapshot. */
export function downloadSnapshotCsv(snapshot: LpDayFile): void {
  const lines = [
    `# CHEESELytics pool snapshot · ${snapshot.date} · taken ${new Date(snapshot.t).toISOString()}`,
    ...(snapshot.cheeseUsd ? [`# CHEESE price used: $${snapshot.cheeseUsd}`] : []),
    'pool,paired_token,account,usd_value,cheese,paired_amount,positions,positions_in_range',
  ];
  for (const pool of snapshot.pools) {
    for (const row of pool.providers) {
      lines.push(
        [
          cell(pool.label),
          cell(pool.symbol),
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
  downloadCsvFile(`cheeselytics-snapshot-${snapshot.date}.csv`, lines);
}

/** Pool-level totals per recorded day. */
export function downloadPoolHistoryCsv(days: LpIndexDay[], poolKey: string, label: string): void {
  const lines = [
    `# CHEESELytics history · ${label}`,
    'date,usd_value,cheese,paired_amount,accounts,positions',
  ];
  for (const day of days) {
    const pool = day.pools.find((p) => p.key === poolKey);
    if (!pool) continue;
    lines.push([day.date, pool.usd, pool.cheese, pool.paired, pool.accounts, pool.positions].join(','));
  }
  downloadCsvFile(`cheeselytics-${poolKey}-history.csv`, lines);
}

export interface AccountHistoryRow {
  date: string;
  pool: string;
  symbol: string;
  usd: number;
  cheese: number;
  paired: number;
  positions: number;
}

/** One account's position across pools and days. */
export function downloadAccountHistoryCsv(account: string, rows: AccountHistoryRow[]): void {
  const lines = [
    `# CHEESELytics account history · ${account}`,
    'date,pool,paired_token,usd_value,cheese,paired_amount,positions',
  ];
  for (const row of rows) {
    lines.push(
      [row.date, cell(row.pool), cell(row.symbol), row.usd, row.cheese, row.paired, row.positions].join(','),
    );
  }
  downloadCsvFile(`cheeselytics-account-${account}.csv`, lines);
}
