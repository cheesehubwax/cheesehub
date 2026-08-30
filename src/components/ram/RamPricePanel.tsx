import { useMemo, useState } from 'react';
import { AreaChart, Area, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import { OpenMojiIcon } from '@/components/OpenMojiIcon';
import type { RamPricePoint } from '@/hooks/useCheeseRam';
import {
  RAM_HISTORY_RANGES,
  sliceRange,
  useRamPriceHistory,
  type RamHistoryRange,
} from '@/hooks/useRamPriceHistory';

interface RamPricePanelProps {
  cheesePerKb: number | null;
  pricePerByte: number | null;
  history: RamPricePoint[];
}

type ChartPoint = { time: number; waxPerKb: number; cheesePerKb: number | null };
type RangeKey = 'live' | RamHistoryRange;

const formatStamp = (time: number, range: RangeKey) =>
  range === 'live' || range === '24h'
    ? new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : new Date(time).toLocaleDateString([], { day: 'numeric', month: 'short' });

export function RamPricePanel({ cheesePerKb, pricePerByte, history }: RamPricePanelProps) {
  const [range, setRange] = useState<RangeKey>('live');
  const { records, firstSampleAt, isLoading: historyLoading } = useRamPriceHistory();

  const chartData = useMemo<ChartPoint[]>(() => {
    if (range === 'live') {
      return history
        .filter((point) => point.cheesePerKb !== null)
        .map((point) => ({
          time: point.time,
          waxPerKb: point.waxPerKb,
          cheesePerKb: point.cheesePerKb,
        }));
    }
    return sliceRange(records, range).map((record) => ({
      time: record.t,
      waxPerKb: record.waxPerKb,
      cheesePerKb: record.cheesePerKb,
    }));
  }, [range, history, records]);

  const hasChart = chartData.length >= 2;
  const emptyMessage =
    range === 'live'
      ? 'Building price history...'
      : historyLoading
        ? 'Loading history...'
        : 'Collecting history — recorded twice daily.';

  const footer =
    range === 'live'
      ? 'Updates every 30s • Session data only'
      : firstSampleAt
        ? `Recorded twice daily since ${new Date(firstSampleAt).toLocaleDateString([], {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}`
        : 'Recorded twice daily';


  const renderTooltip = (decimals: number, unit: string, textClass: string) =>
    ({ active, payload }: { active?: boolean; payload?: { value?: unknown; payload?: ChartPoint }[] }) =>
      active && payload?.length ? (
        <div className="bg-background/95 border border-border px-2 py-1 rounded text-xs font-mono">
          <span className={textClass}>
            {(payload[0].value as number).toFixed(decimals)} {unit}
          </span>
          {payload[0].payload && (
            <span className="text-muted-foreground ml-1.5">
              {formatStamp(payload[0].payload.time, range)}
            </span>
          )}
        </div>
      ) : null;

  return (
    <div className="rounded-xl p-4 max-w-lg w-full bg-card border border-border/50">
      <div className="flex items-center gap-2 mb-3">
        <OpenMojiIcon emoji="📈" size={18} />
        <span className="text-sm font-medium text-foreground">Live RAM Price</span>
      </div>

      {/* Range tabs — LIVE is the session sparkline, the rest are recorded history */}
      <div className="flex items-center justify-center gap-1 mb-3">
        {([{ key: 'live', label: 'LIVE' }, ...RAM_HISTORY_RANGES] as { key: RangeKey; label: string }[]).map(
          (tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setRange(tab.key)}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide transition-colors ${
                range === tab.key
                  ? 'bg-primary/20 text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ),
        )}
      </div>

      {/* WAX price — own header + own graph (8 decimals, WAX per KB) */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-white inline-block" />
            WAX
          </span>
          {pricePerByte !== null && (
            <span className="text-xs font-mono font-medium text-white whitespace-nowrap">
              {(pricePerByte * 1024).toFixed(8)} WAX/KB
            </span>
          )}
        </div>
        {hasChart ? (
          <div className="h-12">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="waxRamPriceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <YAxis domain={['dataMin', 'dataMax']} hide />
                <Tooltip content={renderTooltip(8, 'WAX/KB', 'text-white')} />
                <Area
                  type="monotone"
                  dataKey="waxPerKb"
                  stroke="#FFFFFF"
                  strokeWidth={1.5}
                  fill="url(#waxRamPriceGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-12 flex items-center justify-center">
            <span className="text-xs text-muted-foreground">{emptyMessage}</span>
          </div>
        )}
      </div>

      {/* CHEESE price — own header + own graph */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-primary inline-block" />
            CHEESE
          </span>
          {cheesePerKb !== null && (
            <span className="text-xs font-mono font-medium text-primary whitespace-nowrap">
              {cheesePerKb.toFixed(4)} CHEESE/KB
            </span>
          )}
        </div>
        {hasChart ? (
          <div className="h-12">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="cheeseRamPriceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <YAxis domain={['dataMin', 'dataMax']} hide />
                <Tooltip content={renderTooltip(4, 'CHEESE/KB', 'text-primary')} />
                <Area
                  type="monotone"
                  dataKey="cheesePerKb"
                  stroke="hsl(var(--primary))"
                  strokeWidth={1.5}
                  fill="url(#cheeseRamPriceGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-12 flex items-center justify-center">
            <span className="text-xs text-muted-foreground">{emptyMessage}</span>
          </div>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground mt-2 text-center">{footer}</p>
    </div>
  );
}
