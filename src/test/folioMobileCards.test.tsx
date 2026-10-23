// Mobile layout: holdings and activity render as cards with a card/table toggle.
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ActivityList, HoldingsTable } from '@/components/folio/FolioParts';
import type { HoldingRow } from '@/lib/folio/holdings';
import type { FolioEvent } from '@/lib/folio/types';

const row: HoldingRow = {
  key: 'token.cheese:CHEESE', contract: 'token.cheese', symbol: 'CHEESE', precision: 4,
  balance: 100, walletBalance: 100, pooledBalance: 0, pooledParts: [], pooledUnknown: false,
  priceWax: 0.5, valueWax: 50, avgCostWax: 0.4, unrealizedWax: 10, unrealizedPct: 25,
  realizedWax: 5, valueUsd: 2, avgCostUsd: 0.016, unrealizedUsd: 0.4, unrealizedPctUsd: 25,
  realizedUsd: 0.2, usdComplete: true, complete: true, position: null, closed: false, costWax: 40, costUsd: 1.6,
};

const event = {
  id: 'e1', ts: Date.UTC(2024, 0, 2), trx: 'a'.repeat(64), type: 'trade',
  counterparty: 'swap.alcor', venue: 'alcor', memo: '',
  in: [{ key: 'eosio.token:WAX', contract: 'eosio.token', symbol: 'WAX', precision: 8, amount: 10 }],
  out: [{ key: 'token.cheese:CHEESE', contract: 'token.cheese', symbol: 'CHEESE', precision: 4, amount: 100 }],
} as unknown as FolioEvent;

describe('CHEESEFolio mobile layout', () => {
  beforeEach(() => { window.innerWidth = 500; });
  afterEach(() => { window.innerWidth = 1024; });

  it('shows holdings as cards with a toggle, switching to the table on demand', () => {
    render(<HoldingsTable rows={[row]} events={[]} waxUsd={0.04} cur="WAX" onPick={() => undefined} />);
    expect(screen.getByRole('button', { name: /cards/i })).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByText('Balance')).toBeInTheDocument();
    expect(screen.getByText('CHEESE')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /table/i }));
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('shows activity as cards without the wide table', () => {
    render(<ActivityList events={[event]} value={new Map([['e1', 10]])} realized={new Map()} cur="WAX" />);
    expect(screen.getAllByText('Trade').length).toBeGreaterThanOrEqual(2); // filter chip + card label
    expect(screen.getByText('Sent')).toBeInTheDocument();
    expect(screen.getByText('Realised P/L')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('keeps the table on desktop with no card toggle', () => {
    window.innerWidth = 1280;
    render(<HoldingsTable rows={[row]} events={[]} waxUsd={0.04} cur="WAX" onPick={() => undefined} />);
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cards/i })).toBeNull();
  });
});
