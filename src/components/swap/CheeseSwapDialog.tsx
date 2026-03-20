// CheeseSwap Dialog - Token swap interface using Alcor DEX aggregator

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CheeseSwapWidget } from './CheeseSwapWidget';
import { useWax } from '@/context/WaxContext';

type InputToken = 'WAX' | 'WAXUSDC';

interface CheeseSwapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inputToken?: InputToken;
}

export function CheeseSwapDialog({ open, onOpenChange, inputToken = 'WAX' }: CheeseSwapDialogProps) {
  const { accountName } = useWax();
  const queryClient = useQueryClient();

  // Refresh shared balance cache when swap dialog opens
  useEffect(() => {
    if (open && accountName) {
      queryClient.invalidateQueries({ queryKey: ['all-token-balances', accountName] });
    }
  }, [open, accountName, queryClient]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[480px] p-0 overflow-hidden bg-background border-cheese/30"
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="p-4 pb-0 pr-10">
          <div className="flex items-center gap-3">
            <DialogTitle className="text-lg font-bold text-foreground">
              Alcor Swap
            </DialogTitle>
            <span className="text-xs text-muted-foreground">
              powered by <a href="https://alcor.exchange" target="_blank" rel="noopener noreferrer" className="text-cheese hover:underline">Alcor Exchange</a>
            </span>
          </div>
          <DialogDescription className="text-muted-foreground text-sm">
            Swap tokens using Alcor's smart contracts
          </DialogDescription>
        </DialogHeader>
        <div className="p-4">
          <CheeseSwapWidget
            defaultInputTicker={inputToken}
            defaultOutputTicker="CHEESE"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
