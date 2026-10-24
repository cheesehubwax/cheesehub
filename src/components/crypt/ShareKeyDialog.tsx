import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MESSAGE_FEE_QUANTITY } from '@/lib/cheeseCrypt';
import { TermsCheckbox } from '@/components/shared/TermsCheckbox';

interface ShareKeyDialogProps {
  account: string;
  publishOnly?: boolean;
  busy: boolean;
  agreed: boolean;
  onAgreedChange: (agreed: boolean) => void;
  onDownload: () => void;
  onPublish: () => void;
  onClose: () => void;
}

/**
 * One-time prompt shown right after profile setup: explains the two ways to
 * share a public key — privately with friends (recommended) or broadcast on
 * chain so anyone who knows the WAX account name can look it up.
 */
export const ShareKeyDialog = ({ account, publishOnly = false, busy, agreed, onAgreedChange, onDownload, onPublish, onClose }: ShareKeyDialogProps) => (
  <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
    <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{publishOnly ? '📣 Publish your account' : '📣 Share your public key'}</DialogTitle>
        <DialogDescription>
          Friends need your public key to send you encrypted messages. Your private key is never shared.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3 text-left">
        {!publishOnly && <div className="rounded-lg border border-cheese/40 bg-card/80 p-3 space-y-2">
          <p className="text-sm font-semibold">1. Share it with your friends directly <span className="text-cheese">(Recommended)</span></p>
          <p className="text-xs text-muted-foreground">
            Save your public key file — it goes into your cheesecrypt "my private key" folder, beside your private key — then send it to your friends and ask for theirs in return. Nothing is posted publicly.
          </p>
          <Button size="sm" className="w-full bg-cheese text-primary-foreground hover:bg-cheese/90" onClick={onDownload}>
            Save public key file
          </Button>
        </div>}
        <div className="space-y-2">
          <p className="text-sm font-semibold">{publishOnly ? 'Broadcast your public key on chain' : '2. Broadcast it on chain'}</p>
          <p className="text-xs text-muted-foreground">
            Like listing yourself in the telephone book: anyone who knows your WAX account name
            (<span className="font-mono">{account}</span>) can look up your public key and message you.
            Your account and public key become a permanent public blockchain record; they cannot be erased.
            Your private key and message contents are not published.
          </p>
          <p className="text-xs text-muted-foreground">
            Public Inbox is off by default. Publishing does not turn it on. If you enable it from Menu → Inbox,
            strangers with published keys can send text or NFT message requests. You choose Accept, Decline or Block;
            they do not become friends unless you accept. Existing friends can still message you with it off.
          </p>
          <p className="text-xs text-muted-foreground">
            To read messages, you also need the sender's public key — imported from their file, or found
            automatically if they publish theirs. Publishing costs {MESSAGE_FEE_QUANTITY}: 0.0080 CHEESE nulled
            and 0.0020 CHEESE to xcheeseliqst.
          </p>
          <TermsCheckbox id="crypt-publish-terms" checked={agreed} onCheckedChange={onAgreedChange} />
          <Button size="sm" variant="outline" className="w-full" disabled={busy || !agreed} onClick={onPublish}>
            {busy ? 'Publishing…' : 'Publish my key on chain'}
          </Button>
        </div>
        <Button size="sm" variant="ghost" className="w-full" disabled={busy} onClick={onClose}>{publishOnly ? 'Cancel' : 'Maybe later'}</Button>
      </div>
    </DialogContent>
  </Dialog>
);
