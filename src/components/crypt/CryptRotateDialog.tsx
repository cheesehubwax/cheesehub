import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TermsCheckbox } from '@/components/shared/TermsCheckbox';

/**
 * Two steps. 1 (free): make the new key, lock it with Anchor together with the old one, and save the backup.
 * 2 (paid): send friends the new key. Public posting is off by default. `step` comes from the Messenger.
 */
export function CryptRotateDialog({ step, friends, roomCount, busy, costFor, onCreate, onAnnounce, onClose }: {
  step: 'create' | 'announce'; friends: number; roomCount: number; busy: boolean; costFor: (publish: boolean) => string;
  onCreate: () => void; onAnnounce: (publish: boolean) => void; onClose: () => void;
}) {
  const [publish, setPublish] = useState(false);
  const [agreed, setAgreed] = useState(false);
  return <Dialog open onOpenChange={o => { if (!o && !busy) onClose(); }}>
    <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>🔄 {step === 'create' ? 'Rotate your key' : 'Tell your friends'}</DialogTitle>
        <DialogDescription>{step === 'create'
          ? 'Step 1 of 2 (free): two Anchor signatures lock your new key together with the old one, then the updated backup is saved.'
          : 'Step 2 of 2: each friend gets your new key inside an encrypted notice from your old key, so they know it is really you.'}</DialogDescription>
      </DialogHeader>
      <div className="space-y-2 text-sm text-muted-foreground">
        {step === 'create' ? <>
          <p>Your new key is never posted publicly unless you choose to. Friends, nicknames and groups stay.</p>
          {roomCount > 0 && <p>{roomCount} room{roomCount === 1 ? '' : 's'} still list{roomCount === 1 ? 's' : ''} you by your current key, so it is kept for those rooms and they keep working.</p>}
          <p>Save the new backup when asked. Old backup files still hold your old key; delete them once you no longer need it.</p>
        </> : <>
          <p>{friends ? `${friends} friend${friends === 1 ? '' : 's'} will be told.` : 'You have no friends to tell yet.'} Anyone you skip now is told automatically with your next message to them.</p>
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-1" checked={publish} onChange={e => setPublish(e.target.checked)} />
            <span>Also post my new key publicly so new people can find me <span className="block text-xs">Off keeps it private. People who look you up later only find your old key, and their messages stop opening once that key is destroyed.</span></span>
          </label>
          <p className="text-xs">Cost: {costFor(publish)}. Platform fees split 80% to eosio.null and 20% to xcheeseliqst; 0.0001 CHEESE per part goes to each friend.</p>
          <TermsCheckbox id="crypt-rotate-terms" checked={agreed} onCheckedChange={setAgreed} />
        </>}
      </div>
      <DialogFooter>
        <Button variant="outline" disabled={busy} onClick={onClose}>{step === 'create' ? 'Cancel' : 'Later'}</Button>
        {step === 'create'
          ? <Button disabled={busy} onClick={onCreate}>{busy ? 'Locking…' : 'Create & lock new key'}</Button>
          : <Button disabled={busy || !agreed || (!friends && !publish)} onClick={() => onAnnounce(publish)}>{busy ? 'Sending…' : 'Pay & send'}</Button>}
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
