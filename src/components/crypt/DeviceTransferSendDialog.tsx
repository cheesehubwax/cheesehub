import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { buildBundle, encryptBundle, formatCode, generateCode, summarize } from '@/lib/cryptDeviceTransfer';
import type { LockedKeyFile } from '@/lib/cryptKeyLock';

const EXPIRY_MS = 5 * 60_000;

/** Shows the encrypted transfer as cycling QR frames plus the one-time code. Nothing is sent anywhere. */
export function DeviceTransferSendDialog({ open, onOpenChange, account, lockedKey }: {
  open: boolean; onOpenChange: (v: boolean) => void; account: string; lockedKey: LockedKeyFile | null;
}) {
  const [state, setState] = useState<{ code: string; frames: string[]; summary: ReturnType<typeof summarize> } | null>(null);
  const [error, setError] = useState('');
  const [frame, setFrame] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setState(null); setError(''); setFrame(0); setCopied(false);
    if (!open) return;
    let alive = true;
    void (async () => {
      try {
        const bundle = buildBundle(account, lockedKey);
        const code = generateCode();
        const frames = await encryptBundle(bundle, code);
        if (alive) setState({ code, frames, summary: summarize(bundle) });
      } catch (e) { if (alive) setError((e as Error).message); }
    })();
    const expire = setTimeout(() => onOpenChange(false), EXPIRY_MS);
    return () => { alive = false; clearTimeout(expire); };
  }, [open, account, lockedKey, onOpenChange]);

  useEffect(() => {
    if (!state || state.frames.length < 2) return;
    const t = setInterval(() => setFrame(f => (f + 1) % state.frames.length), 300);
    return () => clearInterval(t);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>📲 Move to another device</DialogTitle>
          <DialogDescription>On the other device, open CHEESECrypt with {account}, choose “Receive from another device” and scan this code.</DialogDescription>
        </DialogHeader>
        <p className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">⚠️ Anyone who films this screen and sees the code below could copy your friends list. Your key stays locked to your Anchor wallet.</p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!state && !error && <p className="text-sm text-muted-foreground">Preparing…</p>}
        {state && <>
          <div className="mx-auto rounded-md bg-foreground p-3"><QRCodeSVG value={state.frames[frame]} size={240} level="L" bgColor="transparent" fgColor="hsl(var(--background))" /></div>
          <p className="text-center text-xs text-muted-foreground">Part {frame + 1} of {state.frames.length} · {state.summary.friends} friends · {state.summary.nicknames} nicknames · {state.summary.rooms} groups</p>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">One-time code</p>
            <p className="font-mono text-2xl tracking-widest text-cheese" aria-label="One-time code">{formatCode(state.code)}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => { void navigator.clipboard.writeText(state.frames.join('\n')).then(() => setCopied(true)); }}>
            {copied ? 'Copied — paste it on the other device' : 'No camera? Copy as text'}
          </Button>
          <p className="text-[11px] text-muted-foreground">Encrypted in your browser and shown only on this screen. Nothing goes on chain or to any server. This closes after 5 minutes; a new code is made each time.</p>
        </>}
        <div className="flex justify-end"><Button onClick={() => onOpenChange(false)}>Done</Button></div>
      </DialogContent>
    </Dialog>
  );
}
