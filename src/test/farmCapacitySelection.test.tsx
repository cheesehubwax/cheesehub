import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FarmInfo } from '@/lib/farm';

const state = vi.hoisted(() => ({ execute: vi.fn(), latestFarm: vi.fn(), latestConfig: vi.fn(), empty: [], now: 1_800_000_000 }));
const config = { collections: [], schemas: [], attributes: [], templates: [
  { collection: 'col', template_id: 1, hourly_rate: '0.01 X', hourly_rates: [{ contract: 'c', quantity: '0.01 X' }] },
  { collection: 'col', template_id: 2, hourly_rate: '1.00 X', hourly_rates: [{ contract: 'c', quantity: '1.00 X' }] },
] };
const assets = [
  { asset_id: '1', name: 'Low A', collection: 'col', schema: 's', template_id: '1', image: '' },
  { asset_id: '2', name: 'Low B', collection: 'col', schema: 's', template_id: '1', image: '' },
  { asset_id: '3', name: 'High', collection: 'col', schema: 's', template_id: '2', image: '' },
];
const farm: FarmInfo = { farm_name: 'test', creator: 'owner', status: 1, is_active: true, expiration: state.now + 360000,
  farm_type: 2, reward_pools: [{ contract: 'c', symbol: 'X', precision: 2, balance: '101.00', total_funds: '101.00 X', total_hourly_reward: '1.00 X' }],
  logo: '', description: '', staked_count: 1, payout_interval: 3600, last_payout: state.now, id: 1, time_created: state.now };

vi.mock('@/lib/farm', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/farm')>(),
  fetchFarmDetails: state.latestFarm, fetchFarmCapacityConfig: state.latestConfig }));
vi.mock('@/context/WaxContext', () => ({ useWax: () => ({ accountName: 'user', session: undefined }) }));
vi.mock('@/hooks/useWaxTransaction', () => ({ useWaxTransaction: () => ({ executeTransaction: state.execute }) }));
vi.mock('@/hooks/useFarmClaimTotals', () => ({ useFarmClaimTotals: () => ({ totals: {} }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('@/hooks/useFarmCapacity', () => ({ useFarmCapacity: () => ({ data: config, summary: 'limited', now: state.now, refetch: vi.fn() }) }));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useQuery: ({ queryKey }: { queryKey: string[] }) => ({
    data: queryKey[0] === 'eligibleNfts' ? assets : queryKey[0] === 'farmStakableConfig' ? config : state.empty,
    isLoading: false, refetch: vi.fn(),
  }),
}));
vi.mock('@/components/farm/staking/StakingVirtualGrid', () => ({
  // Call the real selection handler even for blocked assets to exercise its guard.
  VirtualGrid: ({ items, onToggle }: { items: typeof assets; onToggle: (id: string) => void }) => <div>{items.map(asset => <button key={asset.asset_id} onClick={() => onToggle(asset.asset_id)}>{asset.name}</button>)}</div>,
}));
import { NFTStaking } from '@/components/farm/NFTStaking';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(state.now * 1000);
  state.execute.mockReset();
  state.latestFarm.mockReset().mockResolvedValue(farm);
  state.latestConfig.mockReset().mockResolvedValue(config);
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('capacity-aware NFT selection', () => {
  it('refuses a high-rate NFT while keeping a lower-rate NFT selectable', async () => {
    state.execute.mockResolvedValue({ success: false });
    render(<NFTStaking farm={farm} onRefresh={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'High' }));
    expect(screen.getByRole('button', { name: 'Stake Selected (0)' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Low A' }));
    fireEvent.click(screen.getByRole('button', { name: 'Stake Selected (1)' }));
    await waitFor(() => expect(state.execute).toHaveBeenCalledTimes(1));
    expect(state.execute.mock.calls[0][0][0].data.assets_to_stake).toEqual(['1']);
  });
  it('prevents a combined selection that exceeds the available rewards', () => {
    render(<NFTStaking farm={farm} onRefresh={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Low A' }));
    fireEvent.click(screen.getByRole('button', { name: 'Low B' }));
    const stake = screen.getByRole('button', { name: 'Stake Selected (2)' });
    expect(stake).toBeDisabled();
    fireEvent.click(stake);
    expect(state.execute).not.toHaveBeenCalled();
  });
  it('checks fresh rewards and never opens the wallet if capacity has changed', async () => {
    state.latestFarm.mockResolvedValue({ ...farm, reward_pools: [{ ...farm.reward_pools[0], total_funds: '100.00 X' }] });
    render(<NFTStaking farm={farm} onRefresh={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Low A' }));
    fireEvent.click(screen.getByRole('button', { name: 'Stake Selected (1)' }));
    await waitFor(() => expect(state.latestFarm).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Stake Selected (1)' })).toBeEnabled());
    expect(state.execute).not.toHaveBeenCalled();
  });
});