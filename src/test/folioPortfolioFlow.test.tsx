import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Folio from '@/pages/Folio';
import { parseFolioFile } from '@/lib/folio/portable';
import type { StoredFolio } from '@/lib/folio/storage';

const state = vi.hoisted(() => ({ records: new Map<string, StoredFolio>(), account: 'alice', blob: null as Blob | null }));
vi.mock('@/context/WaxContext', () => ({ useWax: () => ({ accountName: state.account, isConnected: true, login: vi.fn() }) }));
vi.mock('@/components/Layout', () => ({ Layout: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('@/components/TokenLogo', () => ({ TokenLogo: () => null }));
vi.mock('@/components/OpenMojiIcon', () => ({ OpenMojiIcon: () => null }));
vi.mock('@/lib/fartSounds', () => ({ playRandomFart: vi.fn() }));
vi.mock('@/hooks/useAllTokenBalances', () => ({ useAllTokenBalances: () => ({ tokens: [
  { contract: 'eosio.token', symbol: 'WAX', precision: 8, balance: 100, isLpToken: false },
  { contract: 'cheeseburger', symbol: 'CHEESE', precision: 4, balance: 20, isLpToken: false },
], isLoading: false }) }));
vi.mock('@/hooks/useAlcorTokenPrices', () => ({ useAlcorTokenPrices: () => ({ data: new Map([['cheeseburger:CHEESE', 2]]) }) }));
vi.mock('@/hooks/useWaxPrice', () => ({ useWaxPrice: () => ({ data: 0.1 }) }));
vi.mock('@/hooks/usePooledTokens', () => ({ usePooledTokens: () => ({ data: { tokens: new Map(), failed: [] }, isFetching: false }) }));
vi.mock('@/hooks/useRealisableValues', () => ({ useRealisableValues: () => ({ data: new Map([['cheeseburger:CHEESE', { wax: 40, gapPct: 0 }]]) }) }));
vi.mock('@/lib/folio/prices', () => ({ loadPriceLookup: async () => ({ priceAt: () => null }), fetchWaxUsdDaily: async () => new Map(), waxUsdLookup: () => () => null }));
vi.mock('@/lib/folio/scanner', () => ({ hasCoverageGap: () => false, syncFolio: async (rec: StoredFolio) => { rec.syncedAt = Date.now(); return { providersOk: 1, complete: true }; } }));
vi.mock('@/lib/folio/storage', () => ({ FOLIO_SCHEMA: 2,
  loadFolio: async (account: string) => structuredClone(state.records.get(account) ?? null),
  saveFolio: async (rec: StoredFolio) => { state.records.set(rec.account, structuredClone(rec)); },
  clearFolio: async (account: string) => { state.records.delete(account); },
}));

describe('portfolio creation and combined JSON restoration', () => {
  beforeEach(() => {
    state.records.clear(); state.account = 'alice'; state.blob = null; localStorage.clear();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: (blob: Blob) => { state.blob = blob; return 'blob:backup'; } });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });
  it('creates from holdings, scopes value, saves one file, clears, loads and syncs without losing the grouping', async () => {
    const q = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(<QueryClientProvider client={q}><Folio /></QueryClientProvider>);
    const create = await screen.findByRole('button', { name: /New portfolio/ });
    await waitFor(() => expect(create).not.toBeDisabled());
    fireEvent.click(create);
    fireEvent.change(screen.getByLabelText('Portfolio name'), { target: { value: 'Meme coins' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Include CHEESE (cheeseburger)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save portfolio' }));
    await screen.findByRole('tab', { name: /Meme coins/ });
    expect(state.records.get('alice')?.portfolios?.[0].tokenKeys).toEqual(['cheeseburger:CHEESE']);
    const table = screen.getByRole('table', { name: 'Holdings' });
    expect(within(table).getByText('CHEESE')).toBeTruthy();
    expect(within(table).queryByText('eosio.token')).toBeNull();
    expect(screen.getAllByText('40 WAX').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Save history & portfolios (JSON)' }));
    await waitFor(() => expect(state.blob).not.toBeNull());
    const saved = await new Promise<string>((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); if (state.blob) reader.readAsText(state.blob); });
    expect((await parseFolioFile(saved, 'alice')).portfolios?.[0].name).toBe('Meme coins');
    fireEvent.click(screen.getByRole('button', { name: 'Clear saved data' }));
    await waitFor(() => expect(screen.queryByRole('tab', { name: /Meme coins/ })).toBeNull());
    const file = new File([saved], 'folio.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: async () => saved });
    const input = view.container.querySelector('input[type="file"]');
    if (!input) throw new Error('Missing import input');
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(await screen.findByRole('tab', { name: /Meme coins/ }));
    expect(within(screen.getByRole('table', { name: 'Holdings' })).queryByText('eosio.token')).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'Scan my history' })[0]);
    await waitFor(() => expect(state.records.get('alice')?.syncedAt).toBeTypeOf('number'));
    expect(state.records.get('alice')?.portfolios?.[0].name).toBe('Meme coins');
    fireEvent.click(screen.getByRole('button', { name: /Edit portfolio/ }));
    fireEvent.change(screen.getByLabelText('Portfolio name'), { target: { value: 'My memes' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save portfolio' }));
    await screen.findByRole('tab', { name: /My memes/ });
    expect(state.records.get('alice')?.portfolios?.[0].name).toBe('My memes');
    fireEvent.click(screen.getByRole('button', { name: 'Delete portfolio' }));
    await waitFor(() => expect(screen.queryByRole('tab', { name: /My memes/ })).toBeNull());
    expect(state.records.get('alice')?.portfolios).toEqual([]);
    fireEvent.change(input, { target: { files: [file] } });
    await screen.findByRole('tab', { name: /Meme coins/ });
    fireEvent.click(screen.getByRole('tab', { name: /All Holdings/ }));
    expect(within(screen.getByRole('table', { name: 'Holdings' })).getByText('eosio.token')).toBeTruthy();
    state.account = 'bob'; view.rerender(<QueryClientProvider client={q}><Folio /></QueryClientProvider>);
    await waitFor(() => expect(screen.queryByRole('tab', { name: /Meme coins/ })).toBeNull());
    expect(state.records.get('alice')?.portfolios).toHaveLength(1);
  });
});