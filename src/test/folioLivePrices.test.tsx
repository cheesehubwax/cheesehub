import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAlcorTokenPrices } from '@/hooks/useAlcorTokenPrices';

const mocks = vi.hoisted(() => ({ fetchTokens: vi.fn() }));
vi.mock('@/lib/swapApi', () => ({
  fetchSwapTokenList: mocks.fetchTokens, POPULAR_TICKERS: [], snapshotSwapTokens: () => [],
}));
vi.mock('@/lib/tokenLogos', () => ({ initializeTokenCacheFromData: vi.fn() }));
vi.mock('@/lib/tokenSnapshot', () => ({ readTokenSnapshot: () => null }));

function setup(live = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { ...renderHook(() => useAlcorTokenPrices(live), { wrapper }), client };
}
const token = (price: number) => [{ contract: 'cheeseburger', ticker: 'CHEESE', precision: 4, system_price: price }];

describe('CHEESEFolio live market prices', () => {
  beforeEach(() => { localStorage.clear(); mocks.fetchTokens.mockReset(); focusManager.setFocused(true); });
  afterEach(() => { cleanup(); vi.useRealTimers(); focusManager.setFocused(undefined); });

  it('replaces the price after 60 seconds without reloading history', async () => {
    mocks.fetchTokens.mockResolvedValueOnce(token(2)).mockResolvedValue(token(1));
    const hook = setup();
    await waitFor(() => expect(hook.result.current.data?.get('cheeseburger:CHEESE')).toBe(2));
    vi.useFakeTimers();
    // Re-mount under fake timers so the interval is controlled by this clock.
    hook.unmount();
    const next = setup();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    const before = mocks.fetchTokens.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(mocks.fetchTokens.mock.calls.length).toBe(before + 1);
    expect(next.result.current.data?.get('cheeseburger:CHEESE')).toBe(1);
    next.client.clear(); hook.client.clear();
  });

  it('refreshes on returning even if the last request is still fresh', async () => {
    mocks.fetchTokens.mockResolvedValueOnce(token(2)).mockResolvedValue(token(1));
    const hook = setup();
    await waitFor(() => expect(hook.result.current.data?.get('cheeseburger:CHEESE')).toBe(2));
    act(() => focusManager.setFocused(false));
    act(() => focusManager.setFocused(true));
    await waitFor(() => expect(hook.result.current.data?.get('cheeseburger:CHEESE')).toBe(1));
    expect(mocks.fetchTokens).toHaveBeenCalledTimes(2);
    hook.client.clear();
  });

  it('does not call metadata-only fallback a fresh price update', async () => {
    mocks.fetchTokens.mockResolvedValue(token(0));
    const hook = setup();
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
    expect(hook.result.current.data?.has('cheeseburger:CHEESE')).toBe(false);
    expect(hook.result.current.pricesUpdatedAt).toBe(0);
    hook.client.clear();
  });

  it('does not poll or refresh on focus outside the live-price observer', async () => {
    mocks.fetchTokens.mockResolvedValue(token(2));
    const hook = setup(false);
    await waitFor(() => expect(hook.result.current.data?.size).toBe(1));
    act(() => focusManager.setFocused(false));
    act(() => focusManager.setFocused(true));
    await act(async () => { await Promise.resolve(); });
    expect(mocks.fetchTokens).toHaveBeenCalledTimes(1);
    hook.client.clear();
  });
});