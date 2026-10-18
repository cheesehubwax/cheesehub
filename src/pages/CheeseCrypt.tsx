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
import { ChevronDown, Eye, EyeOff, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { useWax } from '@/context/WaxContext';
import { useWaxTransaction } from '@/hooks/useWaxTransaction';
import { useToast } from '@/hooks/use-toast';
import { playRandomFart } from '@/lib/fartSounds';
import { cn } from '@/lib/utils';
import { AvatarEditor, WalletAvatarPicker } from '@/components/crypt/AvatarEditor';
import { CryptNftCard } from '@/components/crypt/CryptNftCard';
import { MusicNftPicker } from '@/components/crypt/MusicNftPicker';
import { nftToken, parseNftMessage } from '@/lib/cryptNft';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FriendNameDialog } from '@/components/crypt/FriendNameDialog';
import { cryptDisplayName, loadCryptNames, saveCryptName } from '@/lib/cryptNames';
import { accountAvatar, type CryptAvatar } from '@/lib/cryptAvatar';
import { PixelAvatar } from '@/components/crypt/PixelAvatar';
import { VaultPrompt } from '@/components/crypt/VaultPrompt';
import { CreateGroupDialog } from '@/components/crypt/CreateGroupDialog';
import { ShareKeyDialog } from '@/components/crypt/ShareKeyDialog';
import { CryptAbout } from '@/components/crypt/CryptAbout';
import { VoiceRecorder } from '@/components/crypt/VoiceRecorder';
import { VoiceNoteBubble } from '@/components/crypt/VoiceNoteBubble';
import { buildVoiceBatches, voicePartCount, voiceTransactions, VOICE_PARTS_PER_TX, type VoiceClip } from '@/lib/cryptVoice';
import { baselineMarks, loadReadMarks, saveReadMarks, unreadCounts, type ReadMarks } from '@/lib/cryptUnread';
import { buildGroupMessageActions, createGroup, decodeConversations, groupMessageCost, groupMessageSize, loadGroups, loadHiddenGroups, mergeGroups, saveGroups, setGroupHidden, type CryptGroup } from '@/lib/cryptGroups';
import {
  DirHandle, FRIENDS_DIR, PRIVATE_DIR, VAULT_DIR, VaultFileExistsError, friendKeyName, pickVault, privateKeyName,
  readFriendKeys, recallVault, rememberVault, updatePrivateKeyProfile, vaultSupported, vaultWritable, writeFriendKey, writeOwnPublicKey,
} from '@/lib/cryptVault';
import type { PublicKeyFile } from '@/lib/cheeseCrypt';
import {
  ChainMemo, MAX_PLAINTEXT_BYTES, MESSAGE_FEE_QUANTITY, MESSAGE_RECIPIENT_QUANTITY, MESSAGE_TOTAL_QUANTITY, NFT_FEE_QUANTITY, MessagingKey,
  MAX_MESSAGE_BYTES, MAX_HISTORY_PAGES, MAX_PARTS, PART_BODY_BYTES, messageCost, partCount, splitMessage,
  buildPublishKeyActions, buildSendMessageActions, encryptMemo, fetchMessages, generateKey,
  loadContacts, loadContactAvatars, loadKey, loadRemovedContacts, removeContact, lookupPublishedKey, parseKeyFile, plaintextBytes, saveContact, saveKey, toPublicFile,
} from '@/lib/cheeseCrypt';

const ACCOUNT_RE = /^[a-z1-5.]{1,12}$/;
/** How often an open, visible messenger checks history for new messages. */
const LIVE_POLL_MS = 6000;

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
            <div className="w-full text-center space-y-4">
              <CryptAbout>
              <div className="flex items-center justify-center gap-2">
                <OpenMojiIcon emoji="🔐" size={26} />
                <h1 className="text-3xl md:text-4xl font-bold">
                  <span className="text-cheese">CHEESE</span>
                  <span className="text-foreground">Crypt</span>
                </h1>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cheese/20 text-cheese border border-cheese/30 leading-none">BETA</span>
                <OpenMojiIcon emoji="🔐" size={26} />
              </div>
              </CryptAbout>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Encrypted messages sent on the WAX blockchain with CHEESE. Anyone can see that a message was sent —
                only the conversation’s participants can read it.
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

export function Messenger({ account, session }: { account: string; session: NonNullable<ReturnType<typeof useWax>['session']> }) {
  const { toast } = useToast();
  const { executeTransaction } = useWaxTransaction(session);
  const permission = session.permissionLevel;
  const [key, setKey] = useState<MessagingKey | null>(() => loadKey(account));
  const [contacts, setContacts] = useState<Record<string, string>>(() => loadContacts(account));
  const [removedContacts, setRemovedContacts] = useState(() => loadRemovedContacts(account));
  const [avatars, setAvatars] = useState(() => loadContactAvatars(account));
  const [names, setNames] = useState(() => loadCryptNames(account));
  const [nicknames, setNicknames] = useState(() => loadCryptNames(account, 'nicknames'));
  const [editingFriend, setEditingFriend] = useState<string | null>(null);
  const nameFor = (id: string) => id === account ? key?.displayName ?? account : cryptDisplayName(id, names, nicknames);
  const [editingAvatar, setEditingAvatar] = useState(false);
  const [settingUpProfile, setSettingUpProfile] = useState(false);
  const [showSharePrompt, setShowSharePrompt] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [groups, setGroups] = useState(() => loadGroups(account));
  const [hiddenGroups, setHiddenGroups] = useState(() => loadHiddenGroups(account));
  const [showHiddenGroups, setShowHiddenGroups] = useState(false);
  const [attachingNft, setAttachingNft] = useState(false);
  const [attachingMusic, setAttachingMusic] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newContact, setNewContact] = useState('');
  const [memos, setMemos] = useState<ChainMemo[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [readMarks, setReadMarks] = useState<ReadMarks | null>(() => loadReadMarks(account));
  const [text, setText] = useState('');
  const [voice, setVoice] = useState<VoiceClip | null>(null);
  /** History pages to read; grows only when a voice note touches the edge of the loaded window. */
  const [depth, setDepth] = useState(1);
  /** Ticks so a stalled voice note moves from "loading" to "incomplete" without new history. */
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => { const id = window.setInterval(() => setClock(Date.now()), 30_000); return () => clearInterval(id); }, []);
  useEffect(() => { setVoice(null); }, [active]);
  const [busy, setBusy] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLLIElement>(null);
  const [backupKey, setBackupKey] = useState<MessagingKey | null>(null);
  const [vault, setVault] = useState<DirHandle | null>(null);
  useEffect(() => { recallVault(account).then(setVault); }, [account]);
  // Friends folder is shared by every account on this device; nicknames and removals stay per account.
  useEffect(() => {
    if (!vault) return;
    let cancelled = false;
    (async () => {
      if (!(await vaultWritable(vault, false).catch(() => false))) return;
      const files = await readFriendKeys(vault).catch(() => []);
      if (cancelled || !files.length) return;
      const removed = loadRemovedContacts(account);
      let changed = false;
      for (const f of files) {
        if (f.account === account || removed.includes(f.account)) continue;
        saveContact(account, f.account, f.publicKey, f.avatar, f.displayName); changed = true;
      }
      if (changed && !cancelled) { setContacts(loadContacts(account)); setAvatars(loadContactAvatars(account)); setNames(loadCryptNames(account)); }
    })();
    return () => { cancelled = true; };
  }, [vault, account]);

  const inFlight = useRef(false);
  // Only replace the list when something changed, so a quiet poll never re-renders the chat.
  const applyMemos = useCallback((next: Awaited<ReturnType<typeof fetchMessages>>) => {
    setMemos(prev => {
      const sig = (l: typeof next) => l.map(m => `${m.txId}:${m.memo}`).join('|');
      return prev.length === next.length && sig(prev) === sig(next) ? prev : next;
    });
  }, []);
  const refresh = useCallback(async () => {
    setLoading(true);
    inFlight.current = true;
    try { applyMemos(await fetchMessages(account, depth)); setLoaded(true); }
    catch { toast({ title: 'Could not load messages', description: 'History servers did not answer. Try again shortly.', variant: 'destructive' }); }
    finally { setLoading(false); inFlight.current = false; }
  }, [account, toast, applyMemos, depth]);
  // Background check: no spinner, no error toast — a missed poll is retried on the next tick.
  const poll = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try { applyMemos(await fetchMessages(account, depth)); setLoaded(true); } catch { /* retry next tick */ }
    finally { inFlight.current = false; }
  }, [account, applyMemos, depth]);

  useEffect(() => { if (key) refresh(); }, [key, refresh]);
  useEffect(() => {
    if (!key) return;
    const tick = () => { if (document.visibilityState === 'visible') poll(); };
    const id = window.setInterval(tick, LIVE_POLL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') poll(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('focus', onVisible); };
  }, [key, poll]);

  const partners = useMemo(() => {
    const s = new Set(Object.keys(contacts));
    memos.forEach((m) => s.add(m.from === account ? m.to : m.from));
    return [...s].filter(name => !removedContacts.includes(name)).sort();
  }, [contacts, memos, account, removedContacts]);

  const lastAt = useMemo(() => {
    const out: Record<string, number> = {};
    memos.forEach((m) => { const p = m.from === account ? m.to : m.from; out[p] = Math.max(out[p] ?? 0, m.time); });
    return out;
  }, [memos, account]);

  const conversations = useMemo(() => key ? decodeConversations(memos, key, contacts, clock) : [], [memos, key, contacts, clock]);
  // A voice note spans several transactions; if one is unfinished right at the oldest loaded memo,
  // its earlier parts are probably on the next history page, so read one page further (bounded).
  useEffect(() => {
    if (depth >= MAX_HISTORY_PAGES || !memos.length) return;
    const oldest = memos.reduce((t, m) => Math.min(t, m.time), Infinity);
    if (conversations.some(c => c.voice && c.voice.missing > 0 && c.time - oldest < 60_000)) setDepth(d => Math.min(MAX_HISTORY_PAGES, d + 1));
  }, [conversations, memos, depth]);
  useEffect(() => {
    setGroups(current => {
      const merged = mergeGroups(current, conversations.flatMap(m => m.group ? [m.group] : []));
      if (merged.length === current.length) return current;
      saveGroups(account, merged);
      return merged;
    });
  }, [conversations, account]);
  useEffect(() => {
    let cancelled = false;
    const names = new Set(memos.map(m => m.from === account ? m.to : m.from));
    groups.forEach(g => g.members.forEach(m => { if (m !== account) names.add(m); }));
    const discover = async () => {
      for (const name of names) {
        if (contacts[name] || loadRemovedContacts(account).includes(name) || !ACCOUNT_RE.test(name) || cancelled) continue;
        try {
          const pub = await lookupPublishedKey(name);
          if (pub && !cancelled && !loadContacts(account)[name] && !loadRemovedContacts(account).includes(name)) {
            saveContact(account, name, pub); setContacts(loadContacts(account));
          }
        } catch { /* A friend’s public key file remains the fallback. */ }
      }
    };
    discover();
    return () => { cancelled = true; };
  }, [memos, groups, account]);
  const activeGroup = groups.find(g => `group:${g.id}` === active);
  const recipients = activeGroup ? activeGroup.members.filter(m => m !== account) : active ? [active] : [];
  const missingKeys = recipients.filter(m => !contacts[m]);
  const thread = conversations.filter(m => activeGroup
    ? m.group?.id === activeGroup.id && m.group.members.join(',') === activeGroup.members.join(',')
    : !m.group && ((m.from === account && m.to === active) || (m.from === active && m.to === account)));

  // Unread badges: first load on this device marks existing history read; afterwards only newer incoming messages count.
  useEffect(() => {
    if (!loaded || !key || readMarks) return;
    const base = baselineMarks(conversations, account);
    saveReadMarks(account, base); setReadMarks(base);
  }, [loaded, key, readMarks, conversations, account]);
  useEffect(() => {
    if (!active || !readMarks) return;
    const newest = thread.reduce((t, m) => Math.max(t, m.time), 0);
    if (newest <= (readMarks[active] ?? 0)) return;
    const next = { ...readMarks, [active]: newest };
    saveReadMarks(account, next); setReadMarks(next);
  }, [active, thread, readMarks, account]);
  const unread = useMemo(() => readMarks ? unreadCounts(conversations, account, readMarks) : {}, [conversations, account, readMarks]);
  const badge = (id: string) => unread[id] && active !== id
    ? <span aria-label={`${unread[id]} unread`} className="ml-auto shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-cheese text-primary-foreground text-[11px] font-bold leading-5 text-center">{unread[id] > 99 ? '99+' : unread[id]}</span>
    : null;

  const listRef = useRef<HTMLOListElement>(null);
  const nearBottom = useRef(true);
  const lastActive = useRef<string | null>(null);
  useEffect(() => {
    const switched = lastActive.current !== active;
    lastActive.current = active;
    // Follow new messages only when the reader is already at the bottom; never yank them out of history.
    if (switched || nearBottom.current) endRef.current?.scrollIntoView({ block: 'end', behavior: switched ? 'auto' : 'smooth' });
  }, [thread.length, active]);

  const makeKey = () => {
    if (key && !confirm('Replace your existing key? Messages encrypted with the old key can no longer be read unless you kept its file.')) return;
    setSettingUpProfile(true); setEditingAvatar(true);
  };

  const completeProfile = async (avatar: CryptAvatar, displayName?: string) => {
    setEditingAvatar(false);
    if (settingUpProfile) {
      const created = generateKey(account, { avatar, displayName });
      saveKey(created); setKey(created); setBackupKey(created); setSettingUpProfile(false);
      return;
    }
    if (!key) return;
    const updated = { ...key, avatar, displayName };
    saveKey(updated); setKey(updated);
    try {
      if (!vault || !(await vaultWritable(vault, true))) throw new Error('Folder access unavailable');
      await updatePrivateKeyProfile(vault, updated);
      await writeOwnPublicKey(vault, toPublicFile(updated)).catch(() => {});
      toast({ title: 'Profile and private backup updated', description: 'Share your updated public key file so friends see your name and avatar.' });
    } catch {
      download(privateKeyName(account), updated);
      toast({ title: 'Profile saved; refreshed backup downloaded', description: 'The existing disk file was not replaced. Keep this refreshed file safe; share only your public key.' });
    }
  };

  /** Saves your public key into cheesecrypt/my private key/ (beside your private key); downloads if no folder access. */
  const sharePublicKey = async () => {
    if (!key) return;
    const file = toPublicFile(key);
    try {
      let root = vault;
      if (!root || !(await vaultWritable(root, true))) {
        if (!vaultSupported()) { download(friendKeyName(account), file); return; }
        root = await pickVault(); setVault(root); rememberVault(account, root).catch(() => {});
      }
      await writeOwnPublicKey(root, file);
      toast({ title: 'Public key saved', description: `In ${VAULT_DIR}/${PRIVATE_DIR} beside your private key. Share only the -public.json file.` });
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return;
      download(friendKeyName(account), file);
      toast({ title: 'Public key downloaded', description: 'Folder access was unavailable, so the file went to your Downloads.' });
    }
  };

  const backupDownloaded = () => {
    if (!backupKey) return;
    download(privateKeyName(account), backupKey);
    setBackupKey(null);
    setShowSharePrompt(true);
    toast({ title: 'Messaging key created', description: 'A private backup file was downloaded. Keep it safe and never share it.' });
  };

  const backupSaved = (root: DirHandle) => {
    setBackupKey(null); setVault(root);
    setShowSharePrompt(true);
    rememberVault(account, root).catch(() => {});
    toast({ title: 'Key saved', description: `Saved in ${VAULT_DIR}/${PRIVATE_DIR}. Never share this file.` });
  };

  const saveFriend = async (name: string, ask: boolean) => {
    const pub = contacts[name] ?? loadContacts(account)[name];
    if (!pub) return;
    const file: PublicKeyFile = { type: 'gpk-msg-pubkey', version: 1, account: name, publicKey: pub, ...(loadContactAvatars(account)[name] ? { avatar: loadContactAvatars(account)[name] } : {}), ...(loadCryptNames(account)[name] ? { displayName: loadCryptNames(account)[name] } : {}) };
    try {
      let root = vault;
      if (!root || !(await vaultWritable(root, ask))) {
        if (!ask) return;
        if (!vaultSupported()) { download(friendKeyName(name), file); return; }
        root = await pickVault(); setVault(root); rememberVault(account, root).catch(() => {});
      }
      await writeFriendKey(root, file, ask);
      toast({ title: `Saved ${name}'s key`, description: `In ${VAULT_DIR}/${FRIENDS_DIR}` });
    } catch (e) {
      if (!ask || (e as DOMException)?.name === 'AbortError') return;
      if (e instanceof VaultFileExistsError) toast({ title: `${name}'s key is already in ${FRIENDS_DIR}`, description: 'The existing file was left untouched.' });
      else toast({ title: 'Could not save to the friends folder', variant: 'destructive' });
    }
  };

  const addContact = async () => {
    const name = newContact.trim().toLowerCase();
    if (!ACCOUNT_RE.test(name) || name === account) { toast({ title: 'Enter a valid WAX account', variant: 'destructive' }); return; }
    setBusy(true);
    try {
      const pub = await lookupPublishedKey(name);
      if (!pub) { toast({ title: `${name} has not published a key`, description: 'Ask them for their public key file and load it here.' }); return; }
      saveContact(account, name, pub); setContacts(loadContacts(account)); setRemovedContacts(loadRemovedContacts(account)); setActive(name); setNewContact(''); saveFriend(name, false);
      toast({ title: `Found ${name}'s key` });
    } catch { toast({ title: 'Key lookup failed', variant: 'destructive' }); }
    finally { setBusy(false); }
  };

  const changeGroupVisibility = (id: string, hidden: boolean) => {
    setGroupHidden(account, id, hidden);
    setHiddenGroups(loadHiddenGroups(account));
    if (hidden && active === `group:${id}`) { setActive(null); setText(''); }
  };
  const groupRow = (g: CryptGroup, hidden: boolean) => <li key={g.id} className="group flex items-center gap-1">
    <Button variant="ghost" onClick={() => setActive(`group:${g.id}`)} className={cn('flex-1 min-w-0 h-auto justify-start text-left px-3 py-2', active === `group:${g.id}` && 'bg-cheese/15 text-cheese')}>
      <span className="min-w-0"><span className="block text-sm">Group · {g.members.length} people</span>
        <span className="block text-[10px] text-muted-foreground whitespace-normal break-words">{g.members.filter(m => m !== account).map(nameFor).join(', ')}</span></span>
      {badge(`group:${g.id}`)}
    </Button>
    <Button variant="ghost" size="icon" aria-label={`${hidden ? 'Restore' : 'Hide'} group ${g.id}`} title={`${hidden ? 'Restore' : 'Hide'} group`}
      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-cheese opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity"
      onClick={() => changeGroupVisibility(g.id, !hidden)}>{hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}</Button>
  </li>;

  const removeFriend = (name: string) => {
    removeContact(account, name);
    setContacts(loadContacts(account)); setRemovedContacts(loadRemovedContacts(account));
    setAvatars(loadContactAvatars(account)); setNames(loadCryptNames(account)); setNicknames(loadCryptNames(account, 'nicknames'));
    if (active === name) { setActive(null); setText(''); }
    if (editingFriend === name) setEditingFriend(null);
    toast({ title: 'Friend removed', description: 'Saved public key, name, nickname and avatar cleared from this browser. Messages and downloaded files are unchanged.' });
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
        saveContact(account, parsed.account, parsed.publicKey, parsed.avatar, parsed.displayName ?? ''); setContacts(loadContacts(account)); setRemovedContacts(loadRemovedContacts(account)); setAvatars(loadContactAvatars(account)); setNames(loadCryptNames(account)); setActive(parsed.account); saveFriend(parsed.account, false);
        toast({ title: `Added ${parsed.account}` });
      }
    } catch { toast({ title: 'Not a messaging key file', variant: 'destructive' }); }
  };

  const publish = async () => {
    if (!key) return false;
    if (!agreed) { toast({ title: 'Please agree to the Terms of Use first', variant: 'destructive' }); return false; }
    setBusy(true);
    try { const result = await executeTransaction(buildPublishKeyActions(account, key.publicKey, [permission]), { successTitle: 'Public key published' }); return result.success; }
    finally { setBusy(false); }
  };

  const send = async () => {
    if (!key || !active || missingKeys.length || !agreed || !text.trim() || tooLong) return;
    setBusy(true);
    try {
      const actions = activeGroup ? buildGroupMessageActions(key, activeGroup, text, contacts, [permission], hasNft)
        : buildSendMessageActions(account, active, splitMessage(text).map(p => encryptMemo(p, contacts[active], key.secretKey)), [permission], hasNft);
      const r = await executeTransaction(actions, { successTitle: 'Message sent' });
      if (r.success) { setText(''); nearBottom.current = true; [2000, 5000, 10000].forEach(ms => setTimeout(poll, ms)); }
    } catch (e) { toast({ title: 'Could not send', description: (e as Error).message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };

  /** Signs each batch of up to 30 parts in turn; parts already sent stay on chain if a later one fails. */
  const sendVoice = async () => {
    if (!key || !active || !voice || missingKeys.length || !agreed) return;
    setBusy(true);
    let sent = 0, total = 0;
    try {
      const batches = buildVoiceBatches(key, recipients, activeGroup ?? null, voice, contacts, [permission]);
      total = batches.length;
      for (let i = 0; i < batches.length; i++) {
        const r = await executeTransaction(batches[i], { successTitle: total > 1 ? `Voice note: transaction ${i + 1} of ${total} sent` : 'Voice note sent' });
        if (!r.success) break;
        sent++;
      }
    } catch (e) { toast({ title: 'Could not send voice note', description: (e as Error).message, variant: 'destructive' }); }
    finally {
      setBusy(false);
      if (sent && sent === total) { setVoice(null); nearBottom.current = true; }
      else if (sent) toast({ title: 'Voice note partly sent', description: `${sent} of ${total} transactions went through. The receiver will see it as incomplete and it will not play. You can send the recording again.`, variant: 'destructive' });
      if (sent) [2000, 5000, 10000].forEach(ms => setTimeout(poll, ms));
    }
  };

  const hasNft = parseNftMessage(text).some(seg => seg.type === 'nft');
  const size = activeGroup ? groupMessageSize(activeGroup, text) : { bytes: plaintextBytes(text), parts: partCount(text), maxBytes: MAX_MESSAGE_BYTES };
  const { bytes, parts, maxBytes } = size;
  const tooLong = bytes > maxBytes || parts > MAX_PARTS;
  const copies = activeGroup ? recipients.length : 1;
  const voiceParts = voice ? voicePartCount(voice) : 0;
  const voiceTxs = voiceTransactions(voiceParts);
  const totalCost = voice
    ? (activeGroup ? groupMessageCost(voiceParts, copies) : messageCost(voiceParts))
    : activeGroup ? groupMessageCost(parts || 1, copies, hasNft) : messageCost(parts || 1, hasNft);
  const fileInput = (
    <input ref={fileRef} type="file" accept="application/json,.json" className="hidden"
      onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
  );
  const profileEditor = editingAvatar && <AvatarEditor account={account} avatar={settingUpProfile ? undefined : key?.avatar}
    displayName={settingUpProfile ? undefined : key?.displayName} initialSetup={settingUpProfile}
    onClose={() => { if (settingUpProfile) void completeProfile(accountAvatar(account)); else setEditingAvatar(false); }}
    onSave={() => {}} onSaveProfile={(avatar, displayName) => void completeProfile(avatar, displayName)} />;

  if (!key) {
    return (
      <div className="w-full max-w-md space-y-5 text-center">
        {fileInput}
      {profileEditor}
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
          <p className="text-xs text-muted-foreground">Choose your name and avatar first, then save your new private key. A new key cannot read messages sent to an older one.</p>
          <Button className="w-full" variant="outline" onClick={makeKey}>Create a new key</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-lg border border-cheese/20 bg-card/80 overflow-hidden grid md:grid-cols-[240px_1fr] h-[70dvh] min-h-[480px]">
      {fileInput}
      {backupKey && <VaultPrompt cryptKey={backupKey} onSaved={backupSaved} onDownload={backupDownloaded} />}
      {creatingGroup && <CreateGroupDialog contacts={contacts} avatars={avatars} nameFor={nameFor} onClose={() => setCreatingGroup(false)} onCreate={members => {
        const group = createGroup(account, members);
        const updated = mergeGroups(groups, [group]); saveGroups(account, updated); setGroups(updated);
        setActive(`group:${group.id}`); setCreatingGroup(false); setText('');
      }} />}
      {editingFriend && <FriendNameDialog account={editingFriend} nickname={nicknames[editingFriend]} sharedName={names[editingFriend]} onClose={() => setEditingFriend(null)} onSave={name => {
        saveCryptName(account, editingFriend, name, 'nicknames'); setNicknames(loadCryptNames(account, 'nicknames')); setEditingFriend(null);
      }} />}
      {attachingNft && <Dialog open onOpenChange={o => { if (!o) { setAttachingNft(false); setAttachingMusic(false); } }}>
        <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>🖼️ Attach an NFT</DialogTitle></DialogHeader>
          <div className="flex gap-2">
            <Button size="sm" variant={attachingMusic ? 'outline' : 'default'} className="h-7 text-xs" onClick={() => setAttachingMusic(false)}>🖼️ Pictures</Button>
            <Button size="sm" variant={attachingMusic ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => setAttachingMusic(true)}>🎵 Music &amp; sound</Button>
          </div>
          <p className="text-xs text-muted-foreground">Only the NFT's asset ID is added to your encrypted message. The artwork and sound are public on WAX.</p>
          {attachingMusic
            ? <MusicNftPicker account={account} onPick={nft => {
                setText(t => `${t.trimEnd()}${t.trim() ? ' ' : ''}${nftToken(nft.asset_id)} `); setAttachingNft(false); setAttachingMusic(false);
              }} />
            : <WalletAvatarPicker account={account} busy={false} onPick={nft => {
                setText(t => `${t.trimEnd()}${t.trim() ? ' ' : ''}${nftToken(nft.asset_id)} `); setAttachingNft(false);
              }} />}
        </DialogContent>
      </Dialog>}
      {profileEditor}
      {showSharePrompt && key && <ShareKeyDialog account={account} busy={busy} agreed={agreed} onAgreedChange={setAgreed} onClose={() => setShowSharePrompt(false)}
        onDownload={() => { void sharePublicKey(); setShowSharePrompt(false); }}
        onPublish={async () => { if (await publish()) setShowSharePrompt(false); }} />}
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
                  <PixelAvatar account={account} avatar={key.avatar} className="h-6 w-6 shrink-0" /> <span className="truncate">{key.displayName ?? 'Your key'}</span> <ChevronDown className="h-4 w-4 opacity-70 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72">
                <DropdownMenuLabel className="space-y-1">
                  <span className="block text-xs text-cheese">✓ loaded for {account}</span>
                  <span className="block text-[11px] font-normal text-muted-foreground break-all">{key.publicKey}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setEditingAvatar(true)}>🎨 Edit profile</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void sharePublicKey()}>Share public key</DropdownMenuItem>
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
          <Button size="sm" variant="outline" className="w-full" onClick={() => setCreatingGroup(true)}>👥 New group</Button>
        </div>
        <ul className="flex-1 overflow-y-auto p-2 space-y-1">
          <li aria-hidden className="px-2 pt-1 pb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">👥 Groups</span>
          </li>
          {groups.filter(g => !hiddenGroups.includes(g.id)).map(g => groupRow(g, false))}
          {!groups.some(g => !hiddenGroups.includes(g.id)) && <li className="text-xs text-muted-foreground px-2 pb-1">No groups yet.</li>}
          {groups.some(g => hiddenGroups.includes(g.id)) && <li>
            <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground" aria-expanded={showHiddenGroups} aria-controls="crypt-hidden-groups" onClick={() => setShowHiddenGroups(v => !v)}>
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', !showHiddenGroups && '-rotate-90')} />
              Hidden groups ({groups.filter(g => hiddenGroups.includes(g.id)).length})
            </Button>
            {showHiddenGroups && <ul id="crypt-hidden-groups" className="space-y-1">{groups.filter(g => hiddenGroups.includes(g.id)).map(g => groupRow(g, true))}</ul>}
          </li>}
          <li aria-hidden className="border-t border-border my-2" role="presentation">
            <span className="block px-2 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">🤝 Friends</span>
          </li>
          {partners.map((p) => (
            <li key={p} className="group flex items-center gap-1">
              <Button variant="ghost" onClick={() => setActive(p)}
                className={cn('flex-1 min-w-0 h-auto justify-start gap-2 text-left rounded-md px-3 py-2 text-sm transition-colors',
                  active === p ? 'bg-cheese/15 text-cheese font-semibold' : 'hover:bg-muted')}>
                <PixelAvatar account={p} avatar={avatars[p]} />
                <span className="min-w-0 flex-1"><span className="block truncate">{nameFor(p)}</span>
                {nameFor(p) !== p && <span className="block text-[10px] text-muted-foreground truncate">{p}</span>}
                <span className="block text-[10px] text-muted-foreground">
                  {!contacts[p] ? 'no key yet' : lastAt[p] ? new Date(lastAt[p]).toLocaleDateString() : 'no messages'}
                </span></span>
                {badge(p)}
              </Button>
              <Button variant="ghost" size="icon" aria-label={`Remove friend ${p}`} title={`Remove friend ${p}`}
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity"
                onClick={() => removeFriend(p)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </li>
          ))}
          {!partners.length && <li className="text-xs text-muted-foreground px-2 pb-2">{loading ? 'Loading…' : 'No conversations yet. Add a WAX account above.'}</li>}
        </ul>
      </aside>

      <section className="flex flex-col min-h-0">
        {!active ? (
          <p className="text-sm text-muted-foreground m-auto">💬 Pick or add a contact.</p>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-border font-semibold flex flex-wrap items-center gap-2">
              {activeGroup ? activeGroup.members.map(member => <span key={member} className="flex items-center gap-1 text-xs min-w-0">
                <PixelAvatar account={member} avatar={member === account ? key.avatar : avatars[member]} className="h-6 w-6 shrink-0" /><span className="break-words">{nameFor(member)}{member === account && ' (you)'}{nameFor(member) !== member && <span className="block text-[10px] text-muted-foreground">{member}</span>}</span>
                {member !== account && <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" aria-label={`Edit nickname for ${member}`} title={`Edit nickname for ${member}`} onClick={() => setEditingFriend(member)}><Pencil className="h-3 w-3" /></Button>}
              </span>) : <><PixelAvatar account={active} avatar={avatars[active]} /><span className="min-w-0 break-words">{nameFor(active)}{nameFor(active) !== active && <span className="block text-xs text-muted-foreground">{active}</span>}</span><Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label={`Edit nickname for ${active}`} title={`Edit nickname for ${active}`} onClick={() => setEditingFriend(active)}><Pencil className="h-3 w-3" /></Button></>}
              {!activeGroup && contacts[active] && <Button size="sm" variant="ghost" className="ml-auto h-7 text-xs font-normal" onClick={() => saveFriend(active, true)}>💾 Save to {FRIENDS_DIR}</Button>}</div>
            <ol ref={listRef} className="flex-1 overflow-y-auto space-y-2 p-4"
              onScroll={(e) => { const el = e.currentTarget; nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}>
              {thread.map((m) => (
                <li key={m.key}
                  className={cn('w-fit max-w-[80%] rounded-lg px-3 py-2 text-sm',
                    m.from === account ? 'ml-auto bg-cheese/20 border border-cheese/30' : 'bg-muted')}>
                  <div className="flex items-center gap-2 mb-1">
                    <PixelAvatar account={m.from} avatar={m.from === account ? key.avatar : avatars[m.from]} className="h-6 w-6" />
                    <p className="text-[10px] font-semibold opacity-80 break-words">{m.from === account ? `you · ${nameFor(account)}` : nameFor(m.from)}{nameFor(m.from) !== m.from && <span className="block font-normal">{m.from}</span>}</p>
                  </div>
                  <div className="whitespace-pre-wrap break-words">
                    {m.voice ? <VoiceNoteBubble note={m.voice} /> : m.text != null ? parseNftMessage(m.text).map((seg, i) => seg.type === 'nft' ? <CryptNftCard key={i} assetId={seg.assetId} /> : <span key={i} className="block">{seg.text}</span>) : <em className="opacity-70">{contacts[active] ? "Can't read this one: it was sent with a different key." : `Can't read yet: load ${active}'s public key first.`}</em>}
                  </div>
                  <p className="text-[10px] opacity-70 mt-1">
                    {new Date(m.time).toLocaleString()} · {m.group ? `${groupMessageCost(m.parts, m.group.members.length - 1, !!m.text && parseNftMessage(m.text).some(x => x.type === 'nft'))} at current rate` : messageCost(m.parts, !!m.text && parseNftMessage(m.text).some(x => x.type === 'nft'))}
                    {m.parts > 1 && ` · ${m.parts} parts`}
                    {m.missing > 0 && !m.voice && <span className="text-destructive"> · {m.missing} part{m.missing > 1 ? 's' : ''} not loaded</span>}
                    {m.txId && <> · <a href={`https://waxblock.io/transaction/${encodeURIComponent(m.txId)}`} target="_blank" rel="noreferrer"
                      className="font-semibold text-cheese underline underline-offset-2 hover:text-cheese/80">Tx</a></>}
                  </p>
                </li>
              ))}
              {!thread.length && <li className="text-sm text-muted-foreground">{activeGroup ? 'No group messages yet.' : `No messages with ${nameFor(active)} yet.`}</li>}
              <li ref={endRef} aria-hidden />
            </ol>
            {missingKeys.length ? (
              <p className="text-sm text-muted-foreground p-4 border-t border-border">Public keys needed: {missingKeys.join(', ')}. Add them by name or load their public files.</p>
            ) : (
              <div className="space-y-2 p-4 border-t border-border">
                <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} disabled={!!voice} placeholder={voice ? 'Sending a voice note — discard it to type a message' : activeGroup ? 'Message group' : `Message ${nameFor(active)}`} />
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={!voice && tooLong ? 'text-destructive' : 'text-muted-foreground'}>
                    {voice ? `${voiceParts} parts · ${voiceTxs} transaction${voiceTxs > 1 ? 's' : ''}` : `${bytes}/${maxBytes} · ${parts || 1} part${parts > 1 ? 's' : ''}`}{activeGroup && ` × ${copies} recipients`}
                  </span>
                  {!voice && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAttachingNft(true)}>🖼️ Attach NFT</Button>}
                  {!voice && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAttachingMusic(true)}>🎵 Attach music</Button>}
                  {!text.trim() && <VoiceRecorder clip={voice} onChange={setVoice} disabled={busy} />}
                  <TermsCheckbox checked={agreed} onCheckedChange={setAgreed} className="ml-2" />
                  <span className="ml-auto text-muted-foreground">{totalCost}</span>
                  {voice
                    ? <Button size="sm" disabled={busy || !agreed} onClick={sendVoice} className="bg-cheese text-primary-foreground hover:bg-cheese/90">Send voice{voiceTxs > 1 ? ` (${voiceTxs} signatures)` : ''}</Button>
                    : <Button size="sm" disabled={busy || !agreed || !text.trim() || tooLong} onClick={send}
                      className="bg-cheese text-primary-foreground hover:bg-cheese/90">Send</Button>}
                </div>
                {voice && <p className="text-[11px] text-muted-foreground">🎙️ Voice note: {voiceParts} encrypted parts, up to {VOICE_PARTS_PER_TX} per transaction, signed one after another. Each part costs the normal message rate. If a later transaction fails, the parts already sent stay on chain and the note shows as incomplete.</p>}
                <p className="text-[11px] text-muted-foreground">
                  {activeGroup ? `Each part: ${MESSAGE_FEE_QUANTITY} nulled once for the group + ${MESSAGE_RECIPIENT_QUANTITY} to each of ${copies} recipients. Group delivery uses ${copies} encrypted copies in one transaction. Membership is fixed; start a new group to change participants.` : `Each part: ${MESSAGE_RECIPIENT_QUANTITY} to ${active} + ${MESSAGE_FEE_QUANTITY} nulled (${MESSAGE_TOTAL_QUANTITY}). Long messages split into up to ${MAX_PARTS} parts (${MAX_PLAINTEXT_BYTES} bytes for one, ${PART_BODY_BYTES} per part after that), all in one transaction.`}
                  {` Attaching an NFT raises the first part's nulled fee to ${NFT_FEE_QUANTITY}.`}
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
