import { describe, it, expect, vi, beforeEach } from 'vitest';

const DAY_MS = 24 * 60 * 60 * 1000;

function nullAction(from: string, amount: number, daysAgo: number) {
  return {
    act: { data: { from, to: 'eosio.null', quantity: `${amount.toFixed(4)} CHEESE` } },
    '@timestamp': new Date(Date.now() - daysAgo * DAY_MS).toISOString(),
  };
}

const fetchActionsUnion = vi.fn();
const fetchContractStats = vi.fn();
const chainPost = vi.fn();

vi.mock('../lib/hyperionHistory', () => ({
  fetchActionsUnion: (...args: unknown[]) => fetchActionsUnion(...args),
  // Sum the quantity field across the given actions, mirroring the real helper.
  sumAssetField: (actions: { act?: { data?: { quantity?: string } } }[], _field?: string, filter?: (d: Record<string, unknown>) => boolean) =>
    actions.reduce((sum, a) => {
      const data = a.act?.data;
      if (!data?.quantity) return sum;
      if (filter && !filter(data as Record<string, unknown>)) return sum;
      return sum + (parseFloat(data.quantity.split(' ')[0]) || 0);
    }, 0),
}));
vi.mock('../lib/cheeseNullApi', () => ({
  fetchContractStats: (...args: unknown[]) => fetchContractStats(...args),
  parseAssetAmount: (s: string) => parseFloat(s.split(' ')[0]) || 0,
}));
vi.mock('../lib/chainRequest', () => ({
  chainPost: (...args: unknown[]) => chainPost(...args),
}));

import { fetchNullBreakdown } from '../lib/cheeseNullBreakdown';

beforeEach(() => {
  fetchActionsUnion.mockReset();
  fetchContractStats.mockReset();
  chainPost.mockReset();
  fetchContractStats.mockResolvedValue(null);
  chainPost.mockResolvedValue({ rows: [] });
});

function mockHistory(nullActions: unknown[], powerActions: unknown[] = []) {
  fetchActionsUnion
    .mockResolvedValueOnce({ actions: nullActions, endpointsSucceeded: 3 })
    .mockResolvedValueOnce({ actions: powerActions, endpointsSucceeded: 3 });
}

describe('fetchNullBreakdown averages', () => {
  it('divides the lifetime total by the tracked span (60-day example)', async () => {
    // cheesebannad: 6,000 CHEESE total, earliest null 60 days ago.
    mockHistory([
      nullAction('cheesebannad', 3000, 60),
      nullAction('cheesebannad', 3000, 1),
    ]);
    const { entries } = await fetchNullBreakdown();
    const entry = entries.find((e) => e.contract === 'cheesebannad')!;
    expect(entry.amount).toBeCloseTo(6000, 4);
    expect(entry.trackedDays).toBeCloseTo(60, 0);
    expect(entry.avg24h).toBeCloseTo(100, 0); // 6000 / 60 days
    expect(entry.avg7d).toBeCloseTo(700, 0); // 6000 / (60/7 weeks)
    expect(entry.avg30d).toBeCloseTo(3000, 0); // 6000 / (60/30 months)
  });

  it('keeps the avg7d = avg24h * 7 and avg30d = avg24h * 30 relationship', async () => {
    mockHistory([nullAction('cheesenftwax', 1234, 13), nullAction('cheesenftwax', 100, 2)]);
    const { entries } = await fetchNullBreakdown();
    const entry = entries.find((e) => e.contract === 'cheesenftwax')!;
    expect(entry.avg7d!).toBeCloseTo(entry.avg24h! * 7, 6);
    expect(entry.avg30d!).toBeCloseTo(entry.avg24h! * 30, 6);
  });

  it('clamps a span shorter than one day to one day', async () => {
    mockHistory([nullAction('ram.chz', 50, 0.1)]);
    const { entries } = await fetchNullBreakdown();
    const entry = entries.find((e) => e.contract === 'ram.chz')!;
    expect(entry.trackedDays).toBe(1);
    expect(entry.avg24h).toBeCloseTo(50, 4);
  });

  it('returns null averages when no history was observed for a contract', async () => {
    mockHistory([]);
    const { entries } = await fetchNullBreakdown();
    const entry = entries.find((e) => e.contract === 'liquidcheese')!;
    expect(entry.trackedDays).toBeNull();
    expect(entry.avg24h).toBeNull();
    expect(entry.avg7d).toBeNull();
    expect(entry.avg30d).toBeNull();
  });

  it('uses the authoritative stats figure as the total but the observed first transfer as the span', async () => {
    fetchContractStats.mockResolvedValue({ total_cheese_burned: '12000.0000 CHEESE' });
    mockHistory([nullAction('cheeseburner', 500, 30), nullAction('cheeseburner', 500, 5)]);
    const { entries } = await fetchNullBreakdown();
    const entry = entries.find((e) => e.contract === 'cheeseburner')!;
    expect(entry.amount).toBeCloseTo(12000, 4);
    expect(entry.trackedDays).toBeCloseTo(30, 0);
    expect(entry.avg24h).toBeCloseTo(400, 0); // 12000 / 30
  });
});
