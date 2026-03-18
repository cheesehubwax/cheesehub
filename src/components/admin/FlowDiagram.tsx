import { cn } from '@/lib/utils';

export interface FlowStep {
  label: string;
  items: { pct: string; dest: string; highlight?: 'burn' | 'liq' | 'power' | 'stake' | 'swap' | 'fee' | 'neutral' }[];
}

const highlightClasses: Record<string, string> = {
  burn: 'bg-red-500/20 text-red-300 border-red-500/30',
  liq: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  power: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  stake: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  swap: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  fee: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  neutral: 'bg-muted text-muted-foreground border-border',
};

export function FlowDiagram({ steps }: { steps: FlowStep[] }) {
  return (
    <div className="space-y-4">
      {steps.map((step, si) => (
        <div key={si} className="flex items-start gap-3">
          {/* Source label */}
          <div className="shrink-0 w-28">
            <span className="text-xs font-medium text-foreground bg-muted rounded px-2 py-1 block text-center">
              {step.label}
            </span>
          </div>

          {/* Arrow */}
          <div className="shrink-0 mt-1.5 text-muted-foreground">→</div>

          {/* Split items */}
          <div className="flex flex-wrap gap-2">
            {step.items.map((item, ii) => (
              <span
                key={ii}
                className={cn('text-xs rounded border px-2 py-1', highlightClasses[item.highlight || 'neutral'])}
              >
                {item.pct} → {item.dest}
              </span>
            ))}
          </div>

          {/* Connector between steps */}
          {si < steps.length - 1 && (
            <div className="hidden" />
          )}
        </div>
      ))}
    </div>
  );
}
