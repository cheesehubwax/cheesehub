import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const store = new Map<string, unknown>();
vi.mock('@/lib/folio/storage', () => ({
  FOLIO_SCHEMA: 2,
  loadFolio: vi.fn(async () => null),
  saveFolio: vi.fn(async (r: { account: string }) => { store.set(r.account, structuredClone(r)); }),
  clearFolio: vi.fn(async (a: string) => { store.delete(a); }),
}));

let active = 0;
let maxActive = 0;
const releases: (() => void)[] = [];
vi.mock('@/lib/folio/scanner', () => ({
  syncFolio: vi.fn(async (rec: { transfers: unknown[]; partial?: boolean }, _onPage: unknown, signal: AbortSignal) => {
    active++;
    maxActive = Math.max(maxActive, active);
    rec.partial = true;
    await new Promise<void>((r) => { releases.push(r); signal.addEventListener('abort', () => r()); });
    active--;
    return { providersOk: 1, providers: 1, complete: false };
  }),
}));

import { useFolio } from '@/hooks/useFolio';

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

describe('CHEESEFolio sync lifecycle', () => {
  it('pressing Sync twice never runs two scans on the same history at once', async () => {
    const { result } = renderHook(() => useFolio('alice'), { wrapper });
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() => result.current.resync());
    await waitFor(() => expect(active).toBe(1));
    act(() => result.current.resync());
    await waitFor(() => expect(active).toBe(1));
    releases.splice(0).forEach((r) => r());
    await waitFor(() => expect(result.current.syncing).toBe(false));
    expect(maxActive).toBe(1);
  });

  it('an unfinished scan is reported as incomplete history', async () => {
    const { result } = renderHook(() => useFolio('bob'), { wrapper });
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() => result.current.resync());
    await waitFor(() => expect(releases.length).toBe(1));
    releases.splice(0).forEach((r) => r());
    await waitFor(() => expect(result.current.syncing).toBe(false));
    expect(result.current.partial).toBe(true);
  });
});
