import { getDeviationSeverity, type Severity } from '@/lib/adminData';
import { Badge } from '@/components/ui/badge';
import { WarningCircle, CheckCircle, Warning } from '@phosphor-icons/react';

interface PriceDeviationGaugeProps {
  label: string;
  baseline: number;
  live: number | null;
  deviationPct: number | null;
  unit?: string;
}

const severityConfig: Record<Severity, { bg: string; text: string; bar: string; Icon: typeof CheckCircle; label: string }> = {
  green: { bg: 'bg-green-500/20', text: 'text-green-400', bar: 'bg-green-400', Icon: CheckCircle, label: 'Safe' },
  yellow: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', bar: 'bg-yellow-400', Icon: Warning, label: 'Warning' },
  red: { bg: 'bg-red-500/20', text: 'text-red-400', bar: 'bg-red-400', Icon: WarningCircle, label: 'Critical' },
};

export function PriceDeviationGauge({ label, baseline, live, deviationPct, unit = '' }: PriceDeviationGaugeProps) {
  const severity = deviationPct !== null ? getDeviationSeverity(deviationPct) : 'green';
  const config = severityConfig[severity];

  return (
    <div className={`rounded-lg border p-4 ${config.bg} space-y-3`}>
      <div className="flex items-center justify-between">
        <span className="font-medium text-foreground">{label}</span>
        <Badge className={`${config.bg} ${config.text}`}>
          <config.Icon className="mr-1 h-3.5 w-3.5" weight="bold" />
          {config.label}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <span className="text-muted-foreground">Baseline:</span>
        <span className="text-foreground text-right">{Number(baseline).toFixed(4)} {unit}</span>
        <span className="text-muted-foreground">Live:</span>
        <span className="text-foreground text-right">{live !== null ? `${live.toFixed(4)} ${unit}` : '—'}</span>
      </div>

      {deviationPct !== null && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Deviation:</span>
          <span className={`font-semibold ${config.text}`}>
            {deviationPct >= 0 ? '+' : ''}{deviationPct.toFixed(2)}%
          </span>
        </div>
      )}

      {/* Visual bar */}
      <div className="relative h-3 rounded-full bg-muted overflow-hidden">
        {/* Threshold markers at 5%, 8%, 10% */}
        <div className="absolute left-[25%] top-0 h-full w-px bg-yellow-500/50" />
        <div className="absolute right-[25%] top-0 h-full w-px bg-yellow-500/50" />
        <div className="absolute left-[10%] top-0 h-full w-px bg-red-500/50" />
        <div className="absolute right-[10%] top-0 h-full w-px bg-red-500/50" />
        {deviationPct !== null && (
          <div
            className={`absolute top-0 h-full ${config.bar} rounded-full`}
            style={{
              width: `${Math.min(Math.abs(deviationPct) * 5, 50)}%`,
              left: deviationPct >= 0 ? '50%' : undefined,
              right: deviationPct < 0 ? '50%' : undefined,
            }}
          />
        )}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>-10%</span>
        <span>0%</span>
        <span>+10%</span>
      </div>
    </div>
  );
}
