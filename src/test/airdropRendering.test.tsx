import { Profiler, type ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AirdropProvider, useAirSend, useAirSnapshot, useAirDistribution, useAirHolders, useAirCosts, useAirRun } from '@/components/air/AirdropContext';
import { AirHoldersTable } from '@/components/air/AirHoldersTable';

const mocks = vi.hoisted(() => ({
  getTokenHolders: vi.fn(),
  executeTransaction: vi.fn(),
  refetch: vi.fn(async () => undefined),
  checkboxRenders: new Map<string, number>(),
  stat: { precision: 8, supply: '1000000.00000000 WAX' },
}));
vi.mock('@/context/WaxContext', () => ({ useWax: () => ({ accountName: null, session: null, cheeseBalance: null }) }));
vi.mock('@/hooks/useWaxTransaction', () => ({ useWaxTransaction: () => ({ executeTransaction: mocks.executeTransaction }) }));
vi.mock('@/context/TransactionSuccessContext', () => ({ useTransactionSuccess: () => ({ showSuccess: mocks.refetch }) }));
vi.mock('@/components/shared/ResourceGauges', () => ({ refreshResourceGauges: vi.fn() }));
vi.mock('@/components/OpenMojiIcon', () => ({ OpenMojiIcon: () => null }));
vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({ checked, onCheckedChange, 'aria-label': label }: { checked: boolean; onCheckedChange: () => void; 'aria-label': string }) => {
    mocks.checkboxRenders.set(label, (mocks.checkboxRenders.get(label) ?? 0) + 1);
    return <input type="checkbox" aria-label={label} checked={checked} onChange={onCheckedChange} />;
  },
}));
vi.mock('@/hooks/useAirdropQueries', () => ({
  useAirTokenStat: () => ({ data: mocks.stat }),
  useAirWalletTokens: () => ({}),
  useAirInventoryCollections: () => ({}),
  useAirInventoryTemplates: () => ({}),
  useAirInventoryAssets: () => ({}),
  useAirAlcorPairs: () => ({}),
  useAirAccountResources: () => ({ refetch: mocks.refetch }),
  useAirRamPrice: () => ({}),
  useAirResourcePricing: () => ({}),
}));
vi.mock('@/lib/airdropChain', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/airdropChain')>(),
  getTokenHolders: mocks.getTokenHolders,
  getExistingTokenRows: vi.fn(async (_contract: string, _symbol: string, accounts: string[]) => ({ existing: accounts, unknown: [] })),
}));

function holderAccount(index: number) {
  return `holder${String.fromCharCode(97 + Math.floor(index / 26))}${String.fromCharCode(97 + index % 26)}`;
}
const holders = Array.from({ length: 501 }, (_, i) => ({ account: holderAccount(i), weight: 501 - i, raw: String(501 - i) }));
const renders = { send: 0, snapshot: 0, distribution: 0, holders: 0, costs: 0, run: 0, table: 0 };
let snapshotApi: ReturnType<typeof useAirSnapshot>;
let distributionApi: ReturnType<typeof useAirDistribution>;
let runApi: ReturnType<typeof useAirRun>;
let holdersApi: ReturnType<typeof useAirHolders>;

function SendProbe() { useAirSend(); renders.send++; return null; }
function SnapshotProbe() { snapshotApi = useAirSnapshot(); renders.snapshot++; return null; }
function DistributionProbe() { distributionApi = useAirDistribution(); renders.distribution++; return null; }
function HoldersProbe() { holdersApi = useAirHolders(); renders.holders++; return null; }
function CostsProbe() { useAirCosts(); renders.costs++; return null; }
function RunProbe() { runApi = useAirRun(); renders.run++; return null; }

function mount(children?: ReactNode) {
  Object.keys(renders).forEach(key => { renders[key as keyof typeof renders] = 0; });
  mocks.checkboxRenders.clear();
  mocks.getTokenHolders.mockResolvedValue({ holders, source: 'lightapi', truncated: false, hasBalances: true });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><AirdropProvider>
    <SendProbe /><SnapshotProbe /><DistributionProbe /><HoldersProbe /><CostsProbe /><RunProbe />
    <Profiler id="holders" onRender={() => { renders.table++; }}><AirHoldersTable /></Profiler>
    {children}
  </AirdropProvider></QueryClientProvider>);
}
async function load() {
  await act(async () => { await snapshotApi.loadSnapshot(); });
}
afterEach(cleanup);

describe('CHEESEAir render isolation', () => {
  it('isolates recipient-source keystrokes from all unrelated cards and the table', async () => {
    mount();
    await load();
    const before = { ...renders };
    const rowBefore = new Map(mocks.checkboxRenders);
    act(() => snapshotApi.setSnapContract('cheeseburger'));
    act(() => snapshotApi.setSnapSymbol('CHEESE'));
    expect(snapshotApi.snapSymbol).toBe('CHEESE');
    expect(renders.snapshot).toBeGreaterThan(before.snapshot);
    for (const key of ['send', 'distribution', 'holders', 'costs', 'run', 'table'] as const) expect(renders[key]).toBe(before[key]);
    expect(mocks.checkboxRenders).toEqual(rowBefore);
    await load();
    expect(mocks.getTokenHolders).toHaveBeenLastCalledWith('cheeseburger', 'CHEESE');
  });

  it('memo typing and terms changes leave all 500 displayed rows untouched', async () => {
    mount();
    await load();
    const before = { ...renders };
    const rowBefore = new Map(mocks.checkboxRenders);
    act(() => distributionApi.setMemo('Latest memo'));
    expect(distributionApi.memo).toBe('Latest memo');
    act(() => runApi.setTermsAccepted(true));
    expect(runApi.termsAccepted).toBe(true);
    for (const key of ['send', 'snapshot', 'holders', 'costs', 'table'] as const) expect(renders[key]).toBe(before[key]);
    expect(mocks.checkboxRenders).toEqual(rowBefore);
    expect(screen.getAllByRole('checkbox')).toHaveLength(500);
    expect(holdersApi.filteredHolders).toHaveLength(501);
  });

  it('batch-size changes update estimates but not sender, snapshot or holder rows', async () => {
    mount();
    await load();
    act(() => distributionApi.setAmountText('501'));
    const before = { ...renders };
    const rowBefore = new Map(mocks.checkboxRenders);
    act(() => distributionApi.setBatchSize(10));
    expect(runApi.estimate.txCount).toBe(51);
    for (const key of ['send', 'snapshot', 'holders', 'table'] as const) expect(renders[key]).toBe(before[key]);
    expect(renders.costs).toBeGreaterThan(before.costs);
    expect(mocks.checkboxRenders).toEqual(rowBefore);
  });

  it('fixed payouts toggle only the changed row while keeping all 501 recipients eligible', async () => {
    mount();
    await load();
    act(() => { distributionApi.setMode('fixed'); distributionApi.setAmountText('1'); });
    expect(holdersApi.recipients).toHaveLength(501);
    const before = new Map(mocks.checkboxRenders);
    fireEvent.click(screen.getByRole('checkbox', { name: `Include ${holderAccount(0)}` }));
    expect(screen.getByRole('checkbox', { name: `Include ${holderAccount(0)}` })).not.toBeChecked();
    expect(holdersApi.recipients).toHaveLength(500);
    expect(holdersApi.recipients.find(r => r.account === holderAccount(1))?.units).toBe(100000000n);
    const changed = [...mocks.checkboxRenders].filter(([key, count]) => count !== before.get(key));
    expect(changed.map(([key]) => key)).toEqual([`Include ${holderAccount(0)}`]);
  });

  it('equal-split changes still refresh every changed payout and preserve the full total', async () => {
    mount();
    await load();
    act(() => distributionApi.setAmountText('501'));
    const before = new Map(mocks.checkboxRenders);
    fireEvent.click(screen.getByRole('checkbox', { name: `Include ${holderAccount(0)}` }));
    expect(holdersApi.recipients.reduce((sum, r) => sum + r.units, 0n)).toBe(50100000000n);
    expect(holdersApi.recipients.find(r => r.account === holderAccount(1))?.units).toBe(100200000n);
    expect([...mocks.checkboxRenders].filter(([key, count]) => count !== before.get(key))).toHaveLength(500);
  });
});