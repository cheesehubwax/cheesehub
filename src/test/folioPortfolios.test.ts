import { describe, expect, it } from 'vitest';
import { buildLedger } from '@/lib/folio/ledger';
import { mergePortfolios, scopePortfolio, validPortfolios } from '@/lib/folio/portfolios';
import type { FolioEvent, TokenAmount } from '@/lib/folio/types';

const token = (key: string, amount: number): TokenAmount => {
  const [contract, symbol] = key.split(':');
  return { key, contract, symbol, amount, precision: 4 };
};
const wax = (amount: number) => token('eosio.token:WAX', amount);
const cheese = (amount: number) => token('cheeseburger:CHEESE', amount);
const other = (amount: number) => token('token:DEFI', amount);
const event = (seq: number, type: FolioEvent['type'], out: TokenAmount[], inn: TokenAmount[]): FolioEvent => ({ id: String(seq), trx: String(seq), seq, ts: seq * 86400000, type, out, in: inn });

describe('custom portfolio accounting', () => {
  const events = [event(1, 'received', [], [wax(100)]), event(2, 'trade', [wax(50)], [cheese(10)]), event(3, 'trade', [cheese(5)], [wax(40)]), event(4, 'trade', [wax(10)], [other(2)])];
  it('filters holdings and activity but preserves full trade legs and original token cost', () => {
    const full = buildLedger(events, undefined, () => 2);
    const scoped = scopePortfolio(full, events, new Set(['cheeseburger:CHEESE']));
    expect([...scoped.ledger.positions.keys()]).toEqual(['cheeseburger:CHEESE']);
    expect(scoped.ledger.positions.get('cheeseburger:CHEESE')?.costWax).toBe(25);
    expect(scoped.ledger.positions.get('cheeseburger:CHEESE')).toBe(full.positions.get('cheeseburger:CHEESE'));
    expect(scoped.events.map((e) => e.id)).toEqual(['2', '3']);
    expect(scoped.events[0].out[0].amount).toBe(50);
  });
  it('attributes realised chart/activity P/L to selected disposal tokens, not incoming tokens or WAX spending', () => {
    const full = buildLedger(events, undefined, () => 2);
    const scoped = scopePortfolio(full, events, new Set(['cheeseburger:CHEESE']));
    expect(scoped.ledger.realizedByEvent.get('3')).toBe(15);
    expect(scoped.ledger.realizedUsdByEvent.get('3')).toBe(30);
    expect(scoped.ledger.realizedUsdByEvent.has('2')).toBe(false);
    expect(scopePortfolio(full, events, new Set(['eosio.token:WAX'])).ledger.realizedByEvent.get('3')).toBeUndefined();
    expect(scopePortfolio(full, events, null).ledger).toBe(full);
  });
  it('an empty portfolio stays empty rather than showing All Holdings', () => {
    const scoped = scopePortfolio(buildLedger(events), events, new Set());
    expect(scoped.events).toEqual([]);
    expect(scoped.ledger.positions.size).toBe(0);
  });
  it('includes order-book fills referencing a selected outgoing token', () => {
    const fill = { ...event(5, 'trade', [], [other(2)]), fillGave: cheese(1) };
    expect(scopePortfolio(buildLedger(events), [fill], new Set(['cheeseburger:CHEESE'])).events).toEqual([fill]);
  });
});

describe('portfolio definition merge', () => {
  const p = { id: 'one', name: 'Meme coins', tokenKeys: ['cheeseburger:CHEESE'], createdAt: 1, updatedAt: 5 };
  it('deduplicates IDs, keeps newer edits and does not merge independent IDs with the same name', () => {
    expect(mergePortfolios([p], [{ ...p, name: 'Older', updatedAt: 2 }, { ...p, id: 'two' }])).toEqual([p, { ...p, id: 'two' }]);
    expect(mergePortfolios([p], [{ ...p, name: 'Renamed', updatedAt: 6 }])[0].name).toBe('Renamed');
  });
  it('validates IDs, names and canonical contract:symbol keys', () => {
    expect(validPortfolios([p])).toBe(true);
    expect(validPortfolios([p, p])).toBe(false);
    expect(validPortfolios([{ ...p, name: ' ' }])).toBe(false);
    expect(validPortfolios([{ ...p, tokenKeys: ['CHEESE'] }])).toBe(false);
  });
});