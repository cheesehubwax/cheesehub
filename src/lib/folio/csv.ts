import { downloadCsvFile } from '@/lib/airdropCsv';
import type { FolioEvent, TokenAmount } from './types';

const cell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const list = (xs: TokenAmount[]) => xs.map((a) => `${a.amount} ${a.symbol}@${a.contract}`).join(' + ');

export function downloadActivityCsv(
  account: string, events: FolioEvent[], value: Map<string, number>, realized: Map<string, number>,
  valueUsd: Map<string, number> = new Map(), realizedUsd: Map<string, number> = new Map(),
) {
  const lines = [
    `# CHEESEFolio activity · ${account} · exported ${new Date().toISOString()}`,
    'time_utc,type,venue,sent,received,value_wax,realized_pl_wax,value_usd,realized_pl_usd,counterparty,transaction',
  ];
  for (const e of [...events].sort((a, b) => b.ts - a.ts)) {
    lines.push([
      new Date(e.ts).toISOString(), e.type, e.venue ?? '', cell(list(e.out)), cell(list(e.in)),
      value.get(e.id) ?? '', realized.get(e.id) ?? '', valueUsd.get(e.id) ?? '', realizedUsd.get(e.id) ?? '', e.counterparty ?? '', e.trx,
    ].join(','));
  }
  downloadCsvFile(`cheesefolio-activity-${account}.csv`, lines);
}

export interface HoldingCsvRow {
  symbol: string; contract: string; balance: number; avgCostWax: number | null; priceWax: number;
  valueWax: number; unrealizedWax: number | null; realizedWax: number; complete: boolean;
  avgCostUsd: number | null; valueUsd: number | null; unrealizedUsd: number | null; realizedUsd: number; realisableWax: number | null;
}

export function downloadHoldingsCsv(account: string, rows: HoldingCsvRow[]) {
  const lines = [
    `# CHEESEFolio holdings · ${account} · exported ${new Date().toISOString()} · WAX and USD (USD cost uses the WAX/USD rate on each trade day)`,
    'token,contract,balance,average_cost_wax,price_wax,value_wax,realisable_wax,unrealized_pl_wax,realized_pl_wax,average_cost_usd,value_usd,unrealized_pl_usd,realized_pl_usd,history_complete',
  ];
  for (const r of rows) {
    lines.push([r.symbol, r.contract, r.balance, r.avgCostWax ?? '', r.priceWax, r.valueWax, r.realisableWax ?? '', r.unrealizedWax ?? '', r.realizedWax,
      r.avgCostUsd ?? '', r.valueUsd ?? '', r.unrealizedUsd ?? '', r.realizedUsd, r.complete ? 'yes' : 'no'].join(','));
  }
  downloadCsvFile(`cheesefolio-holdings-${account}.csv`, lines);
}
