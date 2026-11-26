import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/** Offers to send your updated name/avatar to friends and group members as an encrypted profile note. */
export function ProfileShareDialog({ recipients, cost, busy, onSend, onClose, rooms = [], onShareRoom }: {
  recipients: string[]; cost: string; busy: boolean; onSend: () => void; onClose: () => void;
  /** Joined groups with members who can receive your profile; each is a separate paid share. */
  rooms?: { id: string; name: string; count: number; cost: string }[]; onShareRoom?: (id: string) => void;
}) {
  const [agreed, setAgreed] = useState(true);
  return (
    <Dialog open onOpenChange={o => { if (!o && !busy) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>📣 Tell your friends?</DialogTitle>
          <DialogDescription>
            {recipients.length
              ? 'Send your new name and avatar inside an encrypted message so friends and group members see it. It never shows up as a chat message.'
              : 'No friends to update yet.'}
          </DialogDescription>
        </DialogHeader>
        {recipients.length > 0 && <>
          <p className="text-sm">{recipients.length} {recipients.length === 1 ? 'person' : 'people'}: <span className="text-muted-foreground break-words">{recipients.join(', ')}</span></p>
          <p className="text-sm">Cost: <span className="font-semibold text-cheese">{cost}</span> <span className="text-xs text-muted-foreground">(platform fee 80% nulled to eosio.null, 20% to xcheeseliqst; the rest is delivered to each person)</span></p>
        </>}
        {rooms.length > 0 && onShareRoom && <div className="space-y-2 border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">Group members who aren't your friends need a separate share per group:</p>
          <ul className="max-h-40 space-y-1 overflow-y-auto">
            {rooms.map(r => <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate">{r.name} <span className="text-xs text-muted-foreground">({r.count} · {r.cost})</span></span>
              <Button size="sm" variant="outline" className="h-7 shrink-0 text-xs" disabled={busy} onClick={() => onShareRoom(r.id)}>📣 Share</Button>
            </li>)}
          </ul>
        </div>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={busy} onClick={onClose}>Not now</Button>
          {recipients.length > 0 && <Button disabled={!agreed || busy} onClick={onSend} className="bg-cheese text-primary-foreground hover:bg-cheese/90">{busy ? 'Sending…' : 'Send update'}</Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
