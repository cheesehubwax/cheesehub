import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { checkHistoryEndpoint, saveCustomEndpoint, savePrivacyGateChoice, validateCustomEndpoint } from '@/lib/cryptNetworkPrivacy';

type GateMessage = { tone: 'ok' | 'bad'; text: string };

/** Shown before CHEESECrypt starts reading history on this browser. Presentational; the page decides when to show it. */
export function CryptPrivacyGate({ onDone }: { onDone: () => void }) {
  const [setup, setSetup] = useState(false);
  const [url, setUrl] = useState('http://localhost:8088');
  const [only, setOnly] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<GateMessage | null>(null);

  const usePublic = () => { savePrivacyGateChoice('public'); onDone(); };
  const usePrivate = async () => {
    const v = validateCustomEndpoint(url);
    if (!v) { setMsg({ tone: 'bad', text: 'Use an https:// address (or http://localhost:8088 for the helper on this computer).' }); return; }
    setBusy(true); setMsg(null);
    const result = await checkHistoryEndpoint(v);
    setBusy(false);
    if (!result.ok) { setMsg({ tone: 'bad', text: result.error ?? 'Connection failed. Nothing was saved.' }); return; }
    saveCustomEndpoint(v, only);
    // With the box unticked public servers stay reachable, so this device's choice is the public one.
    savePrivacyGateChoice(only ? 'private' : 'public');
    setMsg({
      tone: 'ok',
      text: only
        ? `Connected to ${v}. Only this server will be used — if it is off, nothing is read until it is back.`
        : `Connected to ${v}. Your server is asked first, with public servers as backup.`,
    });
  };

  return (
    <div className="rounded-lg border border-cheese/20 bg-card/80 p-6 space-y-4 max-w-lg text-sm text-muted-foreground">
      <h2 className="text-lg font-semibold text-cheese">🛡️ Before CHEESECrypt starts</h2>
      <p>If you want your messages read through your own Tor helper, set it up <span className="text-foreground font-medium">now</span>, before anything is downloaded.</p>
      {!setup ? (
        <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={() => setSetup(true)} className="bg-cheese text-primary-foreground hover:bg-cheese/90">Use my own server first</Button>
          <Button variant="outline" onClick={usePublic}>Continue with public servers</Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p>Start the helper (<code>node cheesecrypt-tor-proxy.mjs</code>) with Tor running. <strong>Its default address is already filled in below</strong> — it points to this computer, so everyone can use the same address.</p>
          <Input className="text-[hsl(var(--input-value-foreground))]" value={url} onChange={e => { setUrl(e.target.value); setMsg(null); }} aria-label="Your history server address" disabled={busy} />
          <Button size="sm" variant="outline" disabled={busy} onClick={() => { setUrl('http://localhost:8088'); setMsg(null); }}>Autofill Tor helper</Button>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={only} disabled={busy} onChange={e => { setOnly(e.target.checked); setMsg(null); }} />
            Use only this server (no public servers if it fails)
          </label>
          {only
            ? <p className="text-xs">Only this server will be used — if it is off, nothing is read until it is back.</p>
            : <p className="text-xs">Unticked: your server is asked first, with public servers as backup, so messages could still be read from them.</p>}
          {msg && <p role={msg.tone === 'ok' ? 'status' : 'alert'} className={msg.tone === 'ok' ? 'font-medium text-cheese' : 'text-destructive'}>{msg.text}</p>}
          <div className="flex flex-col sm:flex-row gap-2">
            {msg?.tone === 'ok'
              ? <Button onClick={onDone} className="bg-cheese text-primary-foreground hover:bg-cheese/90">Continue to CHEESECrypt</Button>
              : <Button onClick={() => void usePrivate()} disabled={busy} className="bg-cheese text-primary-foreground hover:bg-cheese/90">{busy ? 'Testing…' : 'Test this server'}</Button>}
            <Button variant="outline" onClick={() => { setSetup(false); setMsg(null); }} disabled={busy}>Back</Button>
          </div>
          <p className="text-xs">The helper download and full guide are in Privacy settings once you are in.</p>
        </div>
      )}
    </div>
  );
}
