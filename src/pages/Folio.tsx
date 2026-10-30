// CHEESEFolio — personal profit/loss for the signed-in WAX account.
// Intentionally not linked from the header yet: reachable at /folio only.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from '@/hooks/use-toast';
import { Layout } from '@/components/Layout';
import { OpenMojiIcon } from '@/components/OpenMojiIcon';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useWax } from '@/context/WaxContext';
import { useFolioCurrency } from '@/hooks/useFolioCurrency';
import { useFolioHoldings } from '@/hooks/useFolioHoldings';
import { useAlcorTokenPrices } from '@/hooks/useAlcorTokenPrices';
import { useWaxPrice } from '@/hooks/useWaxPrice';
import { useFolio } from '@/hooks/useFolio';
import { PortfolioControls, PortfolioTokenPicker } from '@/components/folio/PortfolioControls';
import { scopePortfolio } from '@/lib/folio/portfolios';
import { hasCoverageGap } from '@/lib/folio/scanner';
import type { HoldingRow } from '@/lib/folio/holdings';
import { downloadActivityCsv, downloadHoldingsCsv } from '@/lib/folio/csv';
import { ActivityList } from '@/components/folio/ActivityList';
import { HoldingsTable } from '@/components/folio/HoldingsTable';
import { PlChart } from '@/components/folio/PlChart';
import { SummaryBox } from '@/components/folio/SummaryBox';
import { TokenDialog } from '@/components/folio/TokenDialog';
import { money, usdFmt, waxFmt, type Currency } from '@/components/folio/format';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CRYPTO_CURRENCIES, FIAT_CURRENCIES, isCrypto, isFiat } from '@/lib/folio/fxCore';
import { playRandomFart } from '@/lib/fartSounds';
import walletOrb from '@/assets/wallet-icon.png';

const RANGES = [
  { key: '7d', label: '7D', days: 7 },
  { key: '30d', label: '30D', days: 30 },
  { key: '90d', label: '90D', days: 90 },
  { key: 'all', label: 'ALL', days: null },
] as const;

const Folio = () => {
  const { accountName, isConnected, login } = useWax();
  const queryClient = useQueryClient();
  const { mode, chosenCrypto, chosenFiat, activeCode, showCrypto, showFiat } = useFolioCurrency();
  const folio = useFolio(accountName, activeCode);
  const [selectedPortfolio, setSelectedPortfolio] = useState<string | null>(null);
  useEffect(() => { setSelectedPortfolio(null); setPicked(null); }, [accountName]);
  const currentPortfolio = folio.portfolios.find((p) => p.id === selectedPortfolio);
  const portfolioKeys = useMemo(() => currentPortfolio ? new Set(currentPortfolio.tokenKeys) : null, [currentPortfolio]);
  const scoped = useMemo(() => scopePortfolio(folio.ledger, folio.events, portfolioKeys), [folio.ledger, folio.events, portfolioKeys]);
  const importRef = useRef<HTMLInputElement>(null);
  const pickImport = () => importRef.current?.click();
  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const r = await folio.importFile(file);
      toast({
        title: 'History loaded',
        description: `Added ${r.added.toLocaleString()} new transfers (${r.alreadySaved.toLocaleString()} already saved). ${r.rec.portfolios?.length ?? 0} portfolios restored. Press Sync to fetch anything newer.`,
      });
    } catch (err) {
      toast({ title: 'Could not load this file', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
    }
  };
  const cryptoUnavailable = mode === 'CRYPTO' && chosenCrypto !== 'WAX' && folio.fxUnavailable;
  const fiat = folio.fiat;
  const cur: Currency = mode === 'CRYPTO' ? (chosenCrypto === 'WAX' || cryptoUnavailable ? 'WAX' : fiat) : fiat;
  const { data: priceMap, isFetching: pricesFetching, pricesUpdatedAt } = useAlcorTokenPrices(isConnected);
  const { data: waxUsdLive = 0, isFetching: waxPriceFetching } = useWaxPrice();
  const [refreshingPrices, setRefreshingPrices] = useState(false);
  const refreshPrices = async () => {
    setRefreshingPrices(true);
    try {
      await Promise.all(['swap-tokens', 'wax-price', 'folio-crypto-live', 'folio-realisable'].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] }),
      ));
    } finally { setRefreshingPrices(false); }
  };
  const syncNow = () => {
    void refreshPrices();
    void queryClient.invalidateQueries({ queryKey: ['all-token-balances', accountName] });
    void queryClient.invalidateQueries({ queryKey: ['folio-pooled', accountName] });
    folio.resync();
  };
  // Fiat per WAX right now: today's WAX/USD × today's fiat/USD (0 while unknown).
  const waxUsd = waxUsdLive && folio.fxNow ? waxUsdLive * folio.fxNow : 0;
  const [picked, setPicked] = useState<HoldingRow | null>(null);
  const [range, setRange] = useState<(typeof RANGES)[number]['key']>('all');
  const usd = cur !== 'WAX';
  const [showClosed, setShowClosed] = useState(false);

  const { allHoldings, holdings, totals, totalCost, realisable, pooled, pooledLoading, liveLoading } = useFolioHoldings({
    account: accountName, ledger: folio.ledger, scopedLedger: scoped.ledger, priceMap, waxRate: waxUsd, showClosed, portfolioKeys,
  });
  const portfolioPicker = useMemo(
    () => ({ portfolios: folio.portfolios, onSave: folio.savePortfolios, disabled: folio.syncing }),
    [folio.portfolios, folio.savePortfolios, folio.syncing],
  );
  const venueName: Record<string, string> = { alcor: 'Alcor', taco: 'Taco', defibox: 'Defibox' };

  // Cumulative realised profit/loss, one point per day with a sale.
  const plSeries = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const e of scoped.events) {
      const r = (usd ? scoped.ledger.realizedUsdByEvent : scoped.ledger.realizedByEvent).get(e.id);
      if (r == null) continue;
      const d = new Date(e.ts).toISOString().slice(0, 10);
      byDay.set(d, (byDay.get(d) ?? 0) + r);
    }
    let run = 0;
    const all = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, value: (run += v) }));
    const days = RANGES.find((r) => r.key === range)?.days;
    if (!days) return all;
    const from = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
    return all.filter((p) => p.date >= from);
  }, [scoped, range, usd]);

  const p = folio.progress;

  return (
    <Layout>
      <section className="relative pt-8 pb-6 md:pt-20 md:pb-14 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
        <div className="container relative z-10">
          <div className="flex flex-col items-center gap-8">
            <div className="h-20 w-20 md:h-32 md:w-32 animate-float cheese-bubble rounded-full flex items-center justify-center cursor-pointer" onClick={playRandomFart}>
              <img src={walletOrb} alt="CHEESEFolio" className="w-14 h-14 md:w-24 md:h-24 object-contain" />
            </div>
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center gap-2">
                <OpenMojiIcon emoji="💰" size={26} />
                <h1 className="text-3xl md:text-4xl font-bold">
                  <span className="text-cheese">CHEESE</span>
                  <span className="text-foreground">Folio</span>
                </h1>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cheese/20 text-cheese border border-cheese/30 leading-none">BETA</span>
                <OpenMojiIcon emoji="💰" size={26} />
              </div>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Your own WAX portfolio: what you paid, what it's worth now, and your profit or loss on every trade.
                Read automatically from the blockchain and saved only in this browser.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="container pb-12 flex flex-col items-center gap-6 max-w-screen-2xl">
        {!isConnected || !accountName ? (
          <div className="rounded-lg border border-cheese/20 bg-card/80 p-8 text-center space-y-4">
            <p className="text-muted-foreground">Connect your wallet to see your portfolio. CHEESEFolio only shows the account you're signed in with.</p>
            <Button onClick={() => void login()}>Connect wallet</Button>
          </div>
        ) : (
          <>
            <div className="w-full flex flex-wrap items-center justify-between gap-2 text-sm">
              <div className="text-muted-foreground">
                {folio.syncing ? (
                  folio.hasHistory && folio.syncedAt ? 'Checking for new transactions…' : `Scanning history for ${accountName}…`
                ) : !folio.loaded ? (
                  'Loading saved history…'
                ) : folio.syncedAt && !folio.partial ? (
                  `Up to date · last checked ${new Date(folio.syncedAt).toLocaleTimeString()} · ${folio.transferCount.toLocaleString()} transfers saved in this browser`
                ) : (
                  folio.hasHistory ? 'History incomplete — press Continue scan to pick up where it stopped' : 'No history scanned yet'
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {folio.syncing ? (
                  <Button size="sm" variant="outline" onClick={folio.stop}>Stop scan</Button>
                ) : (
                  <Button size="sm" disabled={!folio.loaded} onClick={syncNow}>
                    {(folio.error || folio.partial) && folio.hasHistory ? 'Continue scan' : folio.syncedAt ? 'Sync now' : folio.hasHistory ? 'Continue scan' : 'Scan my history'}
                  </Button>
                )}
                <Button size="sm" variant="outline" disabled={!holdings.length} onClick={() => downloadHoldingsCsv(accountName, fiat, holdings.map((h) => ({
                  symbol: h.symbol, contract: h.contract, balance: h.balance, walletBalance: h.walletBalance, pooledBalance: h.pooledBalance, avgCostWax: h.avgCostWax, priceWax: h.priceWax,
                  valueWax: h.valueWax, unrealizedWax: h.unrealizedWax, realizedWax: h.realizedWax, complete: h.complete,
                  avgCostUsd: h.avgCostUsd, valueUsd: h.valueUsd, unrealizedUsd: h.unrealizedUsd, realizedUsd: h.realizedUsd,
                  realisableWax: h.key === 'eosio.token:WAX' ? h.balance : realisable?.get(h.key)?.wax ?? null,
                })))}>Holdings CSV</Button>
                <Button size="sm" variant="outline" disabled={!scoped.events.length} onClick={() => downloadActivityCsv(accountName, scoped.events, scoped.ledger.valueByEvent, scoped.ledger.realizedByEvent, scoped.ledger.valueUsdByEvent, scoped.ledger.realizedUsdByEvent, fiat)}>Activity CSV</Button>
                <Button size="sm" variant="outline" disabled={!folio.loaded || (!folio.hasHistory && !folio.portfolios.length)} onClick={() => void folio.exportFile().catch((e) => toast({ title: 'Could not save file', description: e instanceof Error ? e.message : 'Please try again.', variant: 'destructive' }))}>Save history & portfolios (JSON)</Button>
                <Button size="sm" variant="outline" disabled={!folio.loaded} onClick={pickImport}>Load history (JSON)</Button>
                <input ref={importRef} type="file" accept=".json,application/json" className="hidden" onChange={onImport} />
                <Button size="sm" variant="outline" onClick={() => { if (confirm('Delete the saved history and scan again from the start?')) void folio.rescan(); }}>Rescan from scratch</Button>
                <Button size="sm" variant="ghost" onClick={() => { if (confirm('Delete everything CHEESEFolio saved in this browser for this account?')) void folio.clear(); }}>Clear saved data</Button>
              </div>
            </div>

            {folio.syncing ? (
              <div className="w-full space-y-1">
                <Progress
                  value={
                    !p || p.phase === 'probing' ? 3
                      : p.phase === 'fills' && p.fillsTotal ? 60 + ((p.fillsDone ?? 0) / p.fillsTotal) * 40
                      : p.phase === 'done' ? 100
                      : 5 + (p.providers ? (p.providersDone / p.providers) * 55 : 0)
                  }
                />
                <div className="text-xs text-muted-foreground text-center">
                  {!p || p.phase === 'probing'
                    ? 'Finding history services that answer from your browser…'
                    : p.phase === 'fills'
                      ? `Matching order-book fills ${(p.fillsDone ?? 0).toLocaleString()} / ${(p.fillsTotal ?? 0).toLocaleString()}`
                      : `${p.transfers.toLocaleString()} transfers found${p.reachedTs ? ` · reached ${new Date(p.reachedTs).toISOString().slice(0, 10)}` : ''} · ${p.providersDone}/${p.providers} services finished`}
                  {' · '}You can stop or leave — progress is saved and continues next time.
                </div>
              </div>
            ) : !folio.hasHistory && folio.loaded ? (
              <div className="w-full rounded-lg border border-cheese/20 bg-card/80 p-6 text-center space-y-3">
                <p className="text-muted-foreground">Press <span className="text-foreground font-medium">Scan my history</span> to read your past trades from the blockchain. It only runs when you ask, and the result is saved in this browser.</p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button onClick={syncNow}>Scan my history</Button>
                  <Button variant="outline" onClick={pickImport}>Load saved history (JSON)</Button>
                </div>
                <p className="text-xs text-muted-foreground">Saved a history file before? Load it to skip the full scan — Sync then fetches only newer transfers.</p>
              </div>
            ) : null}
            {!folio.syncing && hasCoverageGap(folio.coverageFrom, folio.accountCreated) ? (
              <div className="w-full rounded-lg border border-cheese/30 bg-card/80 p-3 text-sm text-center text-muted-foreground">
                History available from {new Date(folio.coverageFrom!).toISOString().slice(0, 10)}, but this account was created {new Date(folio.accountCreated!).toISOString().slice(0, 10)}.
                No history service answering right now reaches further back, so profit/loss for older holdings can't be checked yet. Try Sync now later.
              </div>
            ) : null}
            {folio.error ? <div className="w-full text-sm text-destructive text-center">{folio.error}</div> : null}

            <PortfolioControls key={accountName} portfolios={folio.portfolios} selected={currentPortfolio?.id ?? null} onSelect={(id) => { setSelectedPortfolio(id); setPicked(null); }} onSave={folio.savePortfolios} rows={allHoldings} disabled={!folio.loaded || folio.syncing} />

            <div className="w-full flex flex-wrap items-center justify-center gap-2">
              <Select value={chosenCrypto} onValueChange={(v) => (v === 'WAX' || isCrypto(v)) && showCrypto(v)}>
                <SelectTrigger
                  aria-label="Show in crypto"
                  className={`h-9 md:h-7 w-auto gap-1 text-xs ${mode === 'CRYPTO' ? 'bg-primary text-primary-foreground border-primary' : 'opacity-60'}`}
                  onClick={() => { if (mode !== 'CRYPTO') showCrypto(chosenCrypto); }}
                >
                  <SelectValue>Show in {chosenCrypto}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WAX" className="text-xs">WAX · WAX</SelectItem>
                  {CRYPTO_CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code} className="text-xs">{c.code} · {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={chosenFiat} onValueChange={(v) => isFiat(v) && showFiat(v)}>
                <SelectTrigger
                  aria-label="Show in fiat currency"
                  className={`h-9 md:h-7 w-auto gap-1 text-xs ${mode === 'FIAT' ? 'bg-primary text-primary-foreground border-primary' : 'opacity-60'}`}
                  onClick={() => { if (mode !== 'FIAT') showFiat(chosenFiat); }}
                >
                  <SelectValue>Show in {chosenFiat}</SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {FIAT_CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code} className="text-xs">{c.code} · {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1 text-xs text-muted-foreground" role="status">
                <span>{pricesFetching || waxPriceFetching || refreshingPrices ? 'Updating prices…'
                  : pricesUpdatedAt ? `Prices updated ${new Date(pricesUpdatedAt).toLocaleTimeString()}`
                  : priceMap?.size ? 'Cached prices · awaiting update' : 'Live prices unavailable'}</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-10 w-10" aria-label="Refresh prices"
                      disabled={!!pricesFetching || !!waxPriceFetching || refreshingPrices} onClick={() => void refreshPrices()}>
                      <RefreshCw className={`h-4 w-4 ${pricesFetching || waxPriceFetching || refreshingPrices ? 'animate-spin' : ''}`} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Refresh prices</TooltipContent>
                </Tooltip>
              </div>
            </div>
            {cryptoUnavailable ? (
              <div className="w-full text-xs text-destructive text-center">{chosenCrypto} price history couldn't be loaded right now, so figures are shown in WAX. Refresh to try again.</div>
            ) : folio.fxUnavailable ? (
              <div className="w-full text-xs text-destructive text-center">Exchange rates for {chosenFiat} couldn't be loaded right now, so figures are shown in USD. Refresh to try again.</div>
            ) : null}
            <div className="w-full grid grid-cols-2 lg:grid-cols-5 gap-2 md:gap-3">
              <SummaryBox
                label="Total cost"
                value={usd ? money(totalCost.usd, cur) : waxFmt(totalCost.wax)}
                sub={(usd ? totalCost.partialUsd : totalCost.partialWax)
                  ? (usd ? totalCost.usd : totalCost.wax) == null ? 'Cost unavailable' : 'Partial · known costs only'
                  : usd ? waxFmt(totalCost.wax) : usdFmt(totalCost.wax, waxUsd, fiat)}
              />
              <SummaryBox label="Paper value" value={usd ? money(totals.valueUsd, cur) : waxFmt(totals.value)} sub={(usd ? totals.valueUsdPartial : totals.valuePartial) ? 'Partial · priced tokens only' : usd ? waxFmt(totals.value) : usdFmt(totals.value, waxUsd, fiat)} />
              <SummaryBox
                label="Realisable now"
                value={totals.realisableWax == null ? '…' : usd ? money(waxUsd ? totals.realisableWax * waxUsd : null, cur) : waxFmt(totals.realisableWax)}
                sub={totals.realisableWax != null && totals.value != null && totals.value > 0 ? `${totals.realisableWax >= totals.value ? '+' : ''}${(((totals.realisableWax - totals.value) / totals.value) * 100).toFixed(2)}% vs paper` : 'selling everything on Alcor now'}
                subTone={totals.realisableWax != null && totals.value != null && totals.value > 0 ? ((totals.realisableWax - totals.value) / totals.value) * 100 : null}
              />
              <SummaryBox label="Unrealised P/L" value={usd ? money(totals.unrealizedUsd, cur) : waxFmt(totals.unrealized)} sub={(usd ? totals.unrealizedUsdPartial : totals.unrealizedPartial) ? 'Partial · costed tokens only' : usd ? undefined : usdFmt(totals.unrealized, waxUsd, fiat)} tone={usd ? totals.unrealizedUsd : totals.unrealized} />
              <SummaryBox label="Realised P/L" value={usd ? money(totals.realizedUsd, cur) : waxFmt(totals.realized)} sub={usd ? undefined : usdFmt(totals.realized, waxUsd, fiat)} tone={usd ? totals.realizedUsd : totals.realized} />
            </div>
            <p className="w-full text-xs text-muted-foreground text-center">
              {usd
                ? isCrypto(fiat)
                  ? `${fiat} profit/loss uses the WAX/USD and ${fiat}/USD prices on the day of each trade, so it shows whether you beat simply holding ${fiat}.`
                  : `${fiat} profit/loss uses the WAX/USD rate and the USD/${fiat} exchange rate on the day of each trade, so it includes WAX's and ${fiat}'s own price moves.`
                : `Profit/loss is measured in WAX using the average price you paid. ${fiat} figures under WAX amounts use today's rates.`}
              {' '}Rewards, airdrops, pool fees and tokens sent to you count as free (zero cost).
              Balances include tokens you have in Alcor, Taco and Defibox pools (uncollected pool fees are not counted).
              Paper value is amount × price; realisable is what selling each whole balance on Alcor would return right now.
              {usd && !folio.usdHistoryLoaded && folio.hasHistory ? ` Past WAX/${fiat} rates are still loading or unavailable.` : ''}
            </p>

            <div className="w-full space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 max-w-full flex-wrap items-center gap-3">
                  <h2 className="max-w-full text-lg font-semibold break-words">{currentPortfolio?.name ?? 'Holdings'}</h2>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                    <input type="checkbox" className="accent-primary" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />
                    Show closed positions
                  </label>
                </div>
                {liveLoading ? <span className="text-xs text-muted-foreground">Loading balances…</span>
                  : pooledLoading && !pooled ? <span className="text-xs text-muted-foreground">Reading your pool positions…</span> : null}
              </div>
              {pooled?.failed.length ? (
                <div className="text-xs text-destructive">
                  Couldn't read your {pooled.failed.map((v) => venueName[v] ?? v).join(' and ')} pool positions right now, so tokens there are left out. Refresh to try again.
                </div>
              ) : null}
              <HoldingsTable rows={holdings} events={folio.events} waxUsd={waxUsd} cur={cur} fiat={fiat} realisable={realisable} onPick={setPicked} portfolio={portfolioPicker} />
            </div>

            <div className="w-full space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Realised profit/loss over time</h2>
                <div className="flex gap-1">
                  {RANGES.map((r) => (
                    <Button key={r.key} size="sm" variant={range === r.key ? 'default' : 'outline'} className="h-9 md:h-7 text-xs" onClick={() => setRange(r.key)}>{r.label}</Button>
                  ))}
                </div>
              </div>
              <PlChart data={plSeries} title={`Realised P/L (${cur})`} cur={cur} />
            </div>

            <div className="w-full space-y-2">
              <h2 className="text-lg font-semibold">Activity</h2>
              <ActivityList key={currentPortfolio?.id ?? 'all'} events={scoped.events} value={usd ? scoped.ledger.valueUsdByEvent : scoped.ledger.valueByEvent} realized={usd ? scoped.ledger.realizedUsdByEvent : scoped.ledger.realizedByEvent} cur={cur} />
            </div>

            <TokenDialog
              row={picked ? allHoldings.find((h) => h.key === picked.key) ?? picked : null}
              events={folio.events}
              value={usd ? folio.ledger.valueUsdByEvent : folio.ledger.valueByEvent}
              realized={usd ? folio.ledger.realizedUsdByEvent : folio.ledger.realizedByEvent}
              waxUsd={waxUsd}
              cur={cur}
              fiat={fiat}
              realisable={picked ? realisable?.get(picked.key) ?? (picked.key === 'eosio.token:WAX' ? { wax: picked.balance, gapPct: 0 } : null) : null}
              onClose={() => setPicked(null)}
            />
          </>
        )}
      </div>
    </Layout>
  );
};

export default Folio;
