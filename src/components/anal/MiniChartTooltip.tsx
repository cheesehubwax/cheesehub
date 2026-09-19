import { tooltipDate } from './format';

interface MiniChartTooltipProps {
  active?: boolean;
  payload?: { value?: unknown; payload?: { date?: string } }[];
  format: (value: number) => string;
  valueClass: string;
  extras?: (date: string, value: number) => string[];
}

/** Shared tooltip presentation for CHEESEAnal's compact history charts. */
export function MiniChartTooltip({ active, payload, format, valueClass, extras }: MiniChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const value = Number(payload[0].value);
  const date = String(payload[0].payload?.date ?? '');
  const lines = extras?.(date, value) ?? [];

  return (
    <div className="bg-background/95 border border-border px-2 py-1 rounded text-xs font-mono max-w-[280px]">
      <div className={valueClass}>{format(value)}</div>
      {lines.map((line) => (
        <div key={line} className="text-foreground/90 break-words">
          {line}
        </div>
      ))}
      <div className="text-muted-foreground">{tooltipDate(date)}</div>
    </div>
  );
}