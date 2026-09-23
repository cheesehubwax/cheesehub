// CHEESEAnal — one compact history chart that opens a large, zoomable copy on click.
import { useState, type ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Brush,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MiniChartTooltip } from '@/components/anal/MiniChartTooltip';
import { shortDate } from './format';

const axisTick = { fontSize: 10, fill: '#FFFFFF' } as const;

interface AnalChartCardProps {
  /** Label row inside the centered value box. */
  label: ReactNode;
  /** Current figure shown in the value box. */
  value: ReactNode;
  /** Plain-text title for the enlarged popup. */
  title: string;
  data: Record<string, unknown>[];
  dataKey: string;
  type: 'line' | 'area';
  color: string;
  /** Gradient id, required for area charts. */
  gradientId?: string;
  /** Tooltip value formatter. */
  format: (value: number) => string;
  /** Y axis tick formatter. */
  yFormat?: (value: number) => string;
  valueClass: string;
  extras?: (date: string, value: number) => string[];
  allowDecimals?: boolean;
  connectNulls?: boolean;
  onHover?: (date: string | null) => void;
}

/** Shared chart body, rendered at both the compact and the enlarged size. */
function ChartBody({
  large,
  brushKey,
  ...props
}: AnalChartCardProps & { large: boolean; brushKey: number }) {
  const {
    data,
    dataKey,
    type,
    color,
    gradientId,
    format,
    yFormat,
    valueClass,
    extras,
    allowDecimals,
    connectNulls,
    onHover,
  } = props;

  const hover = {
    onMouseMove: (state: { activeLabel?: string | number }) =>
      onHover?.(state?.activeLabel != null ? String(state.activeLabel) : null),
    onMouseLeave: () => onHover?.(null),
  };

  const shared = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
      <XAxis dataKey="date" tickFormatter={shortDate} tick={axisTick} stroke="hsl(var(--border))" />
      <YAxis
        domain={['auto', 'auto']}
        allowDecimals={allowDecimals}
        tickFormatter={yFormat}
        tick={axisTick}
        width={70}
        stroke="hsl(var(--border))"
      />
      <Tooltip
        content={(tooltipProps) => (
          <MiniChartTooltip {...tooltipProps} format={format} valueClass={valueClass} extras={extras} />
        )}
      />
      {large && (
        <Brush
          key={brushKey}
          dataKey="date"
          height={26}
          travellerWidth={8}
          tickFormatter={shortDate}
          stroke={color}
          fill="hsl(var(--muted))"
        />
      )}
    </>
  );

  const dot = { r: large ? 4 : 3, fill: color, strokeWidth: 0 };
  const activeDot = { r: large ? 6 : 4 };
  const margin = { top: 4, right: 8, left: 0, bottom: 0 };

  return (
    <ResponsiveContainer width="100%" height="100%">
      {type === 'area' ? (
        <AreaChart data={data} margin={margin} {...hover}>
          <defs>
            <linearGradient id={`${gradientId ?? dataKey}${large ? 'Large' : ''}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          {shared}
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradientId ?? dataKey}${large ? 'Large' : ''})`}
            connectNulls={connectNulls}
            dot={dot}
            activeDot={activeDot}
          />
        </AreaChart>
      ) : (
        <LineChart data={data} margin={margin} {...hover}>
          {shared}
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            connectNulls={connectNulls}
            dot={dot}
            activeDot={activeDot}
          />
        </LineChart>
      )}
    </ResponsiveContainer>
  );
}

export function AnalChartCard(props: AnalChartCardProps) {
  const { label, value, title } = props;
  const [open, setOpen] = useState(false);
  const [brushKey, setBrushKey] = useState(0);

  return (
    <div className="space-y-1">
      <div className="w-fit mx-auto px-2 py-1 rounded-md bg-background/60 border border-border/40 text-center">
        <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="text-sm font-mono font-semibold text-foreground leading-tight">{value}</div>
      </div>
      <div className="group relative">
        <div className="h-36">
          <ChartBody {...props} large={false} brushKey={brushKey} />
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Enlarge ${title}`}
          className="absolute inset-0 cursor-zoom-in rounded-md"
        >
          <span className="absolute top-1 right-1 rounded bg-background/80 border border-border/60 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
            Click to enlarge
          </span>
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle className="text-sm font-medium">{title}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-muted-foreground">
              Drag the strip below the chart to zoom into a date range.
            </span>
            <Button size="sm" variant="ghost" onClick={() => setBrushKey((k) => k + 1)}>
              Reset zoom
            </Button>
          </div>
          <div className="h-96">
            {open && <ChartBody {...props} large brushKey={brushKey} />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
