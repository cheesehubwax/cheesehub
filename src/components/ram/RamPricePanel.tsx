import { AreaChart, Area, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import { OpenMojiIcon } from '@/components/OpenMojiIcon';
import type { RamPricePoint } from '@/hooks/useCheeseRam';

interface RamPricePanelProps {
  pricePerByte: number | null;
  history: RamPricePoint[];
}

export function RamPricePanel({ pricePerByte, history }: RamPricePanelProps) {
  const pricePerKb = pricePerByte ? pricePerByte * 1024 : null;

  return (
    <div className="rounded-xl p-4 max-w-2xl w-full bg-card border border-border/50">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <OpenMojiIcon emoji="📈" size={18} />
          <span className="text-sm font-medium text-foreground">Live RAM Price</span>
        </div>
        {pricePerKb !== null && (
          <span className="text-sm font-mono font-medium text-primary">
            {pricePerKb.toFixed(8)} WAX / KB
          </span>
        )}
      </div>

      {history.length >= 2 ? (
        <div className="h-16">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
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
                    <div className="bg-background/95 border border-border px-2 py-1 rounded text-xs font-mono">
                      {((payload[0].value as number) * 1024).toFixed(8)} WAX / KB
                    </div>
                  ) : null
                }
              />
              <Area type="monotone" dataKey="price" stroke="hsl(var(--primary))" strokeWidth={1.5} fill="url(#cheeseRamPriceGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-16 flex items-center justify-center">
          <span className="text-xs text-muted-foreground">Building price history...</span>
        </div>
      )}
      <p className="text-[10px] text-muted-foreground mt-1 text-center">
        Updates every 30s • Session data only
      </p>
    </div>
  );
}
