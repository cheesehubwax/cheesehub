// Cumulative realised P/L area chart.
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmt, money, type Currency } from '@/components/folio/format';

export function PlChart({ data, title, cur = 'WAX' }: { data: { date: string; value: number }[]; title: string; cur?: Currency }) {
  if (data.length < 2) {
    return <div className="flex h-48 items-center justify-center rounded-lg border border-border/50 bg-card/60 text-sm text-muted-foreground">Not enough history for a chart yet.</div>;
  }
  return (
    <div className="rounded-lg border border-border/50 bg-card/60 p-3">
      <div className="mb-2 text-center text-sm font-semibold">{title}</div>
      <div className="h-48 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={`folio-${title}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--foreground))' }} minTickGap={24} />
            <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--foreground))' }} width={70} tickFormatter={(v: number) => fmt(v, 0)} />
            <Tooltip
              contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
              formatter={(v: number) => [money(v, cur), title]}
            />
            <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fill={`url(#folio-${title})`} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
