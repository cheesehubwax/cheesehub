import { useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { safetyGroups, safetyNumber, type VerifyState } from '@/lib/cryptSafety';

/** Out-of-band key check for a direct chat. Purely local: nothing is sent and nothing is paid. */
export function SafetyNumberDialog({ open, onOpenChange, me, partner, partnerName, state, onMark }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  me: { account: string; publicKey: string }; partner: { account: string; publicKey: string }; partnerName: string;
  state: VerifyState; onMark: (verified: boolean) => void;
}) {
  const number = useMemo(() => open ? safetyNumber(me, partner) : '', [open, me, partner]);
  const groups = safetyGroups(number);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>🔐 Safety number with {partnerName}</DialogTitle>
          <DialogDescription>
            Compare this number with {partnerName} in person or on a call. If it matches on both screens, nobody has swapped either of your keys.
          </DialogDescription>
        </DialogHeader>
        {state === 'changed' && <p className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">⚠️ {partnerName}'s key has changed since you verified it. Check again before sharing anything sensitive.</p>}
        <div className="grid grid-cols-4 gap-x-3 gap-y-1 font-mono text-base tracking-wider" aria-label="Safety number">
          {groups.map((g, i) => <span key={i}>{g}</span>)}
        </div>
        {number && <div className="mx-auto rounded-md bg-foreground p-3"><QRCodeSVG value={number} size={160} bgColor="transparent" fgColor="hsl(var(--background))" /></div>}
        <p className="text-[11px] text-muted-foreground">Calculated in your browser from both public keys. Nothing is sent on chain and there's no fee. Your “verified” mark is kept only on this device.</p>
        <div className="flex justify-end gap-2">
          {state === 'verified'
            ? <Button variant="outline" onClick={() => onMark(false)}>Clear verified mark</Button>
            : <Button className="bg-cheese text-primary-foreground hover:bg-cheese/90" onClick={() => onMark(true)}>✅ Mark as verified</Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
