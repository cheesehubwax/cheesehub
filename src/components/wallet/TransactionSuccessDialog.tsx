import { CheckCircle, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface TransactionSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  txId?: string | null;
}

export function TransactionSuccessDialog({
  open,
  onOpenChange,
  title = "Transaction Successful!",
  description = "Your transaction has been completed successfully.",
  txId,
}: TransactionSuccessDialogProps) {
  const explorerUrl = txId ? `https://waxblock.io/transaction/${txId}` : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <CheckCircle className="w-6 h-6 text-green-500" />
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-muted-foreground">{description}</p>
          {explorerUrl && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-cheese hover:underline text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              View on WAX Block Explorer
            </a>
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
