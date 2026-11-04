import { describe, it, expect } from 'vitest';
import { saveRouterTx, loadRouterCache, FINAL_AGE_MS } from '@/lib/cryptRouterCache';

describe('router cache', () => {
  it('keeps recent (reversible) transactions out of the persistent cache', async () => {
    await saveRouterTx('recent', Date.now() - 1000, []);
    expect((await loadRouterCache()).has('recent')).toBe(false);
  });
  it('stores final transactions', async () => {
    const row = { txId: 'old', time: Date.now() - FINAL_AGE_MS - 1, from: 'a', to: 'b', memo: 'm', quantity: '0.0001 CHEESE' };
    await saveRouterTx('old', row.time, [row]);
    expect((await loadRouterCache()).get('old')).toEqual([row]);
  });
});
