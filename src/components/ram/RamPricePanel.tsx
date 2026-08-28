import { AreaChart, Area, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import { OpenMojiIcon } from '@/components/OpenMojiIcon';
import type { RamPricePoint } from '@/hooks/useCheeseRam';

interface RamPricePanelProps {
  cheesePerKb: number | null;
  waxPerKb: number | null;
  history: RamPricePoint[];
}

export function RamPricePanel({ cheesePerKb, waxPerKb, history }: RamPricePanelProps) {
  const chartData = history.filter((point) => point.cheesePerKb !== null);

  return (
    <div className="rounded-xl p-4 max-w-lg w-full bg-card border border-border/50">
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-2">
          <OpenMojiIcon emoji="📈" size={18} />
          <span className="text-sm font-medium text-foreground">Live RAM Price</span>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-primary inline-block" />
            CHEESE
          </span>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-white inline-block" />
            WAX
          </span>
        </div>
        {cheesePerKb !== null && waxPerKb !== null && (
          <span className="text-xs font-mono font-medium whitespace-nowrap">
            <span className="text-primary">{cheesePerKb.toFixed(4)} CHEESE</span>
            <span className="text-muted-foreground"> | </span>
            <span className="text-white">{waxPerKb.toFixed(4)} WAX</span>
            <span className="text-muted-foreground"> / KB</span>
          </span>
        )}
      </div>

      {chartData.length >= 2 ? (
        <div className="space-y-1">
          {/* WAX line — own scale, own path */}
          <div className="h-12">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <YAxis
                  domain={[
                    (dataMin: number) => dataMin * 0.999,
                    (dataMax: number) => dataMax * 1.001,
                  ]}
                  hide
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const point = payload[0].payload as RamPricePoint;
                    return (
                      <div className="bg-background/95 border border-border px-2 py-1 rounded text-xs font-mono">
                        <span className="text-white">{point.waxPerKb.toFixed(4)} WAX / KB</span>
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="waxPerKb"
                  stroke="#FFFFFF"
                  strokeWidth={1.5}
                  fill="none"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* CHEESE line — own scale, own path */}
          <div className="h-12">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="cheeseRamPriceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <YAxis
                  domain={[
                    (dataMin: number) => dataMin * 0.999,
                    (dataMax: number) => dataMax * 1.001,
                  ]}
                  hide
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const point = payload[0].payload as RamPricePoint;
                    return point.cheesePerKb !== null ? (
                      <div className="bg-background/95 border border-border px-2 py-1 rounded text-xs font-mono">
                        <span className="text-primary">{point.cheesePerKb.toFixed(4)} CHEESE / KB</span>
                      </div>
                    ) : null;
                  }}
                />
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
        </div>
      ) : (
        <div className="h-24 flex items-center justify-center">
          <span className="text-xs text-muted-foreground">Building price history...</span>
        </div>
      )}
      <p className="text-[10px] text-muted-foreground mt-1 text-center">
        Updates every 30s • Session data only
      </p>
    </div>
  );
}
