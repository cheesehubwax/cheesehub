import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { decryptFrames, FrameCollector, mergeBundle, summarize, type TransferBundle } from '@/lib/cryptDeviceTransfer';
import { saveLockedEnvelope } from '@/lib/cryptKeyLock';

type Detector = { detect(src: CanvasImageSource): Promise<{ rawValue: string }[]> };

/** Scans the cycling QR frames (or pasted text), asks for the one-time code and merges into this device. */
export function DeviceTransferReceiveDialog({ open, onOpenChange, account, onImported }: {
  open: boolean; onOpenChange: (v: boolean) => void; account: string; onImported: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const collector = useRef(new FrameCollector());
  const [progress, setProgress] = useState({ have: 0, total: 0 });
  const [frames, setFrames] = useState<string[] | null>(null);
  const [pasted, setPasted] = useState('');
  const [pasteMode, setPasteMode] = useState(false);
  const [camError, setCamError] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [bundle, setBundle] = useState<TransferBundle | null>(null);

  useEffect(() => {
    collector.current = new FrameCollector();
    setProgress({ have: 0, total: 0 }); setFrames(null); setPasted(''); setPasteMode(false); setCamError(''); setCode(''); setError(''); setBundle(null);
  }, [open]);

  const scanning = open && !frames && !pasteMode;
  useEffect(() => {
    if (!scanning) return;
    let stream: MediaStream | null = null, timer = 0, alive = true;
    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d', { willReadFrequently: true });
    const Native = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
    const detector = Native ? new Native({ formats: ['qr_code'] }) : null;
    const tick = async () => {
      const v = videoRef.current;
      if (!alive) return;
      if (v && v.readyState >= 2 && ctx) {
        let text: string | null = null;
        try {
          if (detector) text = (await detector.detect(v))[0]?.rawValue ?? null;
          else {
            canvas.width = v.videoWidth; canvas.height = v.videoHeight;
            ctx.drawImage(v, 0, 0);
            text = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height)?.data ?? null;
          }
        } catch { /* keep scanning */ }
        const c = collector.current;
        if (text && c.add(text)) {
          setProgress({ have: c.parts.size, total: c.total });
          if (c.complete) { setFrames(Array.from(c.parts.keys()).sort((a, b) => a - b).map(n => `CXFER1:${c.id}:${c.account}:${n}/${c.total}:${c.parts.get(n)}`)); return; }
        }
      }
      timer = window.setTimeout(() => void tick(), 120);
    };
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then(s => { if (!alive) { s.getTracks().forEach(t => t.stop()); return; } stream = s; if (videoRef.current) { videoRef.current.srcObject = s; void videoRef.current.play(); } void tick(); })
      .catch(() => setCamError('The camera could not be opened. Allow camera access, or paste the text instead.'));
    if (!navigator.mediaDevices) setCamError('This browser has no camera access here. Paste the text instead.');
    return () => { alive = false; clearTimeout(timer); stream?.getTracks().forEach(t => t.stop()); };
  }, [scanning]);

  const unlock = async () => {
    const input = frames ?? [pasted];
    setBusy(true); setError('');
    try { setBundle(await decryptFrames(input, code, account)); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const doImport = () => {
    if (!bundle) return;
    mergeBundle(bundle);
    saveLockedEnvelope(bundle.lockedKey);
    onImported();
  };

  const s = bundle && summarize(bundle);
  const ready = !!frames || (pasteMode && pasted.trim().length > 0);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>📷 Receive from another device</DialogTitle>
          <DialogDescription>On your other device choose “Move to another device”, then scan the moving code shown there.</DialogDescription>
        </DialogHeader>
        {bundle && s ? <>
          <p className="text-sm">Account <strong>{bundle.account}</strong> · {s.friends} friends · {s.nicknames} nicknames · {s.rooms} groups · {s.blocked} blocked</p>
          <p className="text-xs text-muted-foreground">These are added to anything already on this device; nothing here is wiped. Next, Anchor asks for the usual free unlock.</p>
          <Button className="bg-cheese text-primary-foreground hover:bg-cheese/90" onClick={doImport}>Import</Button>
        </> : <>
          {scanning && <>
            <video ref={videoRef} muted playsInline className="w-full rounded-md bg-muted aspect-square object-cover" />
            {progress.total > 0 && <><Progress value={(progress.have / progress.total) * 100} /><p className="text-center text-xs text-muted-foreground">{progress.have} of {progress.total}</p></>}
            {camError && <p className="text-xs text-destructive">{camError}</p>}
            <Button variant="ghost" size="sm" onClick={() => setPasteMode(true)}>Paste text instead</Button>
          </>}
          {pasteMode && !frames && <Textarea rows={4} value={pasted} onChange={e => setPasted(e.target.value)} placeholder="Paste the copied transfer text" className="font-mono text-xs" />}
          {frames && <p className="text-sm text-muted-foreground">✅ All parts received.</p>}
          {ready && <>
            <Input value={code} onChange={e => setCode(e.target.value)} placeholder="One-time code, e.g. K7QM-4XRA-92TF" autoComplete="off" className="font-mono uppercase" aria-label="One-time code" />
            <Button disabled={busy || code.replace(/[^a-z0-9]/gi, '').length !== 12} onClick={() => void unlock()}>{busy ? 'Checking…' : 'Continue'}</Button>
          </>}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </>}
      </DialogContent>
    </Dialog>
  );
}
