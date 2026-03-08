// CheeseSwap Dialog - Token swap interface using WaxOnEdge widget
// Note: Requires @waxonedge/swap package for full functionality

import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useWax } from '@/context/WaxContext';
import { TransactionSuccessDialog } from '@/components/wallet/TransactionSuccessDialog';
import { toast } from 'sonner';
import { getTransactPlugins } from '@/lib/wharfKit';

type InputToken = 'WAX' | 'WAXUSDC';

interface CheeseSwapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inputToken?: InputToken;
}

export function CheeseSwapDialog({ open, onOpenChange, inputToken = 'WAX' }: CheeseSwapDialogProps) {
  const { session, login } = useWax();
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [lastTxId, setLastTxId] = useState<string | null>(null);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="sm:max-w-[480px] p-0 overflow-hidden bg-background border-cheese/30"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader className="p-4 pb-0 pr-10">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-lg font-bold">
                <span className="text-cheese">CHEESE</span>
                <span className="text-foreground">Swap</span>
              </DialogTitle>
              <span className="text-xs text-muted-foreground">
                powered by <a href="https://waxonedge.app" target="_blank" rel="noopener noreferrer" className="text-cheese hover:underline">WaxOnEdge</a>
              </span>
            </div>
            <DialogDescription className="text-muted-foreground text-sm">
              Swap tokens with best rates across all WAX DEXs
            </DialogDescription>
          </DialogHeader>
          <div className="p-4">
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <p className="text-sm">Swap widget requires the @waxonedge/swap package.</p>
              <p className="text-xs mt-2">
                Trade CHEESE on{" "}
                <a
                  href="https://wax.alcor.exchange/swap?output=CHEESE-cheeseburger"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cheese hover:underline"
                >
                  Alcor Exchange
                </a>
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <TransactionSuccessDialog
        open={successDialogOpen}
        onOpenChange={setSuccessDialogOpen}
        title="Swap Successful!"
        description="Your token swap has been completed successfully."
        txId={lastTxId}
      />
    </>
  );
}
