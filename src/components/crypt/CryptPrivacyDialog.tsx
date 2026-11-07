import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  type PrivacyMode, loadCustomEndpoint, loadCustomOnly, saveCustomEndpoint, testHistoryEndpoint, validateCustomEndpoint,
} from '@/lib/cryptNetworkPrivacy';
import { IDLE_OPTIONS, type IdleMinutes } from '@/lib/cryptPanicLock';

/** Network privacy settings. Presentational: the mode lives in the Messenger, the server setting on this device. */
export function CryptPrivacyDialog({ open, onOpenChange, mode, setMode, loadFullHistory, idleMinutes, setIdleMinutes, shieldOn, setShieldOn }: {
  open: boolean; onOpenChange: (v: boolean) => void; mode: PrivacyMode; setMode: (m: PrivacyMode) => void;
  loadFullHistory: () => Promise<void>;
  idleMinutes: IdleMinutes; setIdleMinutes: (m: IdleMinutes) => void; shieldOn: boolean; setShieldOn: (on: boolean) => void;
}) {
  const [url, setUrl] = useState('');
  const [only, setOnly] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const c = loadCustomEndpoint();
    setSaved(c); setUrl(c ?? ''); setOnly(loadCustomOnly()); setNote(null);
  }, [open]);

  const save = async () => {
    const v = validateCustomEndpoint(url);
    if (!v) { setNote('Use an https:// address (or http://localhost for a server on this computer).'); return; }
    setBusy(true); setNote(null);
    const ok = await testHistoryEndpoint(v);
    setBusy(false);
    if (!ok) { setNote('That server did not answer like a WAX history (Hyperion) server. Nothing was saved.'); return; }
    saveCustomEndpoint(v, only); setSaved(v); setNote('Saved. CHEESECrypt now asks this server first.');
  };
  const clear = () => { saveCustomEndpoint(null, false); setSaved(null); setUrl(''); setOnly(false); setNote('Removed. Public servers are used again.'); };

  const modeBtn = (m: PrivacyMode, label: string) => (
    <Button size="sm" variant={mode === m ? 'default' : 'outline'} onClick={() => setMode(m)} aria-pressed={mode === m}>{label}</Button>
  );

  return (
    <Dialog open={open} onOpenChange={v => { if (!busy) onOpenChange(v); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>🛡️ Network privacy</DialogTitle></DialogHeader>
        <div className="space-y-4 text-sm text-muted-foreground">
          <p>While a chat is open, CHEESECrypt checks for new messages by reading all crypt.cheese activity — the same request every user makes — and keeps only yours on this device. The history server can't tell which account you are watching.</p>
          <section className="space-y-2">
            <h3 className="font-semibold text-foreground">Mode</h3>
            <div className="flex gap-2">{modeBtn('standard', 'Standard')}{modeBtn('maximum', 'Maximum')}</div>
            {mode === 'standard'
              ? <p>Opening CHEESECrypt asks for your account's history once (fast, complete). After that, checks never name your account.</p>
              : <p>Opening CHEESECrypt also reads only shared crypt.cheese activity, so your account is never named. It is slower to open and may not reach older messages, or messages sent before CHEESECrypt used the crypt.cheese contract.</p>}
            {mode === 'maximum' && (
              <Button size="sm" variant="outline" disabled={busy} onClick={async () => { setBusy(true); try { await loadFullHistory(); } finally { setBusy(false); } }}>
                Load older history once (tells the server your account)
              </Button>
            )}
          </section>
          <section className="space-y-2">
            <h3 className="font-semibold text-foreground">🔒 Screen shield &amp; panic lock</h3>
            <p>Press 🔒 Lock now, Esc twice quickly, or Ctrl/Cmd+Shift+L to clear the screen instantly. Unlocking again is one free Anchor signature.</p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-foreground">Auto-lock after</span>
              {IDLE_OPTIONS.map(m => (
                <Button key={m} size="sm" variant={idleMinutes === m ? 'default' : 'outline'} aria-pressed={idleMinutes === m} onClick={() => setIdleMinutes(m)}>
                  {m === 0 ? 'Off' : m === 60 ? '1 hour' : `${m} min`}
                </Button>
              ))}
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={shieldOn} onChange={e => setShieldOn(e.target.checked)} />
              Blur messages when I switch tabs or minimise
            </label>
          </section>
          <section className="space-y-2 rounded-md border border-border p-3">
            <h3 className="font-semibold text-foreground">Your own history server (optional)</h3>
            <p className="text-xs">The settings above save as soon as you tap them. The button below is only for this server box.</p>
            <p>If you run your own WAX Hyperion server, or reach one through your own VPN or Tor setup, enter it here. It is stored only in this browser; nothing goes through CHEESEHub.</p>
            <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://my-node.example.com" aria-label="Custom history server" />
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={only} onChange={e => setOnly(e.target.checked)} />
              Use only this server (no public servers if it fails)
            </label>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => void save()} disabled={busy || !url.trim()}>{busy ? 'Testing…' : 'Test & connect server'}</Button>
              {saved && <Button size="sm" variant="outline" onClick={clear} disabled={busy}>Remove</Button>}
            </div>
            {note && <p role="status" className="text-foreground">{note}</p>}
          </section>
          <p className="text-xs">Servers still see your internet address. A VPN or Tor hides it. Sending, looking up a friend's key, and the public record of who messaged whom still show your account.</p>
          <div className="flex justify-end">
            <Button onClick={() => onOpenChange(false)} disabled={busy}>Done</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
