// Acquisition breakdowns and remaining holding cost, derived from the full ledger.
import type { FolioEvent } from '@/lib/folio/types';
import type { HoldingRow } from '@/lib/folio/holdings';

/** Cumulative receipts, not an estimate of the source of today's balance. */
export function acquisitionBreakdown(key: string, events: FolioEvent[], freeQty: number) {
  const purchased = events.reduce((sum, e) => e.type === 'trade'
    ? sum + e.in.reduce((n, a) => n + (a.key === key ? a.amount : 0), 0)
    : sum, 0);
  // Rewards are what reward.alcor sent; every other free receipt is gifted.
  const reward = events.reduce((sum, e) => e.type === 'reward' && e.counterparty === 'reward.alcor'
    ? sum + e.in.reduce((n, a) => n + (a.key === key ? a.amount : 0), 0)
    : sum, 0);
  const gifted = Math.max(0, freeQty - reward);
  const total = purchased + freeQty;
  return {
    purchased, reward, gifted,
    purchasedPct: total > 0 ? purchased / total * 100 : null,
    rewardPct: total > 0 ? reward / total * 100 : null,
    giftedPct: total > 0 ? gifted / total * 100 : null,
  };
}

/** Direct free receipts for one token, newest first: transfers in, excluding reward.alcor rewards (their own column). */
export function giftReceipts(key: string, events: FolioEvent[]) {
  return events
    .filter((e) => (e.type === 'received' || e.type === 'reward') && e.counterparty !== 'reward.alcor')
    .map((e) => ({ e, amount: e.in.reduce((s, a) => s + (a.key === key ? a.amount : 0), 0) }))
    .filter((x) => x.amount > 0)
    .sort((a, b) => b.e.ts - a.e.ts);
}

/** Per-asset Total Cost: what was paid for the tokens still held; closed rows show nothing. */
export function holdingCost(row: HoldingRow, usd: boolean): number | null {
  if (row.closed || row.balance <= 0) return null;
  return usd ? row.costUsd : row.costWax;
}

export function totalHoldingCost(rows: HoldingRow[]) {
  let wax = 0, usd = 0, knownWax = 0, knownUsd = 0, missingWax = false, missingUsd = false;
  for (const row of rows) {
    if (row.closed || row.balance <= 0) continue;
    const costWax = holdingCost(row, false);
    const costUsd = holdingCost(row, true);
    if (costWax == null) missingWax = true;
    else { wax += costWax; knownWax++; }
    if (costUsd == null) missingUsd = true;
    else { usd += costUsd; knownUsd++; }
  }
  return {
    wax: missingWax && !knownWax ? null : wax,
    usd: missingUsd && !knownUsd ? null : usd,
    partialWax: missingWax,
    partialUsd: missingUsd,
  };
}
