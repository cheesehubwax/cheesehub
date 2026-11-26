import { describe, it, expect, vi } from 'vitest';
vi.mock('@/lib/waxRpcFallback', () => ({ fetchTableRows: vi.fn() }));
import { fetchTableRows } from '@/lib/waxRpcFallback';
import { fetchFarmCapacityConfig } from '@/lib/farm';

describe('complete capacity rule reads', () => {
  it('reads only the active table and continues through every page', async () => {
    vi.mocked(fetchTableRows).mockResolvedValueOnce({ rows: [{ template_id: 1, reward_values: [{ quantity: '0.01 X', contract: 'c' }] }], more: true, next_key: '2' })
      .mockResolvedValueOnce({ rows: [{ template_id: 2, reward_values: [{ quantity: '1.00 X', contract: 'c' }] }], more: false });
    const c = await fetchFarmCapacityConfig('test', 2);
    expect(c.templates.map(t => t.hourly_rate)).toEqual(['0.01 X', '1.00 X']);
    expect(fetchTableRows).toHaveBeenLastCalledWith(expect.objectContaining({ table: 'valuesbytemp', scope: 'test', lower_bound: '2' }));
  });
  it('rejects a stalled read instead of returning an incomplete summary', async () => {
    vi.mocked(fetchTableRows).mockResolvedValueOnce({ rows: [], more: true });
    await expect(fetchFarmCapacityConfig('test', 2)).rejects.toThrow('Incomplete');
  });
});