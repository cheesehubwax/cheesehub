import { useEffect, useRef, useState } from 'react';
import { PrivateKey } from '@wharfkit/session';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cryptChainPost } from '@/lib/cryptChainRead';
import { buildNightDownload, downloadNightConfig, downloadNightJson, loadNightFiles, nightSetupActions, saveNightFolder, type NightAccount, type NightChainAccount, type NightSettings } from '@/lib/cryptNightcrawler';
import type { NightRunnerConfig } from '../../../scripts/synthetic-test/policy';
import { vaultSupported, type DirHandle } from '@/lib/cryptVault';

export type NightExecute = (actions: unknown[], options?: { successTitle?: string }) => Promise<{ success: boolean; txId: string | null; error?: Error }>;

/** Mounted only while Privacy is open: signing secrets are never persisted in the browser. */
export function CryptNightcrawler({ account, canSetup, execute, vault }: { account: string; canSetup: boolean; execute: NightExecute; vault: DirHandle | null }) {
  const [rows, setRows] = useState<NightAccount[]>([{ account, permission: 'nightcrawler', privateKey: '' }, { account: '', permission: 'nightcrawler', privateKey: '' }]);
  const [settings, setSettings] = useState<NightSettings>(() => ({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', start: '23:00', end: '06:30', sendsMin: 1, sendsMax: 3, enabled: false, replies: true }));
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [config, setConfig] = useState<NightRunnerConfig | null>(null);
  const [files, setFiles] = useState<Record<string, string> | null>(null);
  const [setupConfirm, setSetupConfirm] = useState<number | null>(null);
  const pending = useRef(new Map<number, string>());
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; pending.current.clear(); }; }, []);
  const invalidate = () => { setConfig(null); setNote(''); setSetupConfirm(null); };
  const updateRow = (i: number, field: keyof NightAccount, value: string) => { invalidate(); pending.current.delete(i); setRows(rows.map((r, j) => j === i ? { ...r, [field]: value } : r)); };
  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setNote('');
    try { await fn(); } catch (e) { if (alive.current) setNote(e instanceof Error ? e.message : 'Could not complete setup.'); }
    finally { if (alive.current) setBusy(false); }
  };
  const link = (i: number) => run(async () => {
    const row = rows[i];
    if (!row || row.account !== account || !canSetup) throw new Error('Sign in with this account in Anchor to link its permission.');
    const key = pending.current.get(i) ?? PrivateKey.generate('K1').toString();
    pending.current.set(i, key); // Retain after ambiguous wallet outcomes so the new key can be recovered.
    if (alive.current) setRows(current => current.map((r, j) => j === i ? { ...r, privateKey: key } : r));
    const raw = await cryptChainPost<NightChainAccount>('/v1/chain/get_account', { account_name: row.account });
    const actions = nightSetupActions(raw, row.account, row.permission, PrivateKey.from(key).toPublic().toString());
    if (!alive.current) return;
    const result = await execute(actions, { successTitle: 'Nightcrawler permission linked' });
    if (!alive.current) return;
    if (!result.success || !result.txId) throw new Error('Permission setup was not confirmed. Keep this restricted key and check your account before retrying.');
    setSetupConfirm(null); setNote('Permission linked. Keep this restricted key; verify both accounts before saving.');
  });
  const saveFolder = () => run(async () => {
    if (!config || !files) return;
    const picker = (window as unknown as { showDirectoryPicker?: (opts: { mode: string; id: string }) => Promise<DirHandle> }).showDirectoryPicker;
    if (!picker) throw new Error('Folder access is unavailable. Download the ZIP and configuration instead.');
    // Request browser permission during this click, before any network work.
    const usableVault = vault && !['friends', 'my private key', 'my private keys', 'private key', 'private keys'].includes(vault.name.toLowerCase()) ? vault : null;
    const picked = usableVault ?? await picker({ mode: 'readwrite', id: 'cheesecrypt-nightcrawler' });
    if (picked.requestPermission && await picked.requestPermission({ mode: 'readwrite' }) !== 'granted') throw new Error('Folder permission was not granted.');
    await saveNightFolder(picked, files, config);
    if (alive.current) setNote('Saved to nightcrawler inside your chosen CHEESECrypt folder. Nothing has started.');
  });

  return <section className="space-y-3">
    <p className="text-xs">Optional, local-only synthetic messages between accounts you own—not readable conversations. The website never runs it. Random timing does not guarantee anonymity.</p>
    <fieldset disabled={busy} className="space-y-3">
      {rows.map((row, i) => <div key={i} className="space-y-2">
        <h4 className="font-medium text-foreground">{i === 0 ? 'Your sending account' : 'Your companion account'}</h4>
        <label className="block text-xs">WAX account<Input value={row.account} onChange={e => updateRow(i, 'account', e.target.value)} aria-label={`Nightcrawler account ${i + 1}`} /></label>
        <label className="block text-xs">Restricted permission<Input value={row.permission} onChange={e => updateRow(i, 'permission', e.target.value)} aria-label={`Nightcrawler permission ${i + 1}`} /></label>
        <label className="block text-xs">Restricted private key<Input type="password" autoComplete="off" spellCheck={false} value={row.privateKey} onChange={e => updateRow(i, 'privateKey', e.target.value)} aria-label={`Nightcrawler private key ${i + 1}`} /></label>
        {row.account === account && canSetup && <Button size="sm" variant="outline" className="h-auto min-h-9 max-w-full whitespace-normal py-2" onClick={() => setSetupConfirm(i)}>🔗 Create sendfree-only permission (Anchor)</Button>}
        {pending.current.has(i) && <div className="space-y-1 text-xs">
          <Button size="sm" variant="outline" className="h-auto min-h-9 max-w-full whitespace-normal py-2" onClick={() => downloadNightJson(`${row.account}-nightcrawler-signing-key.json`, row)}>⬇ Save generated signing key</Button>
          <p>Save this private key before closing Privacy or changing accounts. It is cleared from this form when Privacy closes. If setup was not confirmed, check the on-chain permission before retrying.</p>
        </div>}
        {setupConfirm === i && <div className="space-y-2 text-xs">
          <p>Anchor will add a new key for {row.account}, linked only to crypt.cheese::sendfree. Existing permissions and Instant Messaging links will not be replaced. Your account needs CPU and free RAM; no tokens are transferred.</p>
          <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => void link(i)}>Confirm &amp; open Anchor</Button><Button size="sm" variant="outline" onClick={() => setSetupConfirm(null)}>Cancel</Button></div>
        </div>}
      </div>)}
      <p className="text-xs">Already use cheesecrypt? Enter that permission and its isolated key. Do not reuse an Instant Messaging key. To create the companion’s permission here, sign in as that account first.</p>
      <label className="block text-xs">Timezone<Input value={settings.timezone} onChange={e => { invalidate(); setSettings({ ...settings, timezone: e.target.value }); }} aria-label="Nightcrawler timezone" /></label>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs">From<Input type="time" value={settings.start} onChange={e => { invalidate(); setSettings({ ...settings, start: e.target.value }); }} aria-label="Nightcrawler start" /></label>
        <label className="text-xs">Until<Input type="time" value={settings.end} onChange={e => { invalidate(); setSettings({ ...settings, end: e.target.value }); }} aria-label="Nightcrawler end" /></label>
        <label className="text-xs">Minimum sends<Input type="number" min={0} max={20} value={settings.sendsMin} onChange={e => { invalidate(); setSettings({ ...settings, sendsMin: Number(e.target.value) }); }} aria-label="Nightcrawler minimum sends" /></label>
        <label className="text-xs">Maximum sends<Input type="number" min={0} max={20} value={settings.sendsMax} onChange={e => { invalidate(); setSettings({ ...settings, sendsMax: Number(e.target.value) }); }} aria-label="Nightcrawler maximum sends" /></label>
      </div>
      <label className="flex gap-2 text-xs"><input type="checkbox" checked={settings.replies} onChange={e => { invalidate(); setSettings({ ...settings, replies: e.target.checked }); }} />Allow companion replies</label>
      <label className="flex gap-2 text-xs"><input type="checkbox" checked={settings.enabled} onChange={e => { invalidate(); setSettings({ ...settings, enabled: e.target.checked }); }} />Enable in exported configuration</label>
      <p className="text-xs">Off by default. This setting does not switch a running local copy on or off. Stop it with Ctrl+C before editing its configuration; keep its progress files. Start with bun run start.</p>
      <label className="flex items-start gap-2 text-xs"><input type="checkbox" className="mt-1" checked={consent} onChange={e => { invalidate(); setConsent(e.target.checked); }} /><span>I own both accounts and understand this file contains unencrypted signing keys. Keep it private, outside shared or synced folders. A stolen key can impersonate messages and consume resources; sendfree-only authority cannot transfer tokens.</span></label>
      <Button size="sm" className="h-auto min-h-9 max-w-full whitespace-normal py-2" disabled={!consent || rows.some(r => !r.account || !r.privateKey || !r.permission)} onClick={() => void run(async () => {
        const [next, sources] = await Promise.all([buildNightDownload(rows, settings), loadNightFiles()]);
        if (!alive.current) return;
        setConfig(next); setFiles(sources); setNote('Both restricted keys verified. Ready to save; nothing has started.');
      })}>{busy ? 'Checking…' : '✓ Verify & prepare configuration'}</Button>
    </fieldset>
    {config && <div className="flex flex-wrap gap-2">
      <Button size="sm" disabled={busy} onClick={() => downloadNightConfig(config)}>⬇ Download night-config.json</Button>
      {vaultSupported() && <Button size="sm" variant="outline" disabled={busy || !files} onClick={() => void saveFolder()}>📁 Save Nightcrawler folder</Button>}
    </div>}
    <Button size="sm" variant="outline" asChild><a href={`${import.meta.env.BASE_URL}downloads/cheesecrypt-nightcrawler.zip`} download="cheesecrypt-nightcrawler.zip">⬇ Download Nightcrawler ZIP</a></Button>
    <p className="text-xs">Extract the ZIP into cheesecrypt/nightcrawler and save night-config.json there. Install Bun from <a className="text-cheese underline" href="https://bun.sh" target="_blank" rel="noopener noreferrer">bun.sh</a>, then run bun install once, bun run check to test, and bun run start to begin. Keep Tor Browser, the helper and your computer awake. Folder saving is available only in supported browsers outside the preview.</p>
    <p className="text-xs">Only free messages: unavailable sponsorship or CPU skips sends. No paid fallback or automatic powerups. Local preparation reads still reveal IP/account names to chain nodes; broadcasts use the Tor helper.</p>
    {note && <p role="status" className="text-xs text-foreground break-words">{note}</p>}
  </section>;
}