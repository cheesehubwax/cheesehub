import { memo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { TokenLogo } from '@/components/TokenLogo';
import type { CompoundPlan } from '@/lib/alcorCompound';

export type CompoundEntry = CompoundPlan['compoundable'][number];

interface CompoundEntryRowProps {
  entry: CompoundEntry;
  isSelected: boolean;
  disabled: boolean;
  onToggle: (positionId: number, checked: boolean) => void;
}

/** One compoundable position in the Compound All preview. */
export const CompoundEntryRow = memo(function CompoundEntryRow({
  entry,
  isSelected,
  disabled,
  onToggle,
}: CompoundEntryRowProps) {
  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-md border p-2 ${
        isSelected ? 'border-border/50 bg-muted/30' : 'border-border/30 opacity-50'
      }`}
    >
      <div className="flex items-center gap-2">
        <Checkbox
          id={`compound-entry-${entry.positionId}`}
          checked={isSelected}
          onCheckedChange={(checked) => onToggle(entry.positionId, checked === true)}
          disabled={disabled}
        />
        <label htmlFor={`compound-entry-${entry.positionId}`} className="flex items-center gap-2 cursor-pointer">
          <div className="flex -space-x-2">
            <TokenLogo contract={entry.tokenA.contract} symbol={entry.tokenA.symbol} size="sm" />
            <TokenLogo contract={entry.tokenB.contract} symbol={entry.tokenB.symbol} size="sm" />
          </div>
          <div className="text-xs">
            <div className="font-medium">{entry.tokenA.symbol}/{entry.tokenB.symbol}</div>
            <div className="text-muted-foreground">#{entry.positionId}</div>
          </div>
        </label>
      </div>
      <div className="font-mono text-xs text-right text-cheese">
        <div>{entry.tokenA.amount.toFixed(Math.min(6, entry.tokenA.precision))} {entry.tokenA.symbol}</div>
        <div>{entry.tokenB.amount.toFixed(Math.min(6, entry.tokenB.precision))} {entry.tokenB.symbol}</div>
        {(entry.tokenA.fee > 0 || entry.tokenB.fee > 0) && (
          <div className="text-[10px] text-muted-foreground">
            fee {entry.tokenA.fee.toFixed(Math.min(6, entry.tokenA.precision))} {entry.tokenA.symbol}
            {entry.tokenB.fee > 0 && (
              <> · {entry.tokenB.fee.toFixed(Math.min(6, entry.tokenB.precision))} {entry.tokenB.symbol}</>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
