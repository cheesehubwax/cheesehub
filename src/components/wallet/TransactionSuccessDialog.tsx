import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, ExternalLink, Copy } from 'lucide-react';
import { toast } from 'sonner';

interface TransactionSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  txId?: string | null;
}

export function TransactionSuccessDialog({ open, onOpenChange, title, description, txId }: TransactionSuccessDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center">
            <CheckCircle className="h-10 w-10 text-green-500" />
          </div>
          <DialogTitle className="text-xl text-center">{title}</DialogTitle>
          <DialogDescription className="text-center text-base">{description}</DialogDescription>
        </DialogHeader>
        {txId && (
          <div className="mt-4 space-y-3">
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Transaction ID</p>
              <p className="text-xs font-mono break-all">{txId}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(txId); toast.success('Transaction ID copied!'); }} className="flex-1">
                <Copy className="h-4 w-4 mr-2" />Copy TX ID
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.open(`https://wax.bloks.io/transaction/${txId}`, '_blank')} className="flex-1">
                <ExternalLink className="h-4 w-4 mr-2" />View on Explorer
              </Button>
            </div>
          </div>
        )}
        <Button onClick={() => onOpenChange(false)} className="w-full mt-4 bg-cheese hover:bg-cheese-dark text-primary-foreground">Done</Button>
      </DialogContent>
    </Dialog>
  );
}
