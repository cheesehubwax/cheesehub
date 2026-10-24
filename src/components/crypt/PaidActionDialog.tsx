import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TermsCheckbox } from '@/components/shared/TermsCheckbox';

/** Confirms a paid CHEESECrypt notice (join, leave, group update, friend request): shows the cost and requires the Terms box. */
export function PaidActionDialog({ title, description, cost, confirmLabel, busy, onConfirm, onClose, children }: {
  title: string; description: string; cost: string; confirmLabel: string; busy: boolean;
  onConfirm: () => Promise<boolean> | void; onClose: () => void; children?: ReactNode;
}) {
  const [agreed, setAgreed] = useState(false);
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
      {children}
      <p className="text-xs text-muted-foreground">Cost: {cost}. Platform fees split 80% to eosio.null and 20% to xcheeseliqst; 0.0001 CHEESE per part goes to each recipient.</p>
      <TermsCheckbox id="crypt-paid-terms" checked={agreed} onCheckedChange={setAgreed} />
      <DialogFooter>
        <Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
        <Button disabled={busy || !agreed} onClick={() => void onConfirm()}>{busy ? 'Sending…' : confirmLabel}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
