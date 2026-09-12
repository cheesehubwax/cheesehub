// CHEESEAir — CSV builders for the snapshot export and the post-run results export.
import { formatUnits, type AirdropRecipient, type NftAssignment, type RamPurchase } from '@/lib/airdrop';
import { formatCheese } from '@/lib/airdropResources';
import { CHEESE_PRECISION, CHEESE_SYMBOL } from '@/lib/airdropCheese';

/** One delivered item inside a batch, as recorded in the run log. */
export interface CsvBatchItem {
  account: string;
  units?: bigint;
  assetIds?: string[];
}

export interface CsvBatchEntry {
  batch: number;
  txId?: string;
  error?: string;
  items?: CsvBatchItem[];
}

function cell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function stamp(iso: string | null): string {
  return iso ? iso.slice(0, 19).replace(/[:T]/g, '-') : new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
}

export function downloadCsvFile(name: string, lines: string[]): void {
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export interface SnapshotCsvInput {
  /** Human description of what was snapshotted, e.g. "token CHEESE@cheeseburger". */
  what: string;
  source: string;
  truncated: boolean;
  at: string | null;
  /** Holders already ranked highest weight first. */
  holders: Array<{ account: string; weight: number }>;
  selected: Set<string>;
}

/** The holder list exactly as loaded — proof of the snapshot. */
export function buildSnapshotCsv(input: SnapshotCsvInput): { name: string; lines: string[] } {
  const lines = [
    `# CHEESEAir snapshot of ${input.what}`,
    `# source: ${input.source}${input.truncated ? ' (truncated)' : ''} · taken ${input.at ?? 'unknown'}`,
    'rank,account,weight,selected',
  ];
  input.holders.forEach((h, i) => {
    lines.push(`${i + 1},${cell(h.account)},${h.weight},${input.selected.has(h.account) ? 'yes' : 'no'}`);
  });
  return { name: `snapshot-${stamp(input.at)}.csv`, lines };
}

type PlannedItem = { account: string; units?: bigint; assetIds?: string[] };

interface LoggedItem extends CsvBatchItem {
  batch: number;
  txId?: string;
  error?: string;
}

type RowStatus = 'confirmed' | 'failed' | 'skipped' | 'not_sent';

interface Outcome {
  item: PlannedItem;
  status: RowStatus;
  batch?: number;
  txId?: string;
  error?: string;
}

/**
 * Join the planned deliveries to the run log. Every planned item appears once:
 * confirmed/failed when its batch was attempted, not_sent when the run stopped
 * before reaching it. Skipped accounts are appended by the caller.
 */
function outcomes(planned: PlannedItem[], log: CsvBatchEntry[]): Outcome[] {
  const logged: LoggedItem[] = [];
  for (const entry of log) {
    for (const item of entry.items ?? []) {
      logged.push({ ...item, batch: entry.batch, txId: entry.txId, error: entry.error });
    }
  }
  const keyOf = (i: PlannedItem) =>
    i.assetIds ? `${i.account}|${i.assetIds.join(' ')}` : `${i.account}|${i.units?.toString() ?? ''}`;
  const queues = new Map<string, LoggedItem[]>();
  for (const l of logged) {
    const k = keyOf(l);
    const q = queues.get(k);
    if (q) q.push(l);
    else queues.set(k, [l]);
  }
  return planned.map((item) => {
    const hit = queues.get(keyOf(item))?.shift();
    if (!hit) return { item, status: 'not_sent' as const, error: 'Run cancelled or stopped before this batch' };
    if (hit.txId) return { item, status: 'confirmed' as const, batch: hit.batch, txId: hit.txId };
    return { item, status: 'failed' as const, batch: hit.batch, error: hit.error ?? 'Transaction failed' };
  });
}

function statusFields(o: Outcome): string {
  return `${o.status},${o.batch ?? ''},${o.txId ?? ''},${cell(o.error ?? '')}`;
}

export interface TokenResultsInput {
  kind: 'token';
  symbol: string;
  precision: number;
  memo: string;
  planned: AirdropRecipient[];
  log: CsvBatchEntry[];
  at: string | null;
}

export interface RamResultsInput {
  kind: 'ram';
  planned: RamPurchase[];
  /** Selected accounts whose share was below the contract minimum. */
  belowMin: AirdropRecipient[];
  minCheese: number | null;
  bytesPerCheese: number;
  log: CsvBatchEntry[];
  at: string | null;
}

export interface NftResultsInput {
  kind: 'nft';
  collection: string;
  templateId: number | null;
  memo: string;
  planned: NftAssignment[];
  /** Selected accounts whose share rounded down to zero NFTs. */
  skippedAccounts: string[];
  log: CsvBatchEntry[];
  at: string | null;
}

export type ResultsInput = TokenResultsInput | RamResultsInput | NftResultsInput;

/** Who actually got what — one row per delivery, joined to its transaction. */
export function buildResultsCsv(input: ResultsInput): { name: string; lines: string[] } {
  if (input.kind === 'token') {
    const lines = ['account,amount,token,memo,status,batch,tx_id,error'];
    for (const o of outcomes(input.planned, input.log)) {
      lines.push(
        `${cell(o.item.account)},${formatUnits(o.item.units ?? 0n, input.precision)},${input.symbol.toUpperCase()},${cell(input.memo)},${statusFields(o)}`,
      );
    }
    return { name: `airdrop-results-token-${input.symbol.toLowerCase()}-${stamp(input.at)}.csv`, lines };
  }
  if (input.kind === 'ram') {
    const lines = ['account,cheese,est_kb,status,batch,tx_id,error'];
    for (const o of outcomes(input.planned, input.log)) {
      const cheese = Number(o.item.units ?? 0n) / 10 ** CHEESE_PRECISION;
      lines.push(
        `${cell(o.item.account)},${formatCheese(cheese)},${((cheese * input.bytesPerCheese) / 1024).toFixed(2)},${statusFields(o)}`,
      );
    }
    for (const r of input.belowMin) {
      const cheese = Number(r.units) / 10 ** CHEESE_PRECISION;
      const reason = input.minCheese !== null
        ? `Share below the ${formatCheese(input.minCheese)} ${CHEESE_SYMBOL} minimum per purchase`
        : `Share below the ${CHEESE_SYMBOL} minimum per purchase`;
      lines.push(`${cell(r.account)},${formatCheese(cheese)},0.00,skipped,,,${cell(reason)}`);
    }
    return { name: `airdrop-results-ram-${stamp(input.at)}.csv`, lines };
  }
  const lines = ['account,nfts,asset_ids,collection,template_id,memo,status,batch,tx_id,error'];
  for (const o of outcomes(input.planned, input.log)) {
    const ids = o.item.assetIds ?? [];
    lines.push(
      `${cell(o.item.account)},${ids.length},${cell(ids.join(' '))},${cell(input.collection)},${input.templateId ?? ''},${cell(input.memo)},${statusFields(o)}`,
    );
  }
  for (const account of input.skippedAccounts) {
    lines.push(
      `${cell(account)},0,,${cell(input.collection)},${input.templateId ?? ''},${cell(input.memo)},skipped,,,${cell('Share rounded down to zero NFTs')}`,
    );
  }
  return { name: `airdrop-results-nft-${input.collection || 'assets'}-${stamp(input.at)}.csv`, lines };
}
