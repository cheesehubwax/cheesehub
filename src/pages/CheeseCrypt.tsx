// CHEESECrypt — encrypted on-chain messages paid in CHEESE.
// Intentionally not linked from the header or menus: reachable at /crypt only.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Layout } from '@/components/Layout';
import { OpenMojiIcon } from '@/components/OpenMojiIcon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TermsCheckbox } from '@/components/shared/TermsCheckbox';
import { ChevronDown, RefreshCw } from 'lucide-react';
import { useWax } from '@/context/WaxContext';
import { useWaxTransaction } from '@/hooks/useWaxTransaction';
import { useToast } from '@/hooks/use-toast';
import { playRandomFart } from '@/lib/fartSounds';
import { cn } from '@/lib/utils';
import {
  ChainMemo, MAX_PLAINTEXT_BYTES, MESSAGE_FEE_QUANTITY, MESSAGE_RECIPIENT_QUANTITY, MESSAGE_TOTAL_QUANTITY, MessagingKey,
  buildPublishKeyActions, buildSendMessageActions, decryptMemo, encryptMemo, fetchMessages, generateKey,
  loadContacts, loadKey, lookupPublishedKey, parseKeyFile, plaintextBytes, saveContact, saveKey, toPublicFile,
} from '@/lib/cheeseCrypt';

const ACCOUNT_RE = /^[a-z1-5.]{1,12}$/;

function download(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

const CheeseCrypt = () => {
  const { accountName, isConnected, login, session } = useWax();

  return (
    <Layout>
      <section className="relative pt-20 pb-14 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
        <div className="container relative z-10">
          <div className="flex flex-col items-center gap-8">
            <div className="h-32 w-32 animate-float cheese-bubble rounded-full flex items-center justify-center cursor-pointer" onClick={playRandomFart}>
              <OpenMojiIcon emoji="🔐" size={72} />
            </div>
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center gap-2">
                <OpenMojiIcon emoji="🔐" size={26} />
                <h1 className="text-3xl md:text-4xl font-bold">
                  <span className="text-cheese">CHEESE</span>
                  <span className="text-foreground">Crypt</span>
                </h1>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cheese/20 text-cheese border border-cheese/30 leading-none">BETA</span>
                <OpenMojiIcon emoji="🔐" size={26} />
              </div>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Encrypted messages sent on the WAX blockchain with CHEESE. Anyone can see that a message was sent —
                only you and the other person can read it.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="container pb-12 flex flex-col items-center max-w-5xl">
        {!isConnected || !accountName || !session ? (
          <div className="rounded-lg border border-cheese/20 bg-card/80 p-8 text-center space-y-4 max-w-md">
            <p className="text-muted-foreground">Connect your WAX wallet to read and send encrypted messages.</p>
            <Button onClick={login} className="bg-cheese text-primary-foreground hover:bg-cheese/90">Connect wallet</Button>
          </div>
        ) : (
          <Messenger key={accountName} account={accountName} session={session} />
        )}
      </div>
    </Layout>
  );
};

function Messenger({ account, session }: { account: string; session: NonNullable<ReturnType<typeof useWax>['session']> }) {
  const { toast } = useToast();
  const { executeTransaction } = useWaxTransaction(session);
  const permission = session.permissionLevel;
  const [key, setKey] = useState<MessagingKey | null>(() => loadKey(account));
  const [contacts, setContacts] = useState<Record<string, string>>(() => loadContacts(account));
  const [active, setActive] = useState<string | null>(null);
  const [newContact, setNewContact] = useState('');
  const [memos, setMemos] = useState<ChainMemo[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLLIElement>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try { setMemos(await fetchMessages(account)); }
    catch { toast({ title: 'Could not load messages', description: 'History servers did not answer. Try again shortly.', variant: 'destructive' }); }
    finally { setLoading(false); }
  }, [account, toast]);

  useEffect(() => { if (key) refresh(); }, [key, refresh]);

  const partners = useMemo(() => {
    const s = new Set(Object.keys(contacts));
    memos.forEach((m) => s.add(m.from === account ? m.to : m.from));
    return [...s].sort();
  }, [contacts, memos, account]);

  const lastAt = useMemo(() => {
    const out: Record<string, number> = {};
    memos.forEach((m) => { const p = m.from === account ? m.to : m.from; out[p] = Math.max(out[p] ?? 0, m.time); });
    return out;
  }, [memos, account]);

  const thread = useMemo(() => {
    if (!active) return [];
    const pub = contacts[active];
    return memos
      .filter((m) => (m.from === account && m.to === active) || (m.from === active && m.to === account))
      .map((m) => ({ ...m, text: pub && key ? decryptMemo(m.memo, pub, key.secretKey) : null }))
      .sort((a, b) => a.time - b.time);
  }, [active, memos, contacts, key, account]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [thread.length, active]);

  const makeKey = () => {
    if (key && !confirm('Replace your existing key? Messages encrypted with the old key can no longer be read unless you kept its file.')) return;
    const k = generateKey(account);
    saveKey(k); setKey(k);
    download(`${account}-cheesecrypt-key-PRIVATE.json`, k);
    toast({ title: 'Messaging key created', description: 'A private backup file was downloaded. Keep it safe and never share it.' });
  };

  const addContact = async () => {
    const name = newContact.trim().toLowerCase();
    if (!ACCOUNT_RE.test(name) || name === account) { toast({ title: 'Enter a valid WAX account', variant: 'destructive' }); return; }
    setBusy(true);
    try {
      const pub = await lookupPublishedKey(name);
      if (!pub) { toast({ title: `${name} has not published a key`, description: 'Ask them for their public key file and load it here.' }); return; }
      saveContact(account, name, pub); setContacts(loadContacts(account)); setActive(name); setNewContact('');
      toast({ title: `Found ${name}'s key` });
    } catch { toast({ title: 'Key lookup failed', variant: 'destructive' }); }
    finally { setBusy(false); }
  };

  const onFile = async (f: File) => {
    try {
      const parsed = parseKeyFile(JSON.parse(await f.text()));
      if (!parsed) throw new Error();
      if (parsed.type === 'gpk-msg-key') {
        if (parsed.account !== account) { toast({ title: `That private key belongs to ${parsed.account}`, variant: 'destructive' }); return; }
        saveKey(parsed); setKey(parsed); toast({ title: 'Your messaging key was loaded' });
      } else {
        if (parsed.account === account) { toast({ title: 'That is your own public key' }); return; }
        saveContact(account, parsed.account, parsed.publicKey); setContacts(loadContacts(account)); setActive(parsed.account);
        toast({ title: `Added ${parsed.account}` });
      }
    } catch { toast({ title: 'Not a messaging key file', variant: 'destructive' }); }
  };

  const publish = async () => {
    if (!key) return;
    if (!agreed) { toast({ title: 'Please agree to the Terms of Use first', variant: 'destructive' }); return; }
    setBusy(true);
    try { await executeTransaction(buildPublishKeyActions(account, key.publicKey, [permission]), { successTitle: 'Public key published' }); }
    finally { setBusy(false); }
  };

  const send = async () => {
    if (!key || !active || !contacts[active] || !agreed) return;
    setBusy(true);
    try {
      const memo = encryptMemo(text, contacts[active], key.secretKey);
      const r = await executeTransaction(buildSendMessageActions(account, active, memo, [permission]), { successTitle: 'Message sent' });
      if (r.success) { setText(''); setTimeout(refresh, 3000); }
    } catch (e) { toast({ title: 'Could not send', description: (e as Error).message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };

  const bytes = plaintextBytes(text);
  const fileInput = (
    <input ref={fileRef} type="file" accept="application/json,.json" className="hidden"
      onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
  );

  if (!key) {
    return (
      <div className="w-full max-w-md space-y-5 text-center">
        {fileInput}
        <div className="space-y-2">
          <p className="text-lg font-semibold">🔑 Unlock your messages</p>
          <p className="text-sm text-muted-foreground">
            Messages for <span className="font-semibold text-cheese">{account}</span> are encrypted. Load your private key file first —
            it stays on this device and is never sent anywhere.
          </p>
        </div>
        <div className="rounded-lg border border-cheese/40 bg-card/80 p-4 space-y-2 text-left">
          <p className="font-semibold text-sm">I already have a key</p>
          <p className="text-xs text-muted-foreground">Look in your Downloads for a file ending in <span className="font-mono">-key-PRIVATE.json</span>. Keys from the GPK Collection Manager work too.</p>
          <Button className="w-full bg-cheese text-primary-foreground hover:bg-cheese/90" onClick={() => fileRef.current?.click()}>Load my private key</Button>
        </div>
        <div className="rounded-lg border border-border bg-card/80 p-4 space-y-2 text-left">
          <p className="font-semibold text-sm">I'm new here</p>
          <p className="text-xs text-muted-foreground">Creates a new key and downloads a private backup file. Keep it safe. A new key cannot read messages sent to an older one.</p>
          <Button className="w-full" variant="outline" onClick={makeKey}>Create a new key</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-lg border border-cheese/20 bg-card/80 overflow-hidden grid md:grid-cols-[240px_1fr] h-[70dvh] min-h-[480px]">
      {fileInput}
      <aside className="border-b md:border-b-0 md:border-r border-border flex flex-col min-h-0">
        <div className="p-3 space-y-2 border-b border-border">
          <div className="flex gap-2">
            <Input className="h-9" value={newContact} onChange={(e) => setNewContact(e.target.value)} placeholder="account.wam"
              onKeyDown={(e) => e.key === 'Enter' && addContact()} />
            <Button size="sm" disabled={busy} onClick={addContact} className="bg-cheese text-primary-foreground hover:bg-cheese/90">Add</Button>
          </div>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="flex-1 justify-between">
                  🔑 Your key <ChevronDown className="h-4 w-4 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72">
                <DropdownMenuLabel className="space-y-1">
                  <span className="block text-xs text-cheese">✓ loaded for {account}</span>
                  <span className="block text-[11px] font-normal text-muted-foreground break-all">{key.publicKey}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => download(`${account}-cheesecrypt-public.json`, toPublicFile(key))}>Share public key</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => download(`${account}-cheesecrypt-key-PRIVATE.json`, key)}>Back up private key</DropdownMenuItem>
                <DropdownMenuItem disabled={busy} onSelect={publish}>Publish to chain ({MESSAGE_FEE_QUANTITY} nulled)</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => fileRef.current?.click()}>Load file (your key or a contact's)</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={makeKey}>New key</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" variant="ghost" disabled={loading} onClick={refresh} aria-label="Refresh messages">
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </Button>
          </div>
        </div>
        <ul className="flex-1 overflow-y-auto p-2 space-y-1">
          {partners.map((p) => (
            <li key={p}>
              <button onClick={() => setActive(p)}
                className={cn('w-full text-left rounded-md px-3 py-2 text-sm transition-colors',
                  active === p ? 'bg-cheese/15 text-cheese font-semibold' : 'hover:bg-muted')}>
                <span className="block truncate">{p}</span>
                <span className="block text-[10px] text-muted-foreground">
                  {!contacts[p] ? 'no key yet' : lastAt[p] ? new Date(lastAt[p]).toLocaleDateString() : 'no messages'}
                </span>
              </button>
            </li>
          ))}
          {!partners.length && <li className="text-xs text-muted-foreground p-2">{loading ? 'Loading…' : 'No conversations yet. Add a WAX account above.'}</li>}
        </ul>
      </aside>

      <section className="flex flex-col min-h-0">
        {!active ? (
          <p className="text-sm text-muted-foreground m-auto">💬 Pick or add a contact.</p>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-border font-semibold">{active}</div>
            <ol className="flex-1 overflow-y-auto space-y-2 p-4">
              {thread.map((m) => (
                <li key={m.txId + m.memo}
                  className={cn('max-w-[80%] rounded-lg px-3 py-2 text-sm',
                    m.from === account ? 'ml-auto bg-cheese/20 border border-cheese/30' : 'bg-muted')}>
                  <p className="text-[10px] font-semibold tracking-wide opacity-80">{m.from === account ? `you · ${account}` : m.from}</p>
                  <p className="whitespace-pre-wrap break-words">
                    {m.text ?? <em className="opacity-70">{contacts[active] ? "Can't read this one: it was sent with a different key." : `Can't read yet: load ${active}'s public key first.`}</em>}
                  </p>
                  <p className="text-[10px] opacity-70 mt-1">{new Date(m.time).toLocaleString()} · {m.quantity}</p>
                </li>
              ))}
              {!thread.length && <li className="text-sm text-muted-foreground">No messages with {active} yet.</li>}
              <li ref={endRef} aria-hidden />
            </ol>
            {!contacts[active] ? (
              <p className="text-sm text-muted-foreground p-4 border-t border-border">You need {active}'s public key. Add them by name or load their public file.</p>
            ) : (
              <div className="space-y-2 p-4 border-t border-border">
                <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder={`Message ${active}`} />
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={bytes > MAX_PLAINTEXT_BYTES ? 'text-destructive' : 'text-muted-foreground'}>{bytes}/{MAX_PLAINTEXT_BYTES}</span>
                  <TermsCheckbox checked={agreed} onCheckedChange={setAgreed} className="ml-2" />
                  <span className="ml-auto text-muted-foreground">{MESSAGE_TOTAL_QUANTITY} per message</span>
                  <Button size="sm" disabled={busy || !agreed || !text.trim() || bytes > MAX_PLAINTEXT_BYTES} onClick={send}
                    className="bg-cheese text-primary-foreground hover:bg-cheese/90">Send</Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {MESSAGE_RECIPIENT_QUANTITY} to {active} carrying your encrypted message + {MESSAGE_FEE_QUANTITY} nulled, together in one transaction.
                </p>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

export default CheeseCrypt;
