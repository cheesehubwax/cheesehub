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
      {!setup ? (
        <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={() => setSetup(true)} className="bg-cheese text-primary-foreground hover:bg-cheese/90">Configure my own server (Recommended)</Button>
          <Button variant="outline" onClick={usePublic}>Continue with public servers</Button>
        </div>
      ) : (
        <div className="space-y-3">
          <Input value={url} onChange={e => setUrl(e.target.value)} aria-label="Your history server address" disabled={busy} />
          {note && <p role="alert" className="text-destructive">{note}</p>}
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={() => void usePrivate()} disabled={busy} className="bg-cheese text-primary-foreground hover:bg-cheese/90">{busy ? 'Testing…' : 'Test and use only this server'}</Button>
            <Button variant="outline" onClick={() => { setSetup(false); setNote(null); }} disabled={busy}>Back</Button>
          </div>
        </div>
      )}
    </div>
  );
}
