import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { GiftListDialog } from '@/components/folio/GiftListDialog';
import { HoldingsTable } from '@/components/folio/HoldingsTable';
import { buildLedger } from '@/lib/folio/ledger';
import type { HoldingRow } from '@/lib/folio/holdings';
import type { FolioEvent } from '@/lib/folio/types';

const token = { key: 'token:TEST', contract: 'token', symbol: 'TEST', precision: 4 };
const events: FolioEvent[] = [
  { id: 'gift', trx: 'abc123def4567890', ts: Date.UTC(2025, 0, 2, 3, 4), seq: 1, type: 'received', out: [], in: [{ ...token, amount: 50 }], counterparty: 'friendacct12', memo: 'happy birthday' },
];

const makeRow = (): HoldingRow => ({
  key: token.key, contract: token.contract, symbol: token.symbol, precision: token.precision,
  balance: 50, walletBalance: 50, pooledBalance: 0, pooledParts: [], pooledUnknown: false,
  priceWax: 1, valueWax: 50, avgCostWax: 0, unrealizedWax: 50, unrealizedPct: null, realizedWax: 0,
  valueUsd: null, avgCostUsd: null, unrealizedUsd: null, unrealizedPctUsd: null, realizedUsd: 0, costWax: 0, costUsd: null,
  usdComplete: true, complete: true, closed: false,
  position: buildLedger(events).positions.get(token.key)!,
});

describe('CHEESEFolio gift list dialog', () => {
  it('shows each gift with date, sender, amount, memo and a waxblock link', () => {
    render(<GiftListDialog row={makeRow()} events={events} onClose={() => {}} />);
    expect(screen.getByText('2025-01-02 03:04')).toBeTruthy();
    expect(screen.getByText('friendacct12')).toBeTruthy();
    expect(screen.getByText('happy birthday')).toBeTruthy();
    expect(screen.getByText(/50\s*TEST/)).toBeTruthy();
    const link = screen.getByText('abc123de').closest('a');
    expect(link?.href).toBe('https://waxblock.io/transaction/abc123def4567890');
  });

  it('opens from the gifted number in the holdings table', () => {
    render(<HoldingsTable rows={[makeRow()]} events={events} waxUsd={0.06} cur="WAX" onPick={() => {}} />);
    fireEvent.click(screen.getByTitle('Show every recorded gift'));
    expect(screen.getByText('friendacct12')).toBeTruthy();
    expect(screen.getByText('happy birthday')).toBeTruthy();
  });
});
