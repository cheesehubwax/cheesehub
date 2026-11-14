import { useEffect, useState, type ReactNode } from 'react';
import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  type PrivacyMode, loadCustomEndpoint, loadCustomOnlyPreference, saveCustomOnlyPreference, saveCustomEndpoint, checkHistoryEndpoint, validateCustomEndpoint,
} from '@/lib/cryptNetworkPrivacy';
import { COLD_LOCK_WARNING, IDLE_OPTIONS, type IdleMinutes, type LockHardening } from '@/lib/cryptPanicLock';
import { CryptConfirmDialog } from './CryptConfirmDialog';
import type { CryptConfirm } from './CryptConfirmDialog';

const TOR_CHECK_COMMAND = 'curl.exe --socks5-hostname 127.0.0.1:9150 https://check.torproject.org/api/ip';

/** Network privacy settings. Presentational: the mode lives in the Messenger, the server setting on this device. */
export function CryptPrivacyDialog({ open, onOpenChange, mode, setMode, loadFullHistory, idleMinutes, setIdleMinutes, shieldOn, setShieldOn, hardening, setHardening, rotationSlot }: {
  open: boolean; onOpenChange: (v: boolean) => void; mode: PrivacyMode; setMode: (m: PrivacyMode) => void;
  loadFullHistory: () => Promise<void>;
  idleMinutes: IdleMinutes; setIdleMinutes: (m: IdleMinutes) => void; shieldOn: boolean; setShieldOn: (on: boolean) => void;
  hardening: LockHardening; setHardening: (h: LockHardening) => void; rotationSlot?: ReactNode;
}) {
  const [url, setUrl] = useState('');
  const [only, setOnly] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<CryptConfirm | null>(null);
  const [copyNote, setCopyNote] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const c = loadCustomEndpoint();
    setSaved(c); setUrl(c ?? ''); setOnly(loadCustomOnlyPreference()); setNote(null); setCopyNote(null);
  }, [open]);

  const save = async () => {
    const v = validateCustomEndpoint(url);
    if (!v) { setNote('Use an https:// address (or http://localhost for a server on this computer).'); return; }
    setBusy(true); setNote(null);
    const result = await checkHistoryEndpoint(v);
    setBusy(false);
    if (!result.ok) { setNote(result.error ?? 'Connection failed. Nothing was saved.'); return; }
    saveCustomEndpoint(v, only); setSaved(v); setNote(only
      ? 'Saved. Only your server is used; if it is off, nothing is read until it is back.'
      : 'Saved. Your server is asked first, with public servers as backup.');
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
                  {m === 0 ? 'Off' : m === 60 ? '1 hour' : m === 240 ? '4 hours' : `${m} min`}
                </Button>
              ))}
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={shieldOn} onChange={e => setShieldOn(e.target.checked)} />
              Blur messages when I switch tabs or minimise
            </label>
            <p>Locking always jumps to the CHEESEHub home page (Back won't return to the unlock screen) and signs your wallet out of the whole site, so a locked screen never hints at Crypt.</p>
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-1" checked={hardening.cold} onChange={e => {
                if (!e.target.checked) { setHardening({ ...hardening, cold: false }); return; }
                setConfirm({ title: '🧊 Turn on cold lock?', body: COLD_LOCK_WARNING, okLabel: 'I have my backup — turn on', run: () => setHardening({ ...hardening, cold: true }) });
              }} />
              <span>Cold lock: forget the saved key on this device <span className="block text-xs">Friends, nicknames, avatars and settings stay. {COLD_LOCK_WARNING}</span></span>
            </label>
          </section>
          {rotationSlot}
          <section className="space-y-2 rounded-md border border-border p-3">
            <h3 className="font-semibold text-foreground">Your own history server (optional)</h3>
            <p className="text-xs">The checkbox saves immediately. A new server is used only after Test &amp; connect succeeds.</p>
            <p>If you run your own WAX Hyperion server, or reach one through your own VPN or Tor setup, enter it here. It is stored only in this browser; nothing goes through CHEESEHub.</p>
            <Input value={url} onChange={e => setUrl(e.target.value)} disabled={busy} placeholder="https://my-node.example.com" aria-label="Custom history server" />
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={only} disabled={busy} onChange={e => {
                const on = e.target.checked;
                setOnly(on);
                saveCustomOnlyPreference(on);
                setNote(saved
                  ? on
                    ? 'Saved. Only your server is used; if it is off, nothing is read until it is back.'
                    : 'Saved. Your server is asked first, with public servers as backup.'
                  : 'Preference saved. No custom server is connected yet; public servers remain active until Test & connect succeeds.');
              }} />
              Use only this server (no public servers if it fails)
            </label>
            {only && !saved && <p className="text-xs">Only-server protection is not active yet. Test &amp; connect a server to activate it.</p>}
            <div className="flex gap-2">
              <Button size="sm" onClick={() => void save()} disabled={busy || !url.trim()}>{busy ? 'Testing…' : 'Test & connect server'}</Button>
              {saved && <Button size="sm" variant="outline" onClick={clear} disabled={busy}>Remove</Button>}
            </div>
            {note && <p role="status" className="text-foreground">{note}</p>}
            <details className="rounded-md border border-border p-2">
              <summary className="cursor-pointer font-semibold text-foreground">🧅 How to use Tor with CHEESECrypt (free helper)</summary>
              <div className="mt-2 space-y-2 text-xs">
                <p>A small open-source helper that runs only on your computer. It sends CHEESECrypt's history checks through Tor, so public WAX servers see a Tor address instead of your home IP. It is not a Tor relay, only accepts connections from your own computer, only forwards history reads, and keeps no logs. CHEESEHub never sees your traffic.</p>
                <ol className="list-decimal space-y-1 pl-4">
                  <li>Install <a className="text-cheese underline" href="https://nodejs.org" target="_blank" rel="noopener noreferrer">Node.js</a> (version 18 or newer) and <a className="text-cheese underline" href="https://www.torproject.org/download/" target="_blank" rel="noopener noreferrer">Tor Browser</a>.</li>
                  <li>Open Tor Browser and press Connect. Leave it open.</li>
                  <li><a className="text-cheese underline" href={`${import.meta.env.BASE_URL}downloads/cheesecrypt-tor-proxy.mjs`} download="cheesecrypt-tor-proxy.mjs">Download the helper</a> (one file, no installs needed). You can open it in any text editor to read it first.</li>
                  <li>Open a terminal in the folder you saved it to (Windows: right-click the folder → Open in Terminal) and run: <code className="rounded bg-muted px-1 text-foreground">node cheesecrypt-tor-proxy.mjs</code></li>
                  <li>Enter <code className="rounded bg-muted px-1 text-foreground">http://localhost:8088</code> in the box above and press Test &amp; connect. Tick "Use only this server" if you never want public servers used directly.</li>
                </ol>
                <div className="space-y-2 border-t border-border pt-2">
                  <h4 className="font-semibold text-foreground">Verify Tor is working</h4>
                  <p>With Tor Browser connected, paste this into Windows Terminal or PowerShell and press Enter:</p>
                  <div className="flex items-start gap-2">
                    <code className="min-w-0 flex-1 break-all rounded bg-muted p-2 text-foreground">{TOR_CHECK_COMMAND}</code>
                    <Button size="icon" variant="outline" className="shrink-0" aria-label="Copy Tor check command" title="Copy Tor check command" onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(TOR_CHECK_COMMAND);
                        setCopyNote('Command copied.');
                      } catch {
                        setCopyNote('Could not copy. Select the command and copy it manually.');
                      }
                    }}><Copy className="h-4 w-4" /></Button>
                  </div>
                  {copyNote && <p role="status" className="text-foreground">{copyNote}</p>}
                  <p>On macOS or Linux, use <code className="text-foreground">curl</code> instead of <code className="text-foreground">curl.exe</code>. For a background Tor service, change <code className="text-foreground">9150</code> to <code className="text-foreground">9050</code>.</p>
                  <p>The Tor Project should return <code className="text-foreground">"IsTor": true</code> and an <code className="text-foreground">"IP"</code> showing the Tor exit address. If it returns false or an error, this check has not confirmed Tor is working.</p>
                  <p>This checks the command's connection through Tor, not CHEESECrypt's helper or every app request. Keep the helper running, connect it above, and tick "Use only this server" to prevent direct public-history fallback. Wallet broadcasts and other traffic may still expose your normal IP; this check does not prove anonymity.</p>
                </div>
                <p>If you downloaded an older helper, stop it with Ctrl+C and replace the file with this download (v1.1). Keep the terminal window open while you chat; press Ctrl+C to stop. Testing can take up to 40 seconds while slow servers are skipped. If localhost fails, try http://127.0.0.1:8088 and allow local-network access if your browser asks. Tor protects these history requests only, not all CHEESEHub traffic. Using Tor as a client is legal in many countries, but rules and restrictions vary; this is not legal advice. Sending messages still goes through your wallet, not this helper.</p>
              </div>
            </details>
          </section>
          <p className="text-xs">Servers still see your internet address. A VPN or Tor hides it. Sending, looking up a friend's key, and the public record of who messaged whom still show your account.</p>
          <div className="flex justify-end">
            <Button onClick={() => onOpenChange(false)} disabled={busy}>Done</Button>
          </div>
        </div>
      </DialogContent>
      <CryptConfirmDialog confirm={confirm} onClose={() => setConfirm(null)} />
    </Dialog>
  );
}
