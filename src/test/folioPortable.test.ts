import { describe, expect, it } from 'vitest';
import { exportFolio, mergeFolio, parseFolioFile } from '@/lib/folio/portable';
import { FOLIO_SCHEMA, type StoredFolio } from '@/lib/folio/storage';
import type { RawTransfer } from '@/lib/folio/types';

const tx = (gs: number, extra: Partial<RawTransfer> = {}): RawTransfer => ({
  gs, trx: gs.toString(16).padStart(64, '0'), ts: gs * 1000, contract: 'eosio.token',
  from: 'alice', to: 'bob', quantity: '1.00000000 WAX', memo: '', ...extra,
});
const rec = (transfers: RawTransfer[], extra: Partial<StoredFolio> = {}): StoredFolio => ({
  account: 'alice', schema: FOLIO_SCHEMA, transfers, cursors: {}, syncedAt: null, ...extra,
});
const text = async (r: StoredFolio, mutate?: (f: any) => void) => {
  const f: any = await exportFolio(r);
  mutate?.(f);
  return JSON.stringify(f);
};

describe('CHEESEFolio portable history file', () => {
  it('round-trips export → import unchanged', async () => {
    const r = rec([tx(2), tx(1)], { syncedAt: 5, coverageFrom: 1000, cursors: { 'https://h': { after: '2024-01-01T00:00:00.000Z', caughtUp: true } } });
    const h = await parseFolioFile(await text(r), 'alice');
    expect(h.transfers.map((t) => t.gs)).toEqual([1, 2]);
    expect(h.cursors).toEqual(r.cursors);
    expect(h.syncedAt).toBe(5);
    expect(h.coverageFrom).toBe(1000);
  });
  it('merges by global sequence, keeping the more detailed copy', async () => {
    const local = rec([tx(1), tx(2)]);
    const file = await parseFolioFile(await text(rec([tx(2, { fillChecked: true, fillGave: { contract: 'eosio.token', quantity: '3.00000000 WAX' } }), tx(3)])), 'alice');
    const m = mergeFolio(local, file);
    expect(m.added).toBe(1);
    expect(m.alreadySaved).toBe(1);
    expect(m.rec.transfers.map((t) => t.gs)).toEqual([1, 2, 3]);
    expect(m.rec.transfers[1].fillGave?.quantity).toBe('3.00000000 WAX');
  });
  it('rejects a file for another account', async () => {
    await expect(parseFolioFile(await text(rec([tx(1)])), 'carol')).rejects.toThrow(/alice.*carol/);
  });
  it('rejects edited transfers (checksum mismatch)', async () => {
    const t = await text(rec([tx(1)]), (f) => { f.sections.history.transfers[0].quantity = '9.00000000 WAX'; });
    await expect(parseFolioFile(t, 'alice')).rejects.toThrow(/checksum/);
  });
  it('rejects files from a newer version', async () => {
    await expect(parseFolioFile(await text(rec([tx(1)]), (f) => { f.version = 2; }), 'alice')).rejects.toThrow(/newer/);
  });
  it('ignores unknown extra sections', async () => {
    const h = await parseFolioFile(await text(rec([tx(1)]), (f) => { f.sections.layout = { columns: ['x'] }; }), 'alice');
    expect(h.transfers).toHaveLength(1);
  });
  it('never marks a service finished from an unfinished side', async () => {
    const local = rec([], { cursors: { h: { after: '2024-01-01T00:00:00.000Z', caughtUp: true } } });
    const file = await parseFolioFile(await text(rec([], { cursors: { h: { after: '2025-01-01T00:00:00.000Z', caughtUp: false, windows: [] }, g: { after: null, caughtUp: false } } })), 'alice');
    const m = mergeFolio(local, file);
    expect(m.rec.cursors.h).toEqual({ after: '2024-01-01T00:00:00.000Z', caughtUp: true });
    expect(m.rec.cursors.g.caughtUp).toBe(false);
  });
});
