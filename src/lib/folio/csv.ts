import { downloadCsvFile } from '@/lib/airdropCsv';
import type { FolioEvent, TokenAmount } from './types';

const cell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const list = (xs: TokenAmount[]) => xs.map((a) => `${a.amount} ${a.symbol}@${a.contract}`).join(' + ');

export function downloadActivityCsv(
  account: string, events: FolioEvent[], value: Map<string, number>, realized: Map<string, number>,
  valueUsd: Map<string, number> = new Map(), realizedUsd: Map<string, number> = new Map(), fiat = 'USD',
) {
  const f = fiat.toLowerCase();
  const lines = [
    `# CHEESEFolio activity · ${account} · exported ${new Date().toISOString()} · ${fiat} uses each event day's rates`,
    `time_utc,type,venue,sent,received,value_wax,realized_pl_wax,value_${f},realized_pl_${f},counterparty,transaction`,
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
  symbol: string; contract: string; balance: number; walletBalance: number; pooledBalance: number; avgCostWax: number | null; priceWax: number | null;
  valueWax: number | null; unrealizedWax: number | null; realizedWax: number; complete: boolean;
  avgCostUsd: number | null; valueUsd: number | null; unrealizedUsd: number | null; realizedUsd: number; realisableWax: number | null;
}

export function downloadHoldingsCsv(account: string, fiat: string, rows: HoldingCsvRow[]) {
  const f = fiat.toLowerCase();
  const lines = [
    `# CHEESEFolio holdings · ${account} · exported ${new Date().toISOString()} · WAX and ${fiat} (${fiat} cost uses the WAX/USD and USD/${fiat} rates on each trade day)`,
    `token,contract,balance,wallet,in_pools,average_cost_wax,price_wax,value_wax,realisable_wax,unrealized_pl_wax,realized_pl_wax,average_cost_${f},value_${f},unrealized_pl_${f},realized_pl_${f},history_complete`,
  ];
  for (const r of rows) {
    lines.push([r.symbol, r.contract, r.balance, r.walletBalance, r.pooledBalance, r.avgCostWax ?? '', r.priceWax ?? '', r.valueWax ?? '', r.realisableWax ?? '', r.unrealizedWax ?? '', r.realizedWax,
      r.avgCostUsd ?? '', r.valueUsd ?? '', r.unrealizedUsd ?? '', r.realizedUsd, r.complete ? 'yes' : 'no'].join(','));
  }
  downloadCsvFile(`cheesefolio-holdings-${account}.csv`, lines);
}
