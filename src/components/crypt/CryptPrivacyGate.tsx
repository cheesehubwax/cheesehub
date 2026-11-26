import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { checkHistoryEndpoint, saveCustomEndpoint, savePrivacyGateChoice, validateCustomEndpoint } from '@/lib/cryptNetworkPrivacy';

/** Shown before CHEESECrypt starts reading history on this browser. Presentational; the page decides when to show it. */
export function CryptPrivacyGate({ onDone }: { onDone: () => void }) {
  const [setup, setSetup] = useState(false);
  const [url, setUrl] = useState('http://127.0.0.1:8088');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const usePublic = () => { savePrivacyGateChoice('public'); onDone(); };
  const usePrivate = async () => {
    const v = validateCustomEndpoint(url);
    if (!v) { setNote('Use an https:// address (or http://127.0.0.1 for the helper on this computer).'); return; }
    setBusy(true); setNote(null);
    const result = await checkHistoryEndpoint(v);
    setBusy(false);
    if (!result.ok) { setNote(result.error ?? 'Connection failed. Nothing was saved.'); return; }
    saveCustomEndpoint(v, true);
    savePrivacyGateChoice('private');
    onDone();
  };

  return (
    <div className="rounded-lg border border-cheese/20 bg-card/80 p-6 space-y-4 max-w-lg text-sm text-muted-foreground">
      <h2 className="text-lg font-semibold text-cheese">🛡️ Before CHEESECrypt starts</h2>
      <p>When CHEESECrypt opens, it downloads your messages from public WAX history servers. Those servers can see your internet (IP) address and the account being looked up. Once that happens it can't be undone.</p>
      <p>If you want your messages read through your own Tor helper, set it up <span className="text-foreground font-medium">now</span>, before anything is downloaded.</p>
      {!setup ? (
        <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={() => setSetup(true)} className="bg-cheese text-primary-foreground hover:bg-cheese/90">Use my own server first</Button>
          <Button variant="outline" onClick={usePublic}>Continue with public servers</Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p>Start the helper (<code>node cheesecrypt-tor-proxy.mjs</code>) with Tor running, then enter its address. Only this server will be used — if it is off, nothing is read until it is back.</p>
          <Input value={url} onChange={e => setUrl(e.target.value)} aria-label="Your history server address" disabled={busy} />
          {note && <p role="alert" className="text-destructive">{note}</p>}
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={() => void usePrivate()} disabled={busy} className="bg-cheese text-primary-foreground hover:bg-cheese/90">{busy ? 'Testing…' : 'Test and use only this server'}</Button>
            <Button variant="outline" onClick={() => { setSetup(false); setNote(null); }} disabled={busy}>Back</Button>
          </div>
          <p className="text-xs">The helper download and full guide are in Privacy settings once you are in.</p>
        </div>
      )}
      <p className="text-xs">This protects CHEESECrypt's message downloads. Your wallet sign-in, fee/resource services and the rest of CHEESEHub can still use your normal connection, and what you send on-chain is public. You can change this later in Privacy settings.</p>
    </div>
  );
}
