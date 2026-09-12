// CHEESEAnal — analytics for the CHEESE liquidity pools on Alcor, Taco and Defibox.
// Intentionally not linked from the header yet: reachable at /anal only.
import { useMemo, useState } from 'react';
import { Layout } from '@/components/Layout';
import { OpenMojiIcon } from '@/components/OpenMojiIcon';
import { Button } from '@/components/ui/button';
import { AnalAccountPanel } from '@/components/anal/AnalAccountPanel';
import { AnalOverview } from '@/components/anal/AnalOverview';
import { AnalPoolDetail } from '@/components/anal/AnalPoolDetail';
import { AnalPoolTable } from '@/components/anal/AnalPoolTable';
import { AllVenueLogos, VenueLogo } from '@/components/anal/VenueLogo';
import {
  LP_RANGES,
  filterDaysByVenue,
  filterSnapshotByVenue,
  sliceDays,
  useLiveLpSnapshot,
  useLpDay,
  useLpHistoryIndex,
  type LpRange,
} from '@/hooks/useLpHistory';
import { downloadSnapshotCsv } from '@/lib/lpCsv';
import { LP_VENUES, LP_VENUE_LABELS, type LpVenue } from '@/lib/lpPools';
import { playRandomFart } from '@/lib/fartSounds';
import cheeseAnalOrb from '@/assets/cheeseanal.png';

const VENUE_TABS: { key: LpVenue | 'all'; label: string }[] = [
  { key: 'all', label: 'All venues' },
  ...LP_VENUES.map((v) => ({ key: v, label: LP_VENUE_LABELS[v] })),
];

const CheeseAnal = () => {
  const [range, setRange] = useState<LpRange>('all');
  const [venue, setVenue] = useState<LpVenue | 'all'>('all');
  const [poolKey, setPoolKey] = useState<string | null>(null);
  const [account, setAccount] = useState<string | null>(null);

  const { days, updatedAt, isEmpty, isLoading: historyLoading, isError: historyError } = useLpHistoryIndex();
  const { snapshot: live, failed, isError: liveError, refetch: refetchLive } = useLiveLpSnapshot();

  const latestRecordedDate = days.length ? days[days.length - 1].date : null;
  // Value boxes read the latest recorded snapshot so they always match the
  // rightmost graph point; the live read is only a fallback before the first
  // snapshot exists.
  const { day: latestDay, isLoading: latestDayLoading, refetch: refetchDay } = useLpDay(latestRecordedDate);

  const snapshot = latestDay ?? live;
  const current = useMemo(() => filterSnapshotByVenue(snapshot, venue), [snapshot, venue]);
  const ranged = useMemo(
    () => filterDaysByVenue(sliceDays(days, range), venue),
    [days, range, venue],
  );
  const dates = useMemo(() => ranged.map((d) => d.date), [ranged]);
  // Fall back to the biggest pool so a venue switch never leaves an empty panel.
  const selectedPool = useMemo(() => {
    const pools = current?.pools ?? [];
    return pools.find((p) => p.key === poolKey) ?? [...pools].sort((a, b) => b.usd - a.usd)[0] ?? null;
  }, [current, poolKey]);

  const venueCounts = useMemo(() => {
    const counts = new Map<LpVenue | 'all', number>([['all', snapshot?.pools.length ?? 0]]);
    for (const v of LP_VENUES) counts.set(v, (snapshot?.pools ?? []).filter((p) => p.venue === v).length);
    return counts;
  }, [snapshot]);

  return (
    <Layout>
      <section className="relative pt-20 pb-14 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
        <div className="container relative z-10">
          <div className="flex flex-col items-center gap-8">
            <div
              className="h-32 w-32 animate-float cheese-bubble rounded-full flex items-center justify-center cursor-pointer"
              onClick={playRandomFart}
            >
              <img src={cheeseAnalOrb} alt="CHEESEAnal" className="w-24 h-24 object-contain" />
            </div>

            <div className="text-center space-y-4">
              <div className="flex items-center justify-center gap-2">
                <OpenMojiIcon emoji="📈" size={26} />
                <h1 className="text-3xl md:text-4xl font-bold">
                  <span className="text-cheese">CHEESE</span>
                  <span className="text-foreground">Anal</span>
                </h1>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cheese/20 text-cheese border border-cheese/30 leading-none">
                  BETA
                </span>
                <OpenMojiIcon emoji="📈" size={26} />
              </div>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Twice-daily snapshots of every $CHEESE liquidity pool on Alcor, Taco and Defibox — pool value, token
                balances, CHEESE price, provider counts and per-account positions, tracked over time
              </p>
            </div>
          </div>
        </div>
      </section>

      <main className="container pb-12 flex flex-col items-center gap-6">
        {/* Range switch + exports */}
        <div className="w-full flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            {LP_RANGES.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setRange(tab.key)}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide transition-colors ${
                  range === tab.key ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">
              {days.length} day{days.length === 1 ? '' : 's'} recorded
              {updatedAt ? ` · last ${new Date(updatedAt).toLocaleDateString()}` : ''}
            </span>
            <Button size="sm" variant="ghost" onClick={() => refetch()}>
              Refresh
            </Button>
            <Button size="sm" variant="outline" disabled={!current} onClick={() => current && downloadSnapshotCsv(current)}>
              Snapshot CSV
            </Button>
          </div>
        </div>

        {/* Venue filter */}
        <div className="w-full flex flex-wrap items-center gap-1">
          {VENUE_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setVenue(tab.key)}
              aria-pressed={venue === tab.key}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide border transition-colors ${
                venue === tab.key
                  ? 'bg-cheese/15 text-cheese border-cheese/40'
                  : 'text-muted-foreground border-border/40 hover:text-foreground hover:border-primary/40'
              }`}
            >
              {tab.key === 'all' ? <AllVenueLogos /> : <VenueLogo venue={tab.key} />}
              {tab.label}
              <span className="ml-1 text-[10px] opacity-70">{venueCounts.get(tab.key) ?? 0}</span>
            </button>
          ))}
        </div>

        {liveError && !current && (
          <p className="w-full text-xs text-red-400">
            Live pool data is temporarily unavailable — showing recorded snapshots only.
          </p>
        )}
        {historyError && (
          <p className="w-full text-xs text-red-400">Recorded history could not be loaded right now.</p>
        )}

        <AnalOverview days={ranged} current={current} historyLoading={historyLoading} historyEmpty={isEmpty} />

        <AnalPoolTable
          current={current}
          days={ranged}
          selectedKey={poolKey}
          onSelect={setPoolKey}
          failed={failed}
          isLoading={liveLoading}
        />

        <AnalPoolDetail
          pool={selectedPool}
          days={ranged}
          current={current}
          onSelectAccount={(name) => setAccount(name)}
        />

        <AnalAccountPanel account={account} onAccountChange={setAccount} dates={dates} current={current} />

        <p className="text-[10px] text-muted-foreground text-center max-w-2xl">
          Alcor figures come from Alcor's own position data: open positions count whether or not they are in range,
          valued at their current USD value. Taco and Defibox are constant-product pools, so each provider's share of
          the pool is worked out from their LP tokens and valued at market prices. Every tracked pair is recorded on
          each venue, plus any other CHEESE pair holding more than $100. Headline figures are live; charts are built
          from one recorded snapshot per day.
        </p>
      </main>
    </Layout>
  );
};

export default CheeseAnal;
