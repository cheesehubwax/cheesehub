// CHEESEFolio state for the signed-in account: saved history → instant
// portfolio, then a quiet sync that only fetches transfers newer than the
// saved cursors.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { classifyTransfers } from '@/lib/folio/classify';
import { buildLedger } from '@/lib/folio/ledger';
import { fetchWaxUsdDaily, loadPriceLookup, waxUsdLookup } from '@/lib/folio/prices';
import { syncFolio, type ScanProgress } from '@/lib/folio/scanner';
import { clearFolio, FOLIO_SCHEMA, loadFolio, saveFolio, type StoredFolio } from '@/lib/folio/storage';
import { WAX_KEY } from '@/lib/folio/types';
import { fetchFxHistory } from '@/lib/folio/fx';
import { combineWaxFiat, fxLookup, isCrypto, type DisplayCode } from '@/lib/folio/fxCore';
import { downloadFolioFile, exportFolio, mergeFolio, parseFolioFile, PortableError, type MergeResult } from '@/lib/folio/portable';
import { validPortfolios, type FolioPortfolio } from '@/lib/folio/portfolios';

const emptyRecord = (account: string): StoredFolio => ({
  account, schema: FOLIO_SCHEMA, transfers: [], cursors: {}, syncedAt: null,
});

export function useFolio(account: string | null, fiat: DisplayCode = 'USD') {
  const [rec, setRec] = useState<StoredFolio | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [version, setVersion] = useState(0);

  const runSync = useCallback(async (start: StoredFolio) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setSyncing(true);
    setError(null);
    let lastSave = 0;
    try {
      const result = await syncFolio(start, async (r, p) => {
        if (ctrl.signal.aborted) return;
        setProgress(p);
        setVersion((v) => v + 1);
        // Persist at most every 1.5 s so an interrupted scan resumes.
        if (Date.now() - lastSave > 1500) {
          lastSave = Date.now();
          await saveFolio(r).catch(() => undefined);
        }
      }, ctrl.signal);
      if (ctrl.signal.aborted) return;
      await saveFolio(start).catch(() => undefined);
      setRec({ ...start });
      if (result.providersOk === 0) setError('No history service answered. Your saved portfolio is shown — try Sync again shortly.');
      else if (!result.complete) setError('Part of your history could not be read this time. Press Continue scan to finish — it picks up where it stopped.');
    } catch (e) {
      if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : 'History sync failed');
    } finally {
      if (abortRef.current === ctrl) {
        setSyncing(false);
        abortRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    setRec(null);
    setLoaded(false);
    setProgress(null);
    setError(null);
    if (!account) return;
    let cancelled = false;
    loadFolio(account)
      .catch(() => null)
      .then((saved) => {
        if (cancelled) return;
        const start = saved ?? emptyRecord(account);
        setRec(start);
        setLoaded(true);
        // Scanning only starts when the user presses the button.
      });
    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, [account, runSync]);

  const resync = useCallback(() => {
    if (rec) void runSync(rec);
  }, [rec, runSync]);

  const rescan = useCallback(async () => {
    if (!account) return;
    abortRef.current?.abort();
    await clearFolio(account).catch(() => undefined);
    const fresh = emptyRecord(account);
    fresh.portfolios = rec?.portfolios ?? [];
    setRec(fresh);
    setProgress(null);
    void runSync(fresh);
  }, [account, rec, runSync]);

  const stop = useCallback(() => {
    const ctrl = abortRef.current;
    if (!ctrl) return;
    ctrl.abort();
    abortRef.current = null;
    setSyncing(false);
    if (rec) {
      void saveFolio(rec).catch(() => undefined);
      setRec({ ...rec });
    }
  }, [rec]);

  const clear = useCallback(async () => {
    if (!account) return;
    abortRef.current?.abort();
    abortRef.current = null;
    await clearFolio(account).catch(() => undefined);
    setRec(emptyRecord(account));
    setProgress(null);
    setSyncing(false);
  }, [account]);

  const exportFile = useCallback(async () => {
    if (!rec) return;
    downloadFolioFile(await exportFolio(rec));
  }, [rec]);

  const savePortfolios = useCallback(async (portfolios: FolioPortfolio[]) => {
    if (!rec || !validPortfolios(portfolios)) throw new PortableError('Invalid portfolio.');
    // The scanner mutates this same record; keep definitions on its active record too.
    const previous = rec.portfolios;
    rec.portfolios = portfolios;
    try { await saveFolio(rec); } catch (e) { rec.portfolios = previous; throw e; }
    setRec({ ...rec });
  }, [rec]);

  /** Merges a saved file into this browser's history; throws a readable error. */
  const importFile = useCallback(async (file: File): Promise<MergeResult> => {
    if (!account || !rec) throw new PortableError('Sign in first.');
    const imported = await parseFolioFile(await file.text(), account);
    abortRef.current?.abort();
    abortRef.current = null;
    setSyncing(false);
    const result = mergeFolio(rec, imported);
    await saveFolio(result.rec);
    setRec(result.rec);
    setProgress(null);
    setError(null);
    return result;
  }, [account, rec]);

  // `version` changes as pages arrive mid-scan; the record is mutated in place.
  const transferCount = rec?.transfers.length ?? 0;
  const events = useMemo(
    () => (rec && account ? classifyTransfers(rec.transfers, account) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rec, account, transferCount, syncing ? Math.floor(version / 5) : version],
  );

  // Daily prices are needed only for token-for-token trades.
  const priceStamps = useMemo(
    () =>
      events
        .filter((e) => e.type === 'trade' && ![...e.out, ...e.in].some((a) => a.key === WAX_KEY))
        .map((e) => e.ts),
    [events],
  );
  const priceKey = useMemo(() => [...new Set(priceStamps.map((t) => Math.floor(t / 86_400_000)))].sort().join(','), [priceStamps]);
  const { data: lookup } = useQuery({
    queryKey: ['folio-prices', priceKey],
    queryFn: () => loadPriceLookup(priceStamps),
    enabled: !syncing && loaded,
    staleTime: 60 * 60 * 1000,
  });

  // WAX/USD on the day of each event, for USD profit/loss.
  const firstDay = events.length ? Math.floor(Math.min(...events.map((e) => e.ts)) / 86_400_000) : null;
  const { data: waxUsdDaily } = useQuery({
    queryKey: ['folio-wax-usd', firstDay],
    queryFn: () => firstDay == null ? Promise.resolve(new Map<number, number>()) : fetchWaxUsdDaily(firstDay * 86_400_000),
    enabled: !syncing && loaded && firstDay != null,
    staleTime: 6 * 60 * 60 * 1000,
  });
  const waxUsdAt = useMemo(() => (waxUsdDaily?.size ? waxUsdLookup(waxUsdDaily) : undefined), [waxUsdDaily]);

  // Daily fiat/USD rates; USD needs none and stays exactly as before.
  const { data: fx, isFetched: fxFetched } = useQuery({
    queryKey: ['folio-fx'],
    queryFn: ({ signal }) => fetchFxHistory(signal),
    enabled: fiat !== 'USD',
    staleTime: 6 * 60 * 60 * 1000,
  });
  const fxUnavailable = fiat !== 'USD' && fxFetched && !fx?.[fiat];
  const effectiveFiat: DisplayCode = fxUnavailable ? 'USD' : fiat;
  const fxAt = useMemo(
    () => (effectiveFiat === 'USD' ? fxLookup('USD', undefined) : fx?.[effectiveFiat] ? fxLookup(effectiveFiat, fx[effectiveFiat]) : null),
    [effectiveFiat, fx],
  );
  const waxFiatAt = useMemo(
    () => (waxUsdAt && fxAt ? (effectiveFiat === 'USD' ? waxUsdAt : combineWaxFiat(waxUsdAt, fxAt)) : undefined),
    [waxUsdAt, fxAt, effectiveFiat],
  );
  // BTC/ETH move intraday, so "now" uses the live price; the last recorded day is the fallback.
  const { data: liveCryptoUsd } = useQuery({
    queryKey: ['folio-crypto-live', effectiveFiat],
    queryFn: async ({ signal }) => {
      for (const host of ['https://data-api.binance.vision', 'https://api.binance.com']) {
        try {
          const res = await fetch(`${host}/api/v3/ticker/price?symbol=${effectiveFiat}USDT`, { signal });
          if (!res.ok) continue;
          const px = parseFloat(((await res.json()) as { price?: string }).price ?? '');
          if (px > 0) return px;
        } catch { /* next host */ }
      }
      return null;
    },
    enabled: isCrypto(effectiveFiat),
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });
  /** Currency units per 1 USD today (1 for USD); null while loading. */
  const fxNow = isCrypto(effectiveFiat) && liveCryptoUsd ? 1 / liveCryptoUsd : fxAt ? fxAt(Date.now()) : null;

  const ledger = useMemo(() => buildLedger(events, lookup?.priceAt, waxFiatAt), [events, lookup, waxFiatAt]);

  return {
    loaded,
    syncing,
    progress,
    error,
    events,
    ledger,
    usdHistoryLoaded: !!waxUsdDaily?.size && !!fxAt,
    fiat: effectiveFiat,
    fxNow,
    fxUnavailable,
    syncedAt: rec?.syncedAt ?? null,
    coverageFrom: rec?.coverageFrom ?? null,
    accountCreated: rec?.accountCreated ?? null,
    transferCount,
    hasHistory: transferCount > 0,
    resync,
    stop,
    rescan,
    clear,
    exportFile,
    importFile,
    portfolios: rec?.portfolios ?? [],
    savePortfolios,
  };
}
