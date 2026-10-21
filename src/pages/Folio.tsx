// CHEESEFolio — personal profit/loss for the signed-in WAX account.
// Intentionally not linked from the header yet: reachable at /folio only.
import { useMemo, useRef, useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { Layout } from '@/components/Layout';
import { OpenMojiIcon } from '@/components/OpenMojiIcon';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useWax } from '@/context/WaxContext';
import { useAllTokenBalances } from '@/hooks/useAllTokenBalances';
import { useAlcorTokenPrices } from '@/hooks/useAlcorTokenPrices';
import { useWaxPrice } from '@/hooks/useWaxPrice';
import { useFolio } from '@/hooks/useFolio';
import { usePooledTokens } from '@/hooks/usePooledTokens';
import { hasCoverageGap } from '@/lib/folio/scanner';
import { buildHoldings, type HoldingRow } from '@/lib/folio/holdings';
import { downloadActivityCsv, downloadHoldingsCsv } from '@/lib/folio/csv';
import { ActivityList, HoldingsTable, money, PlChart, SummaryBox, TokenDialog, usdFmt, waxFmt, type Currency } from '@/components/folio/FolioParts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CRYPTO_CURRENCIES, FIAT_CURRENCIES, isCrypto, isFiat, type CryptoCode, type DisplayCode, type FiatCode } from '@/lib/folio/fxCore';
import { useRealisableValues } from '@/hooks/useRealisableValues';
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
  // Two pickers: crypto (WAX/BTC/ETH) or fiat; only one is active. Stored as one code.
  type CryptoChoice = 'WAX' | CryptoCode;
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('cheesefolio-currency') ?? '' : '';
  const [mode, setMode] = useState<'CRYPTO' | 'FIAT'>(() => (!stored || stored === 'WAX' || isCrypto(stored) ? 'CRYPTO' : 'FIAT'));
  const [chosenCrypto, setChosenCrypto] = useState<CryptoChoice>(() => (isCrypto(stored) ? stored : 'WAX'));
  const [chosenFiat, setChosenFiat] = useState<FiatCode>(() => {
    if (typeof localStorage === 'undefined') return 'USD';
    const f = localStorage.getItem('cheesefolio-fiat') ?? stored;
    return isFiat(f) ? f : 'USD';
  });
  const activeCode: DisplayCode = mode === 'CRYPTO' && chosenCrypto !== 'WAX' ? chosenCrypto : chosenFiat;
  const folio = useFolio(accountName, activeCode);
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
        description: `Added ${r.added.toLocaleString()} new transfers (${r.alreadySaved.toLocaleString()} already saved). Press Sync to fetch anything newer.`,
      });
    } catch (err) {
      toast({ title: 'Could not load this file', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
    }
  };
  const cryptoUnavailable = mode === 'CRYPTO' && chosenCrypto !== 'WAX' && folio.fxUnavailable;
  const fiat = folio.fiat;
  const cur: Currency = mode === 'CRYPTO' ? (chosenCrypto === 'WAX' || cryptoUnavailable ? 'WAX' : fiat) : fiat;
  const showCrypto = (c: CryptoChoice) => {
    setMode('CRYPTO');
    setChosenCrypto(c);
    try { localStorage.setItem('cheesefolio-currency', c); } catch { /* private mode */ }
  };
  const showFiat = (f: FiatCode) => {
    setMode('FIAT');
    setChosenFiat(f);
    try { localStorage.setItem('cheesefolio-currency', f); localStorage.setItem('cheesefolio-fiat', f); } catch { /* private mode */ }
  };
  const { tokens: live, isLoading: liveLoading } = useAllTokenBalances(accountName ?? undefined);
  const { data: priceMap } = useAlcorTokenPrices();
  const { data: waxUsdLive = 0 } = useWaxPrice();
  // Fiat per WAX right now: today's WAX/USD × today's fiat/USD (0 while unknown).
  const waxUsd = waxUsdLive && folio.fxNow ? waxUsdLive * folio.fxNow : 0;
  const [picked, setPicked] = useState<HoldingRow | null>(null);
  const [range, setRange] = useState<(typeof RANGES)[number]['key']>('all');
  const usd = cur !== 'WAX';
  const [showClosed, setShowClosed] = useState(false);

  const shares = useMemo(
    () => live.filter((t) => t.isLpToken).map((t) => ({ contract: t.contract, symbol: t.symbol, balance: t.balance })),
    [live],
  );
  const { data: pooled, isFetching: pooledLoading } = usePooledTokens(accountName, shares, !liveLoading);
  const holdings = useMemo(
    () =>
      buildHoldings(
        folio.ledger.positions,
        live.filter((t) => !t.isLpToken).map((t) => ({
          key: `${t.contract}:${t.symbol}`, contract: t.contract, symbol: t.symbol, precision: t.precision, balance: t.balance,
        })),
        (key) => priceMap?.get(key) ?? null,
        waxUsd,
        pooled ?? null,
        showClosed,
      ),
    [folio.ledger, live, priceMap, waxUsd, pooled, showClosed],
  );
  const venueName: Record<string, string> = { alcor: 'Alcor', taco: 'Taco', defibox: 'Defibox' };
  const { data: realisable } = useRealisableValues(holdings, accountName);

  const totals = useMemo(() => {
    let value = 0, unrealized = 0, realized = 0, valueUsd = 0, unrealizedUsd = 0, realizedUsd = 0, realisableWax = 0, realisableKnown = true;
    for (const h of holdings) {
      value += h.valueWax ?? 0;
      unrealized += h.unrealizedWax ?? 0;
      valueUsd += h.valueUsd ?? 0;
      unrealizedUsd += h.unrealizedUsd ?? 0;
      if (h.key === 'eosio.token:WAX') realisableWax += h.balance;
      else if ((h.valueWax ?? 0) < 1) realisableWax += h.valueWax ?? 0;
      else {
        const r = realisable?.get(h.key)?.wax;
        if (r == null) realisableKnown = false;
        else realisableWax += r;
      }
    }
    for (const p of folio.ledger.positions.values()) {
      realized += p.realizedWax;
      realizedUsd += p.realizedUsd;
    }
    return { value, unrealized, realized, valueUsd, unrealizedUsd, realizedUsd, realisableWax: realisable && realisableKnown ? realisableWax : null };
  }, [holdings, folio.ledger, realisable]);

  // Cumulative realised profit/loss, one point per day with a sale.
  const plSeries = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const e of folio.events) {
      const r = (usd ? folio.ledger.realizedUsdByEvent : folio.ledger.realizedByEvent).get(e.id);
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
  }, [folio.events, folio.ledger, range, usd]);

  const p = folio.progress;

  return (
    <Layout>
      <section className="relative pt-20 pb-14 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
        <div className="container relative z-10">
          <div className="flex flex-col items-center gap-8">
            <div className="h-32 w-32 animate-float cheese-bubble rounded-full flex items-center justify-center cursor-pointer" onClick={playRandomFart}>
              <img src={walletOrb} alt="CHEESEFolio" className="w-24 h-24 object-contain" />
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
                ) : folio.syncedAt ? (
                  `Up to date · last checked ${new Date(folio.syncedAt).toLocaleTimeString()} · ${folio.transferCount.toLocaleString()} transfers saved in this browser`
                ) : (
                  folio.hasHistory ? 'Scan paused — press Continue scan to pick up where it stopped' : 'No history scanned yet'
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {folio.syncing ? (
                  <Button size="sm" variant="outline" onClick={folio.stop}>Stop scan</Button>
                ) : (
                  <Button size="sm" disabled={!folio.loaded} onClick={folio.resync}>
                    {folio.error && folio.hasHistory ? 'Continue scan' : folio.syncedAt ? 'Sync now' : folio.hasHistory ? 'Continue scan' : 'Scan my history'}
                  </Button>
                )}
                <Button size="sm" variant="outline" disabled={!holdings.length} onClick={() => downloadHoldingsCsv(accountName, fiat, holdings.map((h) => ({
                  symbol: h.symbol, contract: h.contract, balance: h.balance, walletBalance: h.walletBalance, pooledBalance: h.pooledBalance, avgCostWax: h.avgCostWax, priceWax: h.priceWax ?? 0,
                  valueWax: h.valueWax ?? 0, unrealizedWax: h.unrealizedWax, realizedWax: h.realizedWax, complete: h.complete,
                  avgCostUsd: h.avgCostUsd, valueUsd: h.valueUsd, unrealizedUsd: h.unrealizedUsd, realizedUsd: h.realizedUsd,
                  realisableWax: h.key === 'eosio.token:WAX' ? h.balance : realisable?.get(h.key)?.wax ?? null,
                })))}>Holdings CSV</Button>
                <Button size="sm" variant="outline" disabled={!folio.events.length} onClick={() => downloadActivityCsv(accountName, folio.events, folio.ledger.valueByEvent, folio.ledger.realizedByEvent, folio.ledger.valueUsdByEvent, folio.ledger.realizedUsdByEvent, fiat)}>Activity CSV</Button>
                <Button size="sm" variant="outline" disabled={!folio.hasHistory} onClick={() => void folio.exportFile()}>Save history (JSON)</Button>
                <Button size="sm" variant="outline" disabled={!folio.loaded} onClick={pickImport}>Load history (JSON)</Button>
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
                  <Button onClick={folio.resync}>Scan my history</Button>
                  <Button variant="outline" onClick={pickImport}>Load saved history (JSON)</Button>
                </div>
                <p className="text-xs text-muted-foreground">Saved a history file before? Load it to skip the full scan — Sync then fetches only newer transfers.</p>
                <input ref={importRef} type="file" accept=".json,application/json" className="hidden" onChange={onImport} />
              </div>
            ) : null}
            {!folio.syncing && hasCoverageGap(folio.coverageFrom, folio.accountCreated) ? (
              <div className="w-full rounded-lg border border-cheese/30 bg-card/80 p-3 text-sm text-center text-muted-foreground">
                History available from {new Date(folio.coverageFrom!).toISOString().slice(0, 10)}, but this account was created {new Date(folio.accountCreated!).toISOString().slice(0, 10)}.
                No history service answering right now reaches further back, so profit/loss for older holdings can't be checked yet. Try Sync now later.
              </div>
            ) : null}
            {folio.error ? <div className="w-full text-sm text-destructive text-center">{folio.error}</div> : null}

            <div className="w-full flex justify-center gap-1">
              <Select value={chosenCrypto} onValueChange={(v) => (v === 'WAX' || isCrypto(v)) && showCrypto(v)}>
                <SelectTrigger
                  aria-label="Show in crypto"
                  className={`h-7 w-auto gap-1 text-xs ${mode === 'CRYPTO' ? 'bg-primary text-primary-foreground border-primary' : 'opacity-60'}`}
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
                  className={`h-7 w-auto gap-1 text-xs ${mode === 'FIAT' ? 'bg-primary text-primary-foreground border-primary' : 'opacity-60'}`}
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
            </div>
            {cryptoUnavailable ? (
              <div className="w-full text-xs text-destructive text-center">{chosenCrypto} price history couldn't be loaded right now, so figures are shown in WAX. Refresh to try again.</div>
            ) : folio.fxUnavailable ? (
              <div className="w-full text-xs text-destructive text-center">Exchange rates for {chosenFiat} couldn't be loaded right now, so figures are shown in USD. Refresh to try again.</div>
            ) : null}
            <div className="w-full flex flex-wrap gap-3">
              <SummaryBox label="Paper value" value={usd ? money(totals.valueUsd, cur) : waxFmt(totals.value)} sub={usd ? waxFmt(totals.value) : usdFmt(totals.value, waxUsd, fiat)} />
              <SummaryBox
                label="Realisable now"
                value={totals.realisableWax == null ? '…' : usd ? money(waxUsd ? totals.realisableWax * waxUsd : null, cur) : waxFmt(totals.realisableWax)}
                sub={totals.realisableWax != null && totals.value > 0 ? `${totals.realisableWax >= totals.value ? '+' : ''}${(((totals.realisableWax - totals.value) / totals.value) * 100).toFixed(2)}% vs paper` : 'selling everything on Alcor now'}
                subTone={totals.realisableWax != null && totals.value > 0 ? ((totals.realisableWax - totals.value) / totals.value) * 100 : null}
              />
              <SummaryBox label="Unrealised P/L" value={usd ? money(totals.unrealizedUsd, cur) : waxFmt(totals.unrealized)} sub={usd ? undefined : usdFmt(totals.unrealized, waxUsd, fiat)} tone={usd ? totals.unrealizedUsd : totals.unrealized} />
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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold">Holdings</h2>
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
              <HoldingsTable rows={holdings} events={folio.events} waxUsd={waxUsd} cur={cur} fiat={fiat} realisable={realisable} onPick={setPicked} />
            </div>

            <div className="w-full space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Realised profit/loss over time</h2>
                <div className="flex gap-1">
                  {RANGES.map((r) => (
                    <Button key={r.key} size="sm" variant={range === r.key ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => setRange(r.key)}>{r.label}</Button>
                  ))}
                </div>
              </div>
              <PlChart data={plSeries} title={`Realised P/L (${cur})`} cur={cur} />
            </div>

            <div className="w-full space-y-2">
              <h2 className="text-lg font-semibold">Activity</h2>
              <ActivityList events={folio.events} value={usd ? folio.ledger.valueUsdByEvent : folio.ledger.valueByEvent} realized={usd ? folio.ledger.realizedUsdByEvent : folio.ledger.realizedByEvent} cur={cur} />
            </div>

            <TokenDialog
              row={picked}
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
