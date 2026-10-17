import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MESSAGE_FEE_QUANTITY } from '@/lib/cheeseCrypt';

interface ShareKeyDialogProps {
  account: string;
  busy: boolean;
  onDownload: () => void;
  onPublish: () => void;
  onClose: () => void;
}

/**
 * One-time prompt shown right after profile setup: explains the two ways to
 * share a public key — privately with friends (recommended) or broadcast on
 * chain so anyone who knows the WAX account name can look it up.
 */
export const ShareKeyDialog = ({ account, busy, onDownload, onPublish, onClose }: ShareKeyDialogProps) => (
  <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>📣 Share your public key</DialogTitle>
        <DialogDescription>
          Friends need your public key to send you encrypted messages. Your private key is never shared.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3 text-left">
        <div className="rounded-lg border border-cheese/40 bg-card/80 p-3 space-y-2">
          <p className="text-sm font-semibold">1. Share it with your friends directly <span className="text-cheese">(Recommended)</span></p>
          <p className="text-xs text-muted-foreground">
            Download your public key file and send it to your friends — and ask for theirs in return. Nothing is posted publicly.
          </p>
          <Button size="sm" className="w-full bg-cheese text-primary-foreground hover:bg-cheese/90" onClick={onDownload}>
            Download public key file
          </Button>
        </div>
        <div className="rounded-lg border border-border bg-card/80 p-3 space-y-2">
          <p className="text-sm font-semibold">2. Broadcast it on chain <span className="text-muted-foreground">(one-time action)</span></p>
          <p className="text-xs text-muted-foreground">
            Like listing yourself in the telephone book: anyone who knows your WAX account name
            (<span className="font-mono">{account}</span>) can look up your public key and message you.
            To read their replies you still need their public key — imported from their file, or found
            automatically if they broadcast theirs too. Costs {MESSAGE_FEE_QUANTITY} (nulled) and requires the Terms of Use checkbox.
          </p>
          <Button size="sm" variant="outline" className="w-full" disabled={busy} onClick={onPublish}>
            Publish my key on chain
          </Button>
        </div>
        <Button size="sm" variant="ghost" className="w-full" onClick={onClose}>Maybe later</Button>
      </div>
    </DialogContent>
  </Dialog>
);
