import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TermsCheckbox } from '@/components/shared/TermsCheckbox';

/** Offers to send your updated name/avatar to friends and group members as an encrypted profile note. */
export function ProfileShareDialog({ recipients, cost, busy, onSend, onClose }: {
  recipients: string[]; cost: string; busy: boolean; onSend: () => void; onClose: () => void;
}) {
  const [agreed, setAgreed] = useState(false);
  return (
    <Dialog open onOpenChange={o => { if (!o && !busy) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>📣 Tell your friends?</DialogTitle>
          <DialogDescription>
            {recipients.length
              ? 'Send your new name and avatar inside an encrypted message so friends and group members see it. It never shows up as a chat message.'
              : 'Add friends first — there is no one to update yet.'}
          </DialogDescription>
        </DialogHeader>
        {recipients.length > 0 && <>
          <p className="text-sm">{recipients.length} {recipients.length === 1 ? 'person' : 'people'}: <span className="text-muted-foreground break-words">{recipients.join(', ')}</span></p>
          <p className="text-sm">Cost: <span className="font-semibold text-cheese">{cost}</span> <span className="text-xs text-muted-foreground">(platform fee 80% nulled to eosio.null, 20% to xcheeseliqst; the rest is delivered to each person)</span></p>
          <TermsCheckbox id="profile-note-terms" checked={agreed} onCheckedChange={setAgreed} />
        </>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={busy} onClick={onClose}>Not now</Button>
          {recipients.length > 0 && <Button disabled={!agreed || busy} onClick={onSend} className="bg-cheese text-primary-foreground hover:bg-cheese/90">{busy ? 'Sending…' : 'Send update'}</Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
