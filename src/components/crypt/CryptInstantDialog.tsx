import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { INSTANT_MIN_FREE_RAM, INSTANT_PERMISSION, needsRam, type InstantStatus } from '@/lib/cryptInstant';

/** Instant Messaging setup/removal dialog. Presentational: state and transactions live in useCryptInstant. */
export function CryptInstantDialog({ open, onOpenChange, account, ready, status, quoteRam, enable, revoke }: {
  open: boolean; onOpenChange: (v: boolean) => void; account: string; ready: boolean; status: InstantStatus | null;
  quoteRam: (s: InstantStatus | null) => Promise<{ needed: boolean; quantity: string | null }>;
  enable: (ramQuantity: string | null) => Promise<boolean>; revoke: () => Promise<boolean>;
}) {
  const [agreed, setAgreed] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ram, setRam] = useState<{ needed: boolean; quantity: string | null } | null>(null);
  const lowRam = needsRam(status);

  useEffect(() => {
    if (!open) return;
    setError(null);
    let live = true;
    void quoteRam(status).then(q => { if (live) setRam(q); });
    return () => { live = false; };
  }, [open, status, quoteRam]);

  const run = async (fn: () => Promise<boolean>) => {
    setBusy(true); setError(null);
    try { if (await fn()) onOpenChange(false); }
    catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.'); }
    finally { setBusy(false); }
  };
  const ramBlocked = lowRam && !ram?.quantity;
  const elsewhere = !ready && status?.exists;

  return (
    <Dialog open={open} onOpenChange={v => { if (!busy) onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>⚡ Instant Messaging</DialogTitle></DialogHeader>
        {ready ? (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">Instant Messaging is on in this browser. Free text messages, replies, reactions and NFT shares send without an Anchor popup. Voice notes, tips, keys, room listings and paid messages still ask Anchor.</p>
            <p className="text-muted-foreground">Switching off removes the <code>{INSTANT_PERMISSION}</code> permission from {account} (one Anchor approval) and deletes the key from this browser.</p>
            {error && <p className="text-destructive text-xs">{error}</p>}
            <Button variant="outline" disabled={busy} onClick={() => run(revoke)}>{busy ? 'Waiting for Anchor…' : 'Switch off Instant Messaging'}</Button>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">Send free messages without an Anchor popup each time. One Anchor approval adds a messaging-only permission (<code>{INSTANT_PERMISSION}</code>) to {account}, whose key is kept in this browser.</p>
            <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1">
              <li>The permission can only send free CHEESECrypt messages. It cannot move WAX, CHEESE, NFTs or anything else.</li>
              <li>Anyone who gets into this browser could send messages as you until you switch it off. Use it only on your own device.</li>
              <li>Greymass Fuel usually covers each message's network cost. If it can't, your own CPU is used; when that runs out you'll be offered CHEESEUp to rent CPU with CHEESE.</li>
              <li>The key is kept only in this tab. It is deleted when you close the tab, or after 4 hours without typing, clicking or scrolling. Switch it on again (one Anchor approval) to make a new one.</li>
              {elsewhere && <li>Instant Messaging is already set up for another browser. Switching on here replaces that key, so the other browser stops sending instantly.</li>}
            </ul>
            {lowRam && (
              <div className="rounded border border-cheese/30 p-2 text-xs space-y-1">
                <p>Your account has {status?.freeRam ?? 0} bytes of free RAM; the permission needs up to about {INSTANT_MIN_FREE_RAM}.</p>
                {ram?.quantity
                  ? <p>The same approval will send <b>{ram.quantity}</b> to ram.chz to buy RAM for {account} first (80% of that CHEESE is nulled).</p>
                  : <p className="text-destructive">{ram ? 'CHEESERam can\'t quote a RAM purchase right now.' : 'Checking CHEESERam…'}</p>}
                <Link to="/ram" className="text-cheese underline" onClick={() => onOpenChange(false)}>Or top up RAM on CHEESERam first</Link>
              </div>
            )}
            {error && <p className="text-destructive text-xs">{error}</p>}
            <Button disabled={busy || !agreed || ramBlocked || !status} onClick={() => run(() => enable(ram?.quantity ?? null))}
              className="bg-cheese text-primary-foreground hover:bg-cheese/90">
              {busy ? 'Waiting for Anchor…' : lowRam && ram?.quantity ? `Buy RAM & switch on` : 'Switch on Instant Messaging'}
            </Button>
            {!status && <p className="text-xs text-muted-foreground">Reading your account…</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
