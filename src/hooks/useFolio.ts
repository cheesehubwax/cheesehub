// CHEESEFolio state for the signed-in account: saved history → instant
// portfolio, then a quiet sync that only fetches transfers newer than the
// saved cursors.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { classifyTransfers } from '@/lib/folio/classify';
import { buildLedger } from '@/lib/folio/ledger';
import { loadPriceLookup } from '@/lib/folio/prices';
import { syncFolio, type ScanProgress } from '@/lib/folio/scanner';
import { clearFolio, FOLIO_SCHEMA, loadFolio, saveFolio, type StoredFolio } from '@/lib/folio/storage';
import { WAX_KEY } from '@/lib/folio/types';

const emptyRecord = (account: string): StoredFolio => ({
  account, schema: FOLIO_SCHEMA, transfers: [], cursors: {}, syncedAt: null,
});

export function useFolio(account: string | null) {
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
        void runSync(start);
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
    setRec(fresh);
    setProgress(null);
    void runSync(fresh);
  }, [account, runSync]);

  const clear = useCallback(async () => {
    if (!account) return;
    abortRef.current?.abort();
    await clearFolio(account).catch(() => undefined);
    setRec(emptyRecord(account));
    setProgress(null);
    setSyncing(false);
  }, [account]);

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

  const ledger = useMemo(() => buildLedger(events, lookup?.priceAt), [events, lookup]);

  return {
    loaded,
    syncing,
    progress,
    error,
    events,
    ledger,
    syncedAt: rec?.syncedAt ?? null,
    transferCount,
    hasHistory: transferCount > 0,
    resync,
    rescan,
    clear,
  };
}
