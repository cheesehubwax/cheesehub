import { AreaChart, Area, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import { OpenMojiIcon } from '@/components/OpenMojiIcon';
import type { RamPricePoint } from '@/hooks/useCheeseRam';

interface RamPricePanelProps {
  cheesePerKb: number | null;
  pricePerByte: number | null;
  history: RamPricePoint[];
}

export function RamPricePanel({ cheesePerKb, pricePerByte, history }: RamPricePanelProps) {
  const chartData = history.filter((point) => point.cheesePerKb !== null);
  const hasChart = chartData.length >= 2;

  return (
    <div className="rounded-xl p-4 max-w-lg w-full bg-card border border-border/50">
      <div className="flex items-center gap-2 mb-3">
        <OpenMojiIcon emoji="📈" size={18} />
        <span className="text-sm font-medium text-foreground">Live RAM Price</span>
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
                <Tooltip
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <div className="bg-background/95 border border-border px-2 py-1 rounded text-xs font-mono text-white">
                        {(payload[0].value as number).toFixed(8)} WAX/KB
                      </div>
                    ) : null
                  }
                />
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
            <span className="text-xs text-muted-foreground">Building price history...</span>
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
                <Tooltip
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <div className="bg-background/95 border border-border px-2 py-1 rounded text-xs font-mono text-primary">
                        {(payload[0].value as number).toFixed(4)} CHEESE/KB
                      </div>
                    ) : null
                  }
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
        ) : (
          <div className="h-12 flex items-center justify-center">
            <span className="text-xs text-muted-foreground">Building price history...</span>
          </div>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground mt-2 text-center">
        Updates every 30s • Session data only
      </p>
    </div>
  );
}
