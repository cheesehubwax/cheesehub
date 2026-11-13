import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { loadHistory, saveHistory, validateHistory } from '@/lib/cryptHistoryCache';
import { FINAL_AGE_MS } from '@/lib/cryptRouterCache';
import { fetchMessageDelta, fetchContractStream, STREAM_PAGE, type ChainMemo } from '@/lib/cheeseCrypt';

const row: ChainMemo = { txId: 'old', time: Date.now() - FINAL_AGE_MS - 60000, from: 'bob', to: 'alice', memo: 'CRYPT2:opaque', quantity: '0.0001 CHEESE' };
describe('encrypted local history', () => {
  it('roundtrips only ciphertext fields and atomically retains a five-minute checkpoint overlap', async () => {
    const recent = { ...row, txId: 'recent', time: Date.now() - 1000 };
    await saveHistory('alice', 'standard', [{ ...row, text: 'must not persist', secretKey: 'must not persist' } as ChainMemo, recent], Date.now(), 4);
    const saved = await loadHistory('alice', 'standard');
    expect(saved?.rows).toEqual([row]);
    expect(saved?.cursor).toBeLessThanOrEqual(Date.now() - FINAL_AGE_MS);
    expect(saved?.depth).toBe(4);
    expect(JSON.stringify(saved)).not.toContain('must not persist');
  });
  it('isolates accounts and privacy modes', async () => {
    await saveHistory('alice', 'standard', [row], Date.now(), 1);
    expect(await loadHistory('bob', 'standard')).toBeNull();
    expect(await loadHistory('alice', 'maximum')).toBeNull();
  });
  it('rejects unauthenticated router attributions and wrong-account rows', () => {
    const snapshot = { version: 1, account: 'alice', mode: 'standard', rows: [row], cursor: Date.now() - 1000, depth: 1 };
    expect(validateHistory({ ...snapshot, rows: [{ ...row, from: 'crypt.cheese' }] }, 'alice', 'standard')).toBeNull();
    expect(validateHistory({ ...snapshot, rows: [{ ...row, to: 'carol' }] }, 'alice', 'standard')).toBeNull();
  });
});
describe('restart catch-up', () => {
  const direct = (id: string) => ({ trx_id: id, '@timestamp': new Date(row.time).toISOString().slice(0, -1), act: { data: { from: row.from, to: row.to, memo: row.memo, quantity: row.quantity } } });
  it('includes legacy transfers, overlaps the saved timestamp and keeps equal-time page boundaries', async () => {
    const queries: string[] = [];
    const result = await fetchMessageDelta('alice', row.time, async q => {
      queries.push(q);
      if (q.includes('sendfree')) return [];
      return q.includes('skip=0') ? Array.from({ length: STREAM_PAGE }, (_, i) => direct(`t${i}`)) : [direct('boundary')];
    });
    expect(result.rows).toHaveLength(101);
    expect(result.rows.some(r => r.txId === 'boundary')).toBe(true);
    expect(result.complete).toBe(true);
    expect(queries.some(q => q.includes('skip=100'))).toBe(true);
    expect(decodeURIComponent(queries[0])).toContain(new Date(row.time - 30000).toISOString());
  });
  it('never advances the checkpoint when the bounded read overflows', async () => {
    const result = await fetchMessageDelta('alice', row.time, async q => q.includes('sendfree') ? [] : Array.from({ length: STREAM_PAGE }, (_, i) => direct(`t${i}`)));
    expect(result.complete).toBe(false);
    expect(result.cursor).toBe(row.time);
  });
  it('quiet stream polls advance their complete cursor without ever naming the account', async () => {
    const queries: string[] = [];
    const result = await fetchContractStream('alice', row.time, async q => { queries.push(q); return []; });
    expect(result.cursor).toBeGreaterThan(row.time);
    expect(result.complete).toBe(true);
    expect(queries[0]).not.toContain('alice');
  });
});