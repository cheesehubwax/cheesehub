import { describe, expect, it } from 'vitest';
import { carryForward, combineWaxFiat, fxLookup, parseCbrDynamic, FIAT_CURRENCIES } from '@/lib/folio/fxCore';
import { buildLedger } from '@/lib/folio/ledger';
import type { FolioEvent } from '@/lib/folio/types';

const ts = (d: string) => Date.parse(`${d}T12:00:00Z`);

describe('FX history', () => {
  it('offers AUD, CAD, EUR, GBP, JPY, CNY, INR and RUB', () => {
    const codes = FIAT_CURRENCIES.map((c) => c.code);
    for (const c of ['USD', 'AUD', 'CAD', 'EUR', 'GBP', 'JPY', 'CNY', 'INR', 'RUB']) expect(codes).toContain(c);
  });

  it('carries a rate forward for at most 7 days', () => {
    const out = carryForward({ '2024-01-01': 1.5, '2024-01-20': 1.6 }, '2024-01-20');
    expect(out['2024-01-08']).toBe(1.5);
    expect(out['2024-01-09']).toBeUndefined();
    expect(out['2024-01-20']).toBe(1.6);
  });

  it('reads RUB per USD from Central Bank of Russia records, honouring nominal', () => {
    const xml = '<ValCurs><Record Date="03.12.2019" Id="R01235"><Nominal>1</Nominal><Value>64,4097</Value></Record>'
      + '<Record Date="04.12.2019" Id="R01235"><Nominal>10</Nominal><Value>641,401</Value></Record></ValCurs>';
    const r = parseCbrDynamic(xml);
    expect(r['2019-12-03']).toBe(64.4097);
    expect(r['2019-12-04']).toBeCloseTo(64.1401, 8);
  });

  it('USD is always exactly 1 and other currencies go unknown past 7 days', () => {
    expect(fxLookup('USD', undefined)(ts('2020-01-01'))).toBe(1);
    const aud = fxLookup('AUD', { '2024-01-01': 1.5 });
    expect(aud(ts('2024-01-08'))).toBe(1.5);
    expect(aud(ts('2024-01-09'))).toBeNull();
    expect(aud(ts('2023-12-31'))).toBeNull();
  });

  it('costs a purchase at the purchase-day exchange rate, not today\'s', () => {
    const waxUsd = () => 0.5;
    const fx = fxLookup('AUD', { '2021-05-01': 1.3, '2026-10-01': 1.6 });
    const events: FolioEvent[] = [{
      id: 'a', ts: ts('2021-05-01'), trx: 't', type: 'trade', venue: 'alcor',
      out: [{ key: 'eosio.token:WAX', contract: 'eosio.token', symbol: 'WAX', precision: 8, amount: 100 }],
      in: [{ key: 'x:TOK', contract: 'x', symbol: 'TOK', precision: 4, amount: 10 }],
    } as unknown as FolioEvent];
    const ledger = buildLedger(events, undefined, combineWaxFiat(waxUsd, fx));
    // 100 WAX × 0.5 USD × 1.3 AUD/USD
    expect(ledger.positions.get('x:TOK')!.costUsd).toBeCloseTo(65, 6);
  });

  it('marks history incomplete when the exchange rate for a trade day is unknown', () => {
    const fx = fxLookup('AUD', {});
    const events: FolioEvent[] = [{
      id: 'a', ts: ts('2021-05-01'), trx: 't', type: 'trade', venue: 'alcor',
      out: [{ key: 'eosio.token:WAX', contract: 'eosio.token', symbol: 'WAX', precision: 8, amount: 100 }],
      in: [{ key: 'x:TOK', contract: 'x', symbol: 'TOK', precision: 4, amount: 10 }],
    } as unknown as FolioEvent];
    const ledger = buildLedger(events, undefined, combineWaxFiat(() => 0.5, fx));
    expect(ledger.positions.get('x:TOK')!.usdGap).toBe(true);
  });
});

describe('BTC/ETH history', () => {
  it('turns Binance daily closes into coins per 1 USD', async () => {
    const { parseBinanceKlines, invertUsd } = await import('@/lib/folio/fxCore');
    const rows = [[Date.parse('2021-05-01T00:00:00Z'), '0', '0', '0', '50000'], [Date.parse('2021-05-02T00:00:00Z'), '0', '0', '0', '40000']];
    const per = invertUsd(parseBinanceKlines(rows));
    expect(per['2021-05-01']).toBeCloseTo(1 / 50000, 15);
    expect(per['2021-05-02']).toBeCloseTo(1 / 40000, 15);
  });

  it('values a past WAX amount at that day\'s BTC price, not today\'s', () => {
    const btc = fxLookup('BTC', { '2021-05-01': 1 / 50000, '2026-10-20': 1 / 100000 });
    const waxFiat = combineWaxFiat(() => 0.5, btc);
    expect(waxFiat(ts('2021-05-01'))).toBeCloseTo(0.5 / 50000, 15);
    expect(waxFiat(ts('2026-10-20'))).toBeCloseTo(0.5 / 100000, 15);
  });

  it('leaves a BTC day unknown when the last price is over 7 days old', () => {
    const btc = fxLookup('BTC', { '2021-05-01': 1 / 50000 });
    expect(btc(ts('2021-05-08'))).toBeCloseTo(1 / 50000, 15);
    expect(btc(ts('2021-05-09'))).toBeNull();
  });
});
