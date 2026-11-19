import { memo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2 } from 'lucide-react';
import { TokenLogo } from '@/components/TokenLogo';
import type { RewardToken } from './createFarm';

interface RewardTokenRowProps {
  token: RewardToken;
  onRemove: (id: string) => void;
  onAmountChange: (id: string, amount: string) => void;
  onMax: (id: string, balance: number, precision: number) => void;
}

/** One reward token with its amount input in Create Alcor Farm. */
export const RewardTokenRow = memo(function RewardTokenRow({ token: rt, onRemove, onAmountChange, onMax }: RewardTokenRowProps) {
  return (
    <div className="p-3 rounded-lg bg-muted/30 border border-border/50 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TokenLogo contract={rt.contract} symbol={rt.symbol} size="sm" />
          <span className="font-medium">{rt.symbol}</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onRemove(rt.id)}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          placeholder="0.0000"
          value={rt.amount}
          onChange={(e) => onAmountChange(rt.id, e.target.value)}
          className="flex-1"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => onMax(rt.id, rt.balance, rt.precision)}
          className="h-9"
        >
          Max
        </Button>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Balance: {rt.balance.toFixed(Math.min(4, rt.precision))} {rt.symbol}</span>
        {parseFloat(rt.amount) > rt.balance && (
          <span className="text-red-500">Insufficient balance</span>
        )}
      </div>
    </div>
  );
});
