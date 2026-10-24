// CHEESECrypt — encrypted on-chain messages paid in CHEESE.
// Intentionally not linked from the header or menus: reachable at /crypt only.
// The hero orb shows the glitched cheese pyramid (CDN asset pointer below).
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Layout } from '@/components/Layout';
import { OpenMojiIcon } from '@/components/OpenMojiIcon';
import cryptOrbAsset from '@/assets/cheese-pyramid.png.asset.json';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CardAction } from '@/components/crypt/CardAction';
import { BlockedDialog } from '@/components/crypt/BlockedDialog';
import { MessageRequests, PublicInboxDialog } from '@/components/crypt/PublicInbox';
import { decodeInboxRequests, declineRequest, inboxCandidates, loadPublicInbox, loadRequestDeclines, savePublicInbox } from '@/lib/cryptPublicInbox';
import { buildProfileNoteBatches, isProfileNote, latestProfiles, profileNoteCost, profileNoteParts, profileRecipients } from '@/lib/cryptProfileNotes';
import { ProfileShareDialog } from '@/components/crypt/ProfileShareDialog';
import { addBlocked, loadBlocked, removeBlocked, saveBlocked, withoutBlocked } from '@/lib/cryptBlocklist';
import { TermsCheckbox } from '@/components/shared/TermsCheckbox';
import { ChevronDown, Download, Eye, EyeOff, KeyRound, Loader2, Ban, Pencil, Radio, RefreshCw, Save, Trash2, Upload, UserPlus, Users } from 'lucide-react';
import { useWax } from '@/context/WaxContext';
import { useWaxTransaction } from '@/hooks/useWaxTransaction';
import { useToast } from '@/hooks/use-toast';
import { playRandomFart } from '@/lib/fartSounds';
import { cn } from '@/lib/utils';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { encodeReply, parseReply, quoteOf, type ReplyRef } from '@/lib/cryptReply';
import { useCryptReplyNavigation } from '@/hooks/useCryptReplyNavigation';
import { AvatarEditor, WalletAvatarPicker } from '@/components/crypt/AvatarEditor';
import { CryptNftCard } from '@/components/crypt/CryptNftCard';
import { useQuery } from '@tanstack/react-query';
import { fetchAssetById } from '@/services/atomicApi';
import { nftToken, parseNftMessage } from '@/lib/cryptNft';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FriendNameDialog } from '@/components/crypt/FriendNameDialog';
import { cryptDisplayName, loadCryptNames, saveCryptName } from '@/lib/cryptNames';
import { accountAvatar, type CryptAvatar } from '@/lib/cryptAvatar';
import { PixelAvatar } from '@/components/crypt/PixelAvatar';
import { VaultPrompt } from '@/components/crypt/VaultPrompt';
import { CreateGroupDialog } from '@/components/crypt/CreateGroupDialog';
import { PaidActionDialog } from '@/components/crypt/PaidActionDialog';
import {
  buildCg2Actions, collectInvites, declineFriendRequest, deriveInviteGroups, encodeGroupText, encodeInvite, encodeMeta, encodeNotice, inviteTextSize,
  loadDecisions, loadFriendDecisions, loadInvites, newInviteGroupId, saveDecision, saveInvites, scopedKeys, eventFromMember, VOICE_REF_PREFIX,
  type Cg2Event, type InviteGroup, type InviteGroupView,
} from '@/lib/cryptInviteGroups';
import { ShareKeyDialog } from '@/components/crypt/ShareKeyDialog';
import { CryptAbout } from '@/components/crypt/CryptAbout';
import { VoiceRecorder } from '@/components/crypt/VoiceRecorder';
import { VoiceNoteBubble } from '@/components/crypt/VoiceNoteBubble';
import { buildVoiceBatches, voiceNoteCost, voicePartCount, voiceTransactions, VOICE_PARTS_PER_TX, type VoiceClip } from '@/lib/cryptVoice';
import { baselineMarks, firstUnreadIndex, firstVisitMarks, loadReadMarks, mergeMarks, sameMarks, saveReadMarks, unreadCounts, unreadReplies, type ReadMarks } from '@/lib/cryptUnread';
import { readKeyFileJson } from '@/lib/cryptKeyFileText';
import { buildGroupMessageActions, createGroup, decodeConversations, groupMessageCost, groupMessageSize, loadGroups, loadHiddenGroups, mergeGroups, saveGroups, setGroupHidden, type ConversationEntry, type CryptGroup } from '@/lib/cryptGroups';
import {
  DirHandle, FRIENDS_DIR, PRIVATE_DIR, VAULT_DIR, VaultFileExistsError, friendKeyName, pickVault, privateKeyName,
  findPrivateKey, readFriendKeys, readVaultMarks, recallVault, writeVaultMarks, rememberVault, updatePrivateKeyProfile, vaultSupported, vaultWritable, writeFriendKey, writeOwnPublicKey,
} from '@/lib/cryptVault';
import type { PublicKeyFile } from '@/lib/cheeseCrypt';
import {
  ChainMemo, MAX_PLAINTEXT_BYTES, MESSAGE_FEE_QUANTITY, MESSAGE_RECIPIENT_QUANTITY, MESSAGE_TOTAL_QUANTITY, NFT_FEE_QUANTITY, MessagingKey,
  MAX_MESSAGE_BYTES, MAX_HISTORY_PAGES, MAX_PARTS, PART_BODY_BYTES, messageCost, partCount, splitMessage,
  buildCreateKeyActions, KEY_CREATION_QUANTITY, buildPublishKeyActions, buildSendMessageActions, encryptMemo, fetchMessages, generateKey,
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

/** Pure sound-effect-NFT posts render without the bubble box — sender header, playback and timestamp stay. */
function ChatMessageItem({ m, account, keyAvatar, avatars, contacts, active, activeGroup, nameFor, openedAt, onReply, onOpenQuote, highlighted }: {
  m: ConversationEntry; account: string; keyAvatar?: CryptAvatar; avatars: Record<string, CryptAvatar>;
  contacts: Record<string, string>; active: string; activeGroup: CryptGroup | null;
  nameFor: (id: string) => string; openedAt: { current: number };
  onReply: (m: ConversationEntry) => void; onOpenQuote: (ref: ReplyRef) => void;
  highlighted: boolean;
}) {
  const reply = parseReply(m.text);
  const body = reply ? reply.body : m.text;
  const segments = body != null ? parseNftMessage(body) : null;
  const soloAssetId = segments && segments.length === 1 && segments[0].type === 'nft' ? segments[0].assetId : null;
  const { data } = useQuery({
    queryKey: ['crypt-nft', soloAssetId], queryFn: () => fetchAssetById(soloAssetId!),
    enabled: !!soloAssetId, staleTime: 3600_000,
  });
  const bare = !!soloAssetId && !!data?.isSfx;
  const canReply = !!m.voice || m.text != null;
  return (
    <ContextMenu>
    <ContextMenuTrigger asChild disabled={!canReply}>
    <li data-reply-key={m.key} data-reply-highlighted={highlighted || undefined} className={cn('w-fit max-w-[80%] text-sm',
      bare ? (m.from === account ? 'ml-auto py-1' : 'py-1') : m.from === account
        ? 'ml-auto rounded-lg px-3 py-2 bg-cheese/20 border border-cheese/30' : 'rounded-lg px-3 py-2 bg-muted',
      highlighted && 'ring-2 ring-reply bg-reply/10')}>
      <div className="flex items-center gap-2 mb-1">
        <PixelAvatar account={m.from} avatar={m.from === account ? keyAvatar : avatars[m.from]} className="h-6 w-6" />
        <p className="text-[10px] font-semibold opacity-80 break-words">{m.from === account ? `you · ${nameFor(account)}` : nameFor(m.from)}{nameFor(m.from) !== m.from && <span className="block font-normal">{m.from}</span>}</p>
      </div>
      {reply && <button type="button" onClick={() => onOpenQuote(reply)} aria-label={`Show the message from ${nameFor(reply.author)} this replies to`}
        className="mb-1 block w-full max-w-full rounded border-l-2 border-reply bg-background/60 px-2 py-1 text-left text-xs hover:bg-background">
        <span className="block font-semibold text-reply">↩️ {reply.author === account ? 'you' : nameFor(reply.author)}</span>
        <span className="block truncate opacity-80">{reply.quote || '…'}</span>
      </button>}
      <div className="whitespace-pre-wrap break-words">
        {m.voice ? <VoiceNoteBubble note={m.voice} /> : body != null ? parseNftMessage(body).map((seg, i) => seg.type === 'nft' ? <CryptNftCard key={i} assetId={seg.assetId} autoplayKey={m.time > openedAt.current ? `${m.key}:${i}` : undefined} txId={m.txId} /> : <span key={i} className="block">{seg.text}</span>) : <em className="opacity-70">{contacts[active] ? "Can't read this one: it was sent with a different key." : `Can't read yet: load ${active}'s public key first.`}</em>}
      </div>
      <p className="text-[10px] opacity-70 mt-1">
        {new Date(m.time).toLocaleString()}{m.igroup ? null : ' · '}{m.igroup ? null : m.voice ? `${voiceNoteCost(m.parts, m.group ? m.group.members.length - 1 : 1)} at current rate` : m.group ? `${groupMessageCost(m.parts, m.group.members.length - 1, !!m.text && parseNftMessage(m.text).some(x => x.type === 'nft'))} at current rate` : messageCost(m.parts, !!m.text && parseNftMessage(m.text).some(x => x.type === 'nft'))}
        {m.parts > 1 && ` · ${m.parts} parts`}
        {m.missing > 0 && !m.voice && <span className="text-destructive"> · {m.missing} part{m.missing > 1 ? 's' : ''} not loaded</span>}
        {m.txId && <> · <a href={`https://waxblock.io/transaction/${encodeURIComponent(m.txId)}`} target="_blank" rel="noreferrer"
          className="font-semibold text-cheese underline underline-offset-2 hover:text-cheese/80">Tx</a></>}
      </p>
    </li>
    </ContextMenuTrigger>
    <ContextMenuContent>
      <ContextMenuItem onSelect={() => onReply(m)}>↩️ Reply</ContextMenuItem>
    </ContextMenuContent>
    </ContextMenu>
  );
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
              <img src={cryptOrbAsset.url} alt="CHEESE" className="h-24 w-24 object-contain" />
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
  const [pendingProfile, setPendingProfile] = useState<{ avatar: CryptAvatar; displayName?: string } | null>(null);
  const [creationAgreed, setCreationAgreed] = useState(false);
  const creatingKey = useRef(false);
  const [showSharePrompt, setShowSharePrompt] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [groups, setGroups] = useState(() => loadGroups(account));
  const [hiddenGroups, setHiddenGroups] = useState(() => loadHiddenGroups(account));
  const [blocked, setBlockedState] = useState(() => loadBlocked(account));
  const [showBlocked, setShowBlocked] = useState(false);
  const [publicInbox, setPublicInbox] = useState(() => loadPublicInbox(account));
  const [requestDeclines, setRequestDeclines] = useState(() => loadRequestDeclines(account));
  const acceptedRequestMessages = useRef(new Set<string>());
  const [sharingProfile, setSharingProfile] = useState(false);
  const [showHiddenGroups, setShowHiddenGroups] = useState(false);
  const [attachingNft, setAttachingNft] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [inviteStore, setInviteStore] = useState(() => loadInvites(account));
  const [decisions, setDecisions] = useState(() => loadDecisions(account));
  const [friendDeclines, setFriendDeclines] = useState(() => loadFriendDecisions(account));
  /** A paid group notice waiting for Terms + confirmation. */
  const [pendingNotice, setPendingNotice] = useState<null | { kind: 'joined' | 'leave' | 'friend' | 'friend-ok'; id: string; to?: string }>(null);
  const [editingInvite, setEditingInvite] = useState<null | { id: string; name: string; avatar?: CryptAvatar }>(null);
  const [paintingInvite, setPaintingInvite] = useState(false);
  const [newContact, setNewContact] = useState('');
  const [addingFriend, setAddingFriend] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(true);
  const [friendsOpen, setFriendsOpen] = useState(true);
  const [memos, setMemos] = useState<ChainMemo[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [readMarks, setReadMarks] = useState<ReadMarks | null>(() => loadReadMarks(account));
  const [text, setText] = useState('');
  const [replyingTo, setReplyingTo] = useState<ReplyRef | null>(null);
  const [openQuote, setOpenQuote] = useState<ReplyRef | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [voice, setVoice] = useState<VoiceClip | null>(null);
  /** History pages to read; grows only when a voice note touches the edge of the loaded window. */
  const [depth, setDepth] = useState(1);
  /** Ticks so a stalled voice note moves from "loading" to "incomplete" without new history. */
  /** Only messages newer than this page visit may autoplay sound effects; older history stays silent. */
  const openedAt = useRef(Date.now());
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
  /** Read markers saved in the vault folder: undefined while checking, null when none or no access. */
  const [folderMarks, setFolderMarks] = useState<ReadMarks | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    setFolderMarks(undefined);
    (async () => {
      const v = await recallVault(account).catch(() => null);
      const ok = !!v && await vaultWritable(v, false).catch(() => false);
      const marks = ok ? await readVaultMarks(v!, account) : null;
      if (!cancelled) setFolderMarks(marks);
    })();
    return () => { cancelled = true; };
  }, [account]);
  // A key left in the vault folder is found by its contents (any file name) once folder access is already granted.
  const [searchingVault, setSearchingVault] = useState(false);
  const loadKeyFromVault = useCallback(async (root: DirHandle, ask: boolean) => {
    if (!(await vaultWritable(root, ask).catch(() => false))) return false;
    const found = await findPrivateKey(root, account).catch(() => null);
    if (!found) return false;
    saveKey(found); setKey(found);
    toast({ title: 'Your messaging key was loaded', description: `Found in your ${VAULT_DIR} folder.` });
    return true;
  }, [account, toast]);
  useEffect(() => { if (vault && !key) void loadKeyFromVault(vault, false); }, [vault, key, loadKeyFromVault]);
  const findKeyInFolder = async () => {
    setSearchingVault(true);
    try {
      let root = vault;
      if (!root) { if (!vaultSupported()) { fileRef.current?.click(); return; } root = await pickVault(); setVault(root); rememberVault(account, root).catch(() => {}); }
      if (!(await loadKeyFromVault(root, true))) toast({ title: `No private key for ${account} in that folder`, description: 'Use "Load my private key" to pick the file yourself.', variant: 'destructive' });
    } catch (e) {
      if ((e as DOMException)?.name !== 'AbortError') toast({ title: 'Could not open that folder', variant: 'destructive' });
    } finally { setSearchingVault(false); }
  };
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

  // Blocked accounts are dropped before any decryption, so their DMs, group copies and voice parts never surface.
  const visibleMemos = useMemo(() => withoutBlocked(memos, account, blocked), [memos, account, blocked]);

  const lastAt = useMemo(() => {
    const out: Record<string, number> = {};
    visibleMemos.forEach((m) => { const p = m.from === account ? m.to : m.from; out[p] = Math.max(out[p] ?? 0, m.time); });
    return out;
  }, [visibleMemos, account]);

  // Keys introduced by invite groups decrypt only that group's traffic (never DMs, never the Friends list).
  const scoped = useMemo(() => scopedKeys(inviteStore, account), [inviteStore, account]);
  const decoded = useMemo(() => key ? decodeConversations(visibleMemos, key, contacts, clock, scoped) : [], [visibleMemos, key, contacts, clock, scoped]);
  const cg2Events = useMemo<Cg2Event[]>(() => decoded.flatMap(c => c.control && c.usedKey && !c.voice
    ? [{ key: c.key, txId: c.txId, time: c.time, from: c.from, to: c.to, control: c.control, usedKey: c.usedKey }] : []), [decoded]);
  const invites = useMemo(() => key ? collectInvites(cg2Events, account, key.publicKey, contacts, inviteStore) : inviteStore, [cg2Events, account, key, contacts, inviteStore]);
  useEffect(() => {
    if (Object.keys(invites).length === Object.keys(inviteStore).length) return;
    saveInvites(account, invites); setInviteStore(invites);
  }, [invites, inviteStore, account]);
  const inviteViews = useMemo(() => deriveInviteGroups(cg2Events, invites, account, decisions), [cg2Events, invites, account, decisions]);
  /** Accounts known only through an invite group; they stay out of Friends and key discovery until a friend request is accepted. */
  const groupOnly = useMemo(() => {
    const s = new Set<string>();
    Object.values(invites).forEach(g => g.members.forEach(m => { if (m.account !== account && !contacts[m.account]) s.add(m.account); }));
    return s;
  }, [invites, account, contacts]);
  // Profile notes and group notices update state and never appear as chat messages or unread badges.
  // Invite-group messages/voice show only when they come from a member with that member's invite key.
  const conversations = useMemo(() => decoded.filter(c => {
    if (isProfileNote(c.text)) return false;
    if (!c.igroup) return !!c.group || !!contacts[c.from === account ? c.to : c.from];
    if (c.control && c.control.kind !== 'msg') return false;
    if (!c.usedKey) return false;
    const view = inviteViews.find(v => v.invite.id === c.igroup);
    return !!view && view.status !== 'declined' && !!eventFromMember({ key: c.key, txId: c.txId, time: c.time, from: c.from, to: c.to, control: { kind: 'joined', id: c.igroup }, usedKey: c.usedKey }, invites, account);
  }), [decoded, inviteViews, invites, account, contacts]);
  const partners = useMemo(() => {
    const s = new Set(Object.keys(contacts));
    return [...s].filter(name => !removedContacts.includes(name) && !blocked.includes(name) && !groupOnly.has(name)).sort();
  }, [contacts, visibleMemos, account, removedContacts, blocked, groupOnly]);
  const requestCandidates = useMemo(() => inboxCandidates(visibleMemos, account,
    new Set([...Object.keys(contacts), ...groupOnly, ...blocked, ...removedContacts, ...groups.flatMap(g => g.members)])),
    [visibleMemos, account, contacts, groupOnly, blocked, removedContacts, groups]);
  const { data: requestKeys = {} } = useQuery({
    queryKey: ['crypt-inbox-keys', account, key?.publicKey, requestCandidates],
    enabled: publicInbox && !!key && requestCandidates.length > 0,
    queryFn: async () => {
      const found: Record<string, string> = {};
      // Sequential and bounded; history polls never trigger a new lookup for an unchanged candidate list.
      for (const from of requestCandidates) {
        try { const pub = await lookupPublishedKey(from); if (pub) found[from] = pub; } catch { /* next foreground retry */ }
      }
      return found;
    },
    staleTime: 60_000, refetchInterval: 60_000, retry: false,
  });
  const messageRequests = useMemo(() => publicInbox && key ? decodeInboxRequests(visibleMemos, key,
    Object.fromEntries(requestCandidates.flatMap(from => requestKeys[from] ? [[from, requestKeys[from]]] : [])), requestDeclines) : [],
    [publicInbox, key, visibleMemos, requestCandidates, requestKeys, requestDeclines]);
  // A member who accepted my friend request becomes a friend with the key their group introduced.
  useEffect(() => {
    let changed = false;
    for (const v of inviteViews) for (const a of v.accepted) {
      const pub = v.invite.members.find(m => m.account === a)?.publicKey;
      if (!pub || contacts[a] || removedContacts.includes(a) || blocked.includes(a)) continue;
      saveContact(account, a, pub); changed = true;
    }
    if (changed) setContacts(loadContacts(account));
  }, [inviteViews, contacts, removedContacts, blocked, account]);
  const profileNotes = useMemo(() => latestProfiles(decoded.filter(c => !c.group && !c.voice && !c.missing), account), [decoded, account]);
  useEffect(() => {
    let changed = false;
    for (const [from, note] of Object.entries(profileNotes)) {
      if (!contacts[from]) continue;
      if ((names[from] ?? '') === (note.displayName ?? '') && avatars[from]?.pixels === note.avatar.pixels) continue;
      saveContact(account, from, contacts[from], note.avatar, note.displayName ?? ''); changed = true;
    }
    if (changed) { setAvatars(loadContactAvatars(account)); setNames(loadCryptNames(account)); }
  }, [profileNotes, contacts, names, avatars, account]);
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
    const names = new Set<string>();
    // Only existing legacy groups may discover member keys automatically. Strangers require explicit acceptance.
    groups.forEach(g => g.members.forEach(m => { if (m !== account) names.add(m); }));
    const discover = async () => {
      for (const name of names) {
        if (contacts[name] || groupOnly.has(name) || blocked.includes(name) || loadRemovedContacts(account).includes(name) || !ACCOUNT_RE.test(name) || cancelled) continue;
        try {
          const pub = await lookupPublishedKey(name);
          if (pub && !cancelled && !loadBlocked(account).includes(name) && !loadContacts(account)[name] && !loadRemovedContacts(account).includes(name)) {
            saveContact(account, name, pub); setContacts(loadContacts(account));
          }
        } catch { /* A friend’s public key file remains the fallback. */ }
      }
    };
    discover();
    return () => { cancelled = true; };
  }, [groups, account, groupOnly, blocked, contacts]);
  const activeGroup = groups.find(g => `group:${g.id}` === active);
  const activeInvite: InviteGroupView | undefined = activeGroup ? undefined : inviteViews.find(v => `group:${v.invite.id}` === active);
  const inviteKeys = useMemo(() => activeInvite ? Object.fromEntries(activeInvite.invite.members.map(m => [m.account, m.publicKey])) : {}, [activeInvite]);
  const recipients = activeInvite ? activeInvite.joined.filter(m => m !== account) : activeGroup ? activeGroup.members.filter(m => m !== account) : active ? [active] : [];
  const missingKeys = activeInvite ? [] : recipients.filter(m => !contacts[m]);
  useEffect(() => { setReplyingTo(null); }, [active]);
  const thread = activeInvite ? conversations.filter(m => m.igroup === activeInvite.invite.id) : conversations.filter(m => activeGroup
    ? m.group?.id === activeGroup.id && m.group.members.join(',') === activeGroup.members.join(',')
    : !m.group && ((m.from === account && m.to === active) || (m.from === active && m.to === account)));

  // Unread badges: first load on this device marks existing history read; afterwards only newer incoming messages count.
  useEffect(() => {
    if (!loaded || !key || readMarks || folderMarks === undefined) return;
    const base = firstVisitMarks(baselineMarks(conversations, account), folderMarks);
    saveReadMarks(account, base); setReadMarks(base);
  }, [loaded, key, readMarks, folderMarks, conversations, account]);
  // Markers from the vault folder merge into this browser's (newest wins per chat).
  useEffect(() => {
    if (!readMarks || !folderMarks) return;
    const merged = mergeMarks(readMarks, folderMarks);
    if (!sameMarks(merged, readMarks)) { saveReadMarks(account, merged); setReadMarks(merged); }
  }, [folderMarks, readMarks, account]);
  // ...and this browser's markers are written back to the folder (re-read first so another device's newer marks survive).
  useEffect(() => {
    if (!vault || !readMarks || folderMarks === undefined) return;
    const id = window.setTimeout(async () => {
      if (!(await vaultWritable(vault, false).catch(() => false))) return;
      const onDisk = await readVaultMarks(vault, account);
      const next = mergeMarks(onDisk ?? {}, readMarks);
      if (onDisk && sameMarks(next, onDisk)) return;
      await writeVaultMarks(vault, account, next).catch(() => {});
    }, 1500);
    return () => clearTimeout(id);
  }, [vault, readMarks, folderMarks, account]);
  useEffect(() => {
    if (!active || !readMarks) return;
    const newest = thread.reduce((t, m) => Math.max(t, m.time), 0);
    if (newest <= (readMarks[active] ?? 0)) return;
    const next = { ...readMarks, [active]: newest };
    saveReadMarks(account, next); setReadMarks(next);
  }, [active, thread, readMarks, account]);
  const unread = useMemo(() => readMarks ? unreadCounts(conversations, account, readMarks) : {}, [conversations, account, readMarks]);
  const replyUnread = useMemo(() => readMarks ? unreadReplies(conversations, account, readMarks) : {}, [conversations, account, readMarks]);
  // Conversations with an unread reply to one of your messages get the reply colour instead of cheese yellow.
  const badge = (id: string) => unread[id] && active !== id
    ? <span aria-label={replyUnread[id] ? `${unread[id]} unread, ${replyUnread[id]} repl${replyUnread[id] > 1 ? 'ies' : 'y'} to you` : `${unread[id]} unread`} data-reply={replyUnread[id] ? 'true' : undefined}
      className={cn('ml-auto shrink-0 min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold leading-5 text-center', replyUnread[id] ? 'bg-reply text-reply-foreground' : 'bg-cheese text-primary-foreground')}>{replyUnread[id] ? '↩ ' : ''}{unread[id] > 99 ? '99+' : unread[id]}</span>
    : null;

  const listRef = useRef<HTMLOListElement>(null);
  const nearBottom = useRef(true);
  const lastActive = useRef<string | null>(null);
  const newMarkerRef = useRef<HTMLLIElement | null>(null);
  // Snapshot of the chat's read marker at the moment it is opened, before it is marked read — the resume point.
  const readMarksRef = useRef<ReadMarks | null>(null);
  readMarksRef.current = readMarks;
  const resumeRef = useRef<{ id: string | null; at: number | null }>({ id: null, at: null });
  if (resumeRef.current.id !== active) {
    resumeRef.current = { id: active, at: active ? (readMarksRef.current?.[active] ?? null) : null };
  }
  const resumeAt = resumeRef.current.id === active ? resumeRef.current.at : null;
  const firstNew = firstUnreadIndex(thread, resumeAt);
  const replyNavigation = useCryptReplyNavigation(account, active, thread, resumeAt, listRef);
  // Remember where the page itself was so switching chats never moves the outer page.
  const pageY = useRef(typeof window === 'undefined' ? 0 : window.scrollY);
  useEffect(() => {
    const onScroll = () => { pageY.current = window.scrollY; };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useLayoutEffect(() => {
    const switched = lastActive.current !== active;
    lastActive.current = active;
    const keepY = pageY.current;
    const pin = () => { if (Math.abs(window.scrollY - keepY) > 1) window.scrollTo({ top: keepY, behavior: 'auto' }); };
    // Follow new messages only when the reader is already at the bottom; never yank them out of history.
    // Scroll only the message list itself so the outer page never jumps.
    if (switched || nearBottom.current) {
      const el = listRef.current;
      if (el) {
        const marker = switched ? newMarkerRef.current : null;
        if (marker) {
          // Re-opening a chat lands on the first unread message (just under the divider), not the bottom.
          const top = el.scrollTop + marker.getBoundingClientRect().top - el.getBoundingClientRect().top - 12;
          if (typeof el.scrollTo === 'function') el.scrollTo({ top, behavior: 'auto' });
          else el.scrollTop = top;
        } else {
          const top = el.scrollHeight;
          if (typeof el.scrollTo === 'function') el.scrollTo({ top, behavior: switched ? 'auto' : 'smooth' });
          else el.scrollTop = top;
        }
      }
    }
    if (!switched || typeof window.requestAnimationFrame !== 'function') return;
    pin();
    // Late layout (images, avatars) can still nudge the page right after the switch; hold it for a few frames.
    let frames = 0; let raf = 0;
    const hold = () => { pin(); if (++frames < 10) raf = window.requestAnimationFrame(hold); };
    raf = window.requestAnimationFrame(hold);
    return () => window.cancelAnimationFrame(raf);
  }, [thread.length, active]);

  const makeKey = () => {
    if (key && !confirm('Replace your existing key? Messages encrypted with the old key can no longer be read unless you kept its file.')) return;
    setSettingUpProfile(true); setEditingAvatar(true);
  };

  const completeProfile = async (avatar: CryptAvatar, displayName?: string) => {
    setEditingAvatar(false);
    if (settingUpProfile) {
      setPendingProfile({ avatar, displayName }); setCreationAgreed(false); setSettingUpProfile(false);
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
    setSharingProfile(true);
  };

  /** Sends your current name/avatar to every friend and group member, one batch at a time. */
  const sendProfileNote = async (to: string[]) => {
    if (!key) return false;
    setBusy(true);
    let sent = 0, total = 0;
    try {
      const batches = buildProfileNoteBatches(key, to, contacts, [permission]);
      total = batches.length;
      for (let i = 0; i < batches.length; i++) {
        const r = await executeTransaction(batches[i], { successTitle: total > 1 ? `Profile update ${i + 1} of ${total} sent` : 'Profile update sent' });
        if (!r.success) break;
        sent++;
      }
    } catch (e) { toast({ title: 'Could not send profile update', description: (e as Error).message, variant: 'destructive' }); }
    finally { setBusy(false); }
    if (sent && sent < total) toast({ title: 'Profile update partly sent', description: `${sent} of ${total} transactions went through. You can send it again.`, variant: 'destructive' });
    return sent > 0 && sent === total;
  };

  const payAndCreateKey = async () => {
    if (!pendingProfile || !creationAgreed || creatingKey.current) return;
    creatingKey.current = true; setBusy(true);
    try {
      const result = await executeTransaction(buildCreateKeyActions(account, [permission]), { successTitle: 'Key creation fee paid' });
      if (!result.success || !result.txId) {
        if (result.success) toast({ title: 'Payment could not be confirmed', description: 'No new key was created. Check your wallet transaction before retrying.', variant: 'destructive' });
        return;
      }
      const created = generateKey(account, pendingProfile);
      saveKey(created); setKey(created); setBackupKey(created); setPendingProfile(null); setCreationAgreed(false); setAgreed(false);
    } catch (e) {
      toast({ title: 'Could not create key', description: (e as Error).message, variant: 'destructive' });
    } finally { creatingKey.current = false; setBusy(false); }
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
      if (!pub) { toast({ title: `${name} has not published a key`, description: 'Ask them for their public key file and import it here.' }); return; }
      saveContact(account, name, pub); setContacts(loadContacts(account)); setRemovedContacts(loadRemovedContacts(account)); setActive(name); setNewContact(''); saveFriend(name, false);
      setAddingFriend(false);
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

  /** Declined invites, and unanswered invites from accounts you've since blocked, never show. */
  const inviteShown = (v: InviteGroupView) => v.status !== 'declined' && !(v.status === 'invited' && blocked.includes(v.invite.creator));
  const inviteRow = (v: InviteGroupView, hidden: boolean) => {
    const id = v.invite.id;
    const requests = v.friendRequests.filter(a => !contacts[a] && !blocked.includes(a) && !friendDeclines.includes(`${id}:${a}`)).length;
    return <li key={id} className="group flex items-center gap-1">
      <Button variant="ghost" onClick={() => setActive(`group:${id}`)} className={cn('flex-1 min-w-0 h-auto justify-start gap-2 text-left px-3 py-2', active === `group:${id}` && 'bg-cheese/15 text-cheese')}>
        {v.avatar ? <PixelAvatar account={id} avatar={v.avatar} className="h-6 w-6 shrink-0" /> : <span className="shrink-0">👥</span>}
        <span className="min-w-0"><span className="block text-sm break-words whitespace-normal">{v.name}</span>
          <span className="block text-[10px] text-muted-foreground whitespace-normal break-words">
            {v.status === 'invited' ? `✉️ Invited by ${nameFor(v.invite.creator)}` : v.status === 'left' ? 'You left' : `${v.joined.length} of ${v.invite.members.length} joined`}
            {requests > 0 && ` · 🤝 ${requests} friend request${requests > 1 ? 's' : ''}`}
          </span></span>
        {badge(`group:${id}`)}
      </Button>
      <Button variant="ghost" size="icon" aria-label={`${hidden ? 'Restore' : 'Hide'} group ${id}`} title={`${hidden ? 'Restore' : 'Hide'} group`}
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-cheese opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity"
        onClick={() => changeGroupVisibility(id, !hidden)}>{hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}</Button>
    </li>;
  };

  const blockAccount = (name: string) => {
    try {
      const next = addBlocked(blocked, name, account);
      saveBlocked(account, next); setBlockedState(next);
      const n = name.trim().toLowerCase();
      if (active === n) { setActive(null); setText(''); }
      toast({ title: `${n} blocked`, description: 'Their messages are hidden on this device. Nothing changes on-chain.' });
    } catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
  };
  const acceptRequest = (from: string) => {
    const request = messageRequests.find(r => r.from === from);
    if (!request || blocked.includes(from)) return;
    request.messages.forEach(m => acceptedRequestMessages.current.add(m.key));
    saveContact(account, from, request.publicKey);
    setContacts(loadContacts(account)); setRemovedContacts(loadRemovedContacts(account));
    setActive(from); setText(''); setVoice(null);
    toast({ title: `${from} added as a friend` });
  };
  const dismissRequest = (from: string) => {
    const request = messageRequests.find(r => r.from === from);
    if (request) setRequestDeclines(declineRequest(account, from, request.time));
  };
  const unblockAccount = (name: string) => {
    const next = removeBlocked(blocked, name);
    saveBlocked(account, next); setBlockedState(next);
    toast({ title: `${name} unblocked` });
  };

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
      const parsed = parseKeyFile(await readKeyFileJson(f));
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
      const actions = activeInvite ? buildCg2Actions(key, recipients, inviteKeys, encodeGroupText(activeInvite.invite.id, outgoing), [permission], hasNft)
        : activeGroup ? buildGroupMessageActions(key, activeGroup, outgoing, contacts, [permission], hasNft)
        : buildSendMessageActions(account, active, splitMessage(outgoing).map(p => encryptMemo(p, contacts[active], key.secretKey)), [permission], hasNft);
      const r = await executeTransaction(actions, { successTitle: 'Message sent' });
      if (r.success) { setText(''); setReplyingTo(null); nearBottom.current = true; [2000, 5000, 10000].forEach(ms => setTimeout(poll, ms)); }
    } catch (e) { toast({ title: 'Could not send', description: (e as Error).message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };

  /** Signs each batch of up to 30 parts in turn; parts already sent stay on chain if a later one fails. */
  const sendVoice = async () => {
    if (!key || !active || !voice || missingKeys.length || !agreed) return;
    setBusy(true);
    let sent = 0, total = 0;
    try {
      const batches = buildVoiceBatches(key, recipients, activeInvite ? { id: `${VOICE_REF_PREFIX}${activeInvite.invite.id}`, members: ['-'] } : activeGroup ?? null, voice, activeInvite ? inviteKeys : contacts, [permission]);
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

  // ---- invite groups (CG2): every notice is an ordinary paid encrypted message ----
  const sendCg2 = async (to: string[], keys: Record<string, string>, payload: string, successTitle: string) => {
    if (!key) return false;
    setBusy(true);
    try {
      const r = await executeTransaction(buildCg2Actions(key, to, keys, payload, [permission]), { successTitle });
      if (r.success) [2000, 5000, 10000].forEach(ms => setTimeout(poll, ms));
      return r.success;
    } catch (e) { toast({ title: 'Could not send', description: (e as Error).message, variant: 'destructive' }); return false; }
    finally { setBusy(false); }
  };
  const cg2Cost = (payload: string, recipientCount: number) => groupMessageCost(partCount(payload), recipientCount);
  const draftInvite = (name: string, members: string[], avatar?: CryptAvatar, id = '0'.repeat(16), created = Date.now()): InviteGroup | null => key ? {
    id, name, creator: account, created, members: [{ account, publicKey: key.publicKey }, ...members.map(m => ({ account: m, publicKey: contacts[m] }))], ...(avatar ? { avatar } : {}),
  } : null;
  const createInviteGroup = async (name: string, members: string[], avatar?: CryptAvatar) => {
    const invite = draftInvite(name, members, avatar, newInviteGroupId());
    if (!invite) return false;
    let payload: string;
    try { payload = encodeInvite(invite); } catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); return false; }
    if (!(await sendCg2(members, contacts, payload, `Invites sent to ${members.length} friend${members.length > 1 ? 's' : ''}`))) return false;
    const next = { ...inviteStore, [invite.id]: invite };
    saveInvites(account, next); setInviteStore(next);
    setActive(`group:${invite.id}`); setCreatingGroup(false); setText('');
    return true;
  };
  const viewById = (id: string) => inviteViews.find(v => v.invite.id === id);
  const keysOf = (g: InviteGroup) => Object.fromEntries(g.members.map(m => [m.account, m.publicKey]));
  /** Who a notice goes to and what it costs. */
  const noticePlan = (n: NonNullable<typeof pendingNotice>) => {
    const v = viewById(n.id);
    if (!v) return null;
    const others = v.invite.members.map(m => m.account).filter(a => a !== account);
    const to = n.kind === 'joined' ? others : n.kind === 'leave' ? v.joined.filter(a => a !== account) : n.to ? [n.to] : [];
    const payload = encodeNotice(n.kind, n.id);
    return { v, to, payload, cost: to.length ? cg2Cost(payload, to.length) : '0.0000 CHEESE' };
  };
  const confirmNotice = async () => {
    if (!pendingNotice) return false;
    const plan = noticePlan(pendingNotice);
    if (!plan) return false;
    const { v, to, payload } = plan;
    const n = pendingNotice;
    if (n.kind === 'leave' && !to.length) { setDecisions(saveDecision(account, n.id, 'left')); setPendingNotice(null); return true; }
    const titles = { joined: `Joined ${v.name}`, leave: `Left ${v.name}`, friend: 'Friend request sent', 'friend-ok': 'Friend request accepted' } as const;
    if (!(await sendCg2(to, keysOf(v.invite), payload, titles[n.kind]))) return false;
    if (n.kind === 'joined' || n.kind === 'leave') setDecisions(saveDecision(account, n.id, n.kind === 'joined' ? 'joined' : 'left'));
    if (n.kind === 'friend-ok' && n.to) {
      saveContact(account, n.to, keysOf(v.invite)[n.to]); setContacts(loadContacts(account)); setRemovedContacts(loadRemovedContacts(account));
    }
    setPendingNotice(null);
    return true;
  };
  const declineInvite = (id: string, block: boolean) => {
    const v = viewById(id);
    setDecisions(saveDecision(account, id, 'declined'));
    if (active === `group:${id}`) { setActive(null); setText(''); }
    if (block && v) blockAccount(v.invite.creator);
    else toast({ title: 'Invite declined', description: 'Nothing was sent. The group is hidden on this device.' });
  };
  const confirmMeta = async () => {
    if (!editingInvite) return false;
    const v = viewById(editingInvite.id);
    if (!v) return false;
    let payload: string;
    try { payload = encodeMeta(v.invite.id, editingInvite.name, editingInvite.avatar); } catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); return false; }
    const to = v.invite.members.map(m => m.account).filter(a => a !== account);
    if (!(await sendCg2(to, keysOf(v.invite), payload, 'Group updated'))) return false;
    setEditingInvite(null);
    return true;
  };

  const hasNft = parseNftMessage(text).some(seg => seg.type === 'nft');
  const outgoing = replyingTo && text.trim() ? encodeReply(replyingTo, text) : text;
  const size = activeInvite ? inviteTextSize(activeInvite.invite.id, outgoing) : activeGroup ? groupMessageSize(activeGroup, outgoing) : { bytes: plaintextBytes(outgoing), parts: partCount(outgoing), maxBytes: MAX_MESSAGE_BYTES };
  const { bytes, parts, maxBytes } = size;
  const tooLong = bytes > maxBytes || parts > MAX_PARTS;
  const copies = activeGroup || activeInvite ? recipients.length : 1;
  const voiceParts = voice ? voicePartCount(voice) : 0;
  const voiceTxs = voiceTransactions(voiceParts);
  const totalCost = voice
    ? voiceNoteCost(voiceParts, copies)
    : activeGroup || activeInvite ? groupMessageCost(parts || 1, copies, hasNft) : messageCost(parts || 1, hasNft);
  const fileInput = (
    <input ref={fileRef} type="file" className="hidden"
      onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
  );
  const profileEditor = editingAvatar && <AvatarEditor account={account} avatar={settingUpProfile ? undefined : key?.avatar}
    displayName={settingUpProfile ? undefined : key?.displayName} initialSetup={settingUpProfile}
    onClose={() => { if (settingUpProfile) void completeProfile(accountAvatar(account)); else setEditingAvatar(false); }}
    onSave={() => {}} onSaveProfile={(avatar, displayName) => void completeProfile(avatar, displayName)} />;

  const creationDialog = pendingProfile && <Dialog open onOpenChange={open => { if (!open && !busy) setPendingProfile(null); }}>
    <DialogContent className="max-w-md" aria-describedby="crypt-creation-fee" onEscapeKeyDown={e => { if (busy) e.preventDefault(); }} onPointerDownOutside={e => { if (busy) e.preventDefault(); }}>
      <DialogHeader><DialogTitle>🔑 Create your messaging key</DialogTitle></DialogHeader>
      <p id="crypt-creation-fee" className="text-sm text-muted-foreground">A new key costs {KEY_CREATION_QUANTITY}: 80 CHEESE to eosio.null and 20 CHEESE to xcheeseliqst. Keys are created privately on this device after payment is confirmed. Your public key is not broadcast. Loading an existing key is free.</p>
      <TermsCheckbox id="crypt-create-terms" checked={creationAgreed} onCheckedChange={setCreationAgreed} />
      <Button disabled={busy || !creationAgreed} onClick={payAndCreateKey}>{busy ? 'Confirming payment…' : 'Pay 100 CHEESE & create key'}</Button>
      <Button variant="ghost" disabled={busy} onClick={() => setPendingProfile(null)}>Cancel</Button>
    </DialogContent>
  </Dialog>;

  if (!key) {
    return (
      <div className="w-full max-w-md space-y-5 text-center">
        {fileInput}
      {profileEditor}
      {creationDialog}
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
          {vaultSupported() && <Button className="w-full" variant="outline" disabled={searchingVault} onClick={() => void findKeyInFolder()}>{searchingVault ? 'Looking…' : `📁 Find it in my ${VAULT_DIR} folder`}</Button>}
          <p className="text-[11px] text-muted-foreground">Any file name works, including copies saved as .txt.</p>
        </div>
        <div className="rounded-lg border border-border bg-card/80 p-4 space-y-2 text-left">
          <p className="font-semibold text-sm">I'm new here</p>
          <p className="text-xs text-muted-foreground">Choose your name and avatar first, then pay 100 CHEESE and save your new private key. Restoring an existing key is free. A new key cannot read messages sent to an older one.</p>
          <Button className="w-full" variant="outline" onClick={makeKey}>Create a new key</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-lg border border-cheese/20 bg-card/80 overflow-hidden grid md:grid-cols-[240px_1fr] h-[70dvh] min-h-[480px]">
      {fileInput}
      {backupKey && <VaultPrompt cryptKey={backupKey} onSaved={backupSaved} onDownload={backupDownloaded} />}
      {creatingGroup && <CreateGroupDialog contacts={contacts} avatars={avatars} nameFor={nameFor} busy={busy} onClose={() => setCreatingGroup(false)}
        onCreate={createInviteGroup}
        costFor={(name, members, avatar) => { try { const d = draftInvite(name, members, avatar); return d ? cg2Cost(encodeInvite(d), members.length) : ''; } catch { return ''; } }} />}
      {pendingNotice && (() => {
        const plan = noticePlan(pendingNotice);
        if (!plan) return null;
        const who = pendingNotice.to ? nameFor(pendingNotice.to) : '';
        const copy = {
          joined: { title: `👥 Join ${plan.v.name}`, description: `Tells the ${plan.to.length} other member${plan.to.length > 1 ? 's' : ''} you joined, in encrypted messages. You'll then get new group messages.`, label: 'Pay & join' },
          leave: { title: `🚪 Leave ${plan.v.name}`, description: plan.to.length ? `Tells the ${plan.to.length} member${plan.to.length > 1 ? 's' : ''} still in the group that you left, so they stop sending you copies. Your history stays readable.` : 'Nobody else is in the group, so nothing is sent.', label: plan.to.length ? 'Pay & leave' : 'Leave' },
          friend: { title: `🤝 Friend request to ${who}`, description: `Sent encrypted to ${who} only. If they accept, you become friends and can message each other directly.`, label: 'Pay & send request' },
          'friend-ok': { title: `🤝 Accept ${who}`, description: `Adds ${who} as a friend using the key ${plan.v.name} introduced, and lets them know in an encrypted message.`, label: 'Pay & accept' },
        }[pendingNotice.kind];
        return <PaidActionDialog title={copy.title} description={copy.description} cost={plan.cost} confirmLabel={copy.label} busy={busy}
          onConfirm={confirmNotice} onClose={() => setPendingNotice(null)} />;
      })()}
      {editingInvite && !paintingInvite && (() => {
        const v = viewById(editingInvite.id);
        if (!v) return null;
        let cost = '';
        try { cost = cg2Cost(encodeMeta(v.invite.id, editingInvite.name, editingInvite.avatar), v.invite.members.length - 1); } catch { cost = 'enter a name'; }
        return <PaidActionDialog title="✏️ Edit group" description="Only you, the creator, can change the name and picture. Every member gets the update encrypted; the newest one wins." cost={cost}
          confirmLabel="Pay & update" busy={busy} onConfirm={confirmMeta} onClose={() => setEditingInvite(null)}>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setPaintingInvite(true)} aria-label="Change group picture" className="shrink-0 rounded-md border border-border p-1 hover:border-cheese">
              {editingInvite.avatar ? <PixelAvatar account="group" avatar={editingInvite.avatar} className="h-10 w-10" /> : <span className="flex h-10 w-10 items-center justify-center text-xl">👥</span>}
            </button>
            <Input value={editingInvite.name} maxLength={40} aria-label="Group name" onChange={e => setEditingInvite({ ...editingInvite, name: e.target.value })} />
          </div>
        </PaidActionDialog>;
      })()}
      {editingInvite && paintingInvite && <AvatarEditor account="group" avatar={editingInvite.avatar} title="🎨 Group picture"
        onClose={() => setPaintingInvite(false)} onSave={a => { setEditingInvite({ ...editingInvite, avatar: a }); setPaintingInvite(false); }} />}
      {editingFriend && <FriendNameDialog account={editingFriend} nickname={nicknames[editingFriend]} sharedName={names[editingFriend]} onClose={() => setEditingFriend(null)} onSave={name => {
        saveCryptName(account, editingFriend, name, 'nicknames'); setNicknames(loadCryptNames(account, 'nicknames')); setEditingFriend(null);
      }} />}
      {attachingNft && <Dialog open onOpenChange={o => { if (!o) setAttachingNft(false); }}>
        <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>🖼️ Attach an NFT</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">Pick any NFT. If it has sound, a play button appears in the chat. Only the NFT's asset ID is added to your encrypted message; the artwork and sound are public on WAX.</p>
          <WalletAvatarPicker account={account} busy={false} onPick={nft => {
            setText(t => `${t.trimEnd()}${t.trim() ? ' ' : ''}${nftToken(nft.asset_id)} `); setAttachingNft(false);
          }} />
        </DialogContent>
      </Dialog>}
      {profileEditor}
      {creationDialog}
      {showSharePrompt && key && <ShareKeyDialog account={account} busy={busy} agreed={agreed} onAgreedChange={setAgreed} onClose={() => setShowSharePrompt(false)}
        onDownload={() => { void sharePublicKey(); setShowSharePrompt(false); }}
        onPublish={async () => { if (await publish()) setShowSharePrompt(false); }} />}
      {sharingProfile && key && (() => {
        const to = profileRecipients(account, contacts, groups.map(g => g.members), [...blocked, ...removedContacts]);
        const parts = profileNoteParts(key);
        return <ProfileShareDialog recipients={to.map(nameFor)} cost={to.length ? profileNoteCost(parts, to.length) : ''} busy={busy}
          onClose={() => setSharingProfile(false)} onSend={async () => { if (await sendProfileNote(to)) setSharingProfile(false); }} />;
      })()}
      {showBlocked && <BlockedDialog blocked={blocked} onBlock={blockAccount} onUnblock={unblockAccount} onClose={() => setShowBlocked(false)} />}
      {addingFriend && <Dialog open onOpenChange={o => { if (!o) setAddingFriend(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>🤝 Add a friend</DialogTitle>
            <DialogDescription>Find them by WAX account (if they published their key) or import their public key file.</DialogDescription>
          </DialogHeader>
          <form className="flex gap-2" onSubmit={e => { e.preventDefault(); void addContact(); }}>
            <Input autoFocus value={newContact} maxLength={12} onChange={(e) => setNewContact(e.target.value)} placeholder="account.wam" aria-label="Friend's WAX account" />
            <Button type="submit" disabled={busy} className="bg-cheese text-primary-foreground hover:bg-cheese/90">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Find'}</Button>
          </form>
          <Button variant="outline" onClick={() => { setAddingFriend(false); fileRef.current?.click(); }}><Upload className="h-4 w-4" /> Import public key file</Button>
        </DialogContent>
      </Dialog>}
      <aside className="border-b md:border-b-0 md:border-r border-border flex flex-col min-h-0">
        <div className="flex flex-col gap-2 border-b border-border p-3">
          <div className="flex items-center gap-3">
            <PixelAvatar account={account} avatar={key.avatar} className="h-11 w-11 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-1">
                <span className="truncate text-base font-bold text-cheese">{key.displayName || account}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground hover:text-cheese" aria-label="Edit profile" title="Edit name and avatar" onClick={() => setEditingAvatar(true)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex items-center gap-1 truncate font-mono text-xs text-muted-foreground">
                {loading && <Loader2 className="h-3 w-3 shrink-0 animate-spin" />}
                <span className="truncate">{account}</span>
              </div>
            </div>
            <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" disabled={loading} onClick={refresh} aria-label="Refresh messages" title="Refresh messages">
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            <CardAction icon={<Upload className="h-4 w-4" />} label="Restore" aria-label="Load a key file (yours or a contact's)" title="Load a key file (yours or a contact's)" onClick={() => fileRef.current?.click()} />
            <CardAction icon={<Download className="h-4 w-4" />} label="Public key" aria-label="Share my public key file" title="Save my public key file to share" onClick={() => void sharePublicKey()} />
            <CardAction icon={<Radio className="h-4 w-4" />} label="Publish" disabled={busy} aria-label={`Publish my key on chain (${MESSAGE_FEE_QUANTITY})`} title={`Publish my key on chain (${MESSAGE_FEE_QUANTITY})`} onClick={() => void publish()} />
            <CardAction icon={<Save className="h-4 w-4" />} label="Back up" aria-label="Back up private key" title="Download a backup of my private key — never share it" onClick={() => download(`${account}-cheesecrypt-key-PRIVATE.json`, key)} />
            <CardAction icon={<Ban className="h-4 w-4" />} label={blocked.length ? `Blocked (${blocked.length})` : 'Blocked'} aria-label="Blocked accounts" title="Accounts blocked on this device" onClick={() => setShowBlocked(true)} />
            <CardAction icon={<KeyRound className="h-4 w-4" />} label="New key" className="hover:text-destructive" aria-label="Create a new key" title="Create a new key (it cannot read messages sent to this one)" onClick={makeKey} />
            <PublicInboxDialog enabled={publicInbox} onChange={enabled => { savePublicInbox(account, enabled); setPublicInbox(enabled); }} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          <MessageRequests requests={messageRequests} onAccept={acceptRequest} onDecline={dismissRequest} onBlock={from => { dismissRequest(from); blockAccount(from); }} />
          <Collapsible open={groupsOpen} onOpenChange={setGroupsOpen}>
            <div className="flex items-center justify-between px-2">
              <CollapsibleTrigger className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-cheese">
                <ChevronDown className={cn('h-3.5 w-3.5 transition', !groupsOpen && '-rotate-90')} /> 👥 Groups
              </CollapsibleTrigger>
              <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="New group" title="New group" onClick={() => setCreatingGroup(true)}><Users className="h-4 w-4" /></Button>
            </div>
            <CollapsibleContent>
              <ul className="space-y-1 pt-1">
          {inviteViews.filter(v => inviteShown(v) && !hiddenGroups.includes(v.invite.id)).sort((a, b) => Number(b.status === 'invited') - Number(a.status === 'invited') || a.name.localeCompare(b.name)).map(v => inviteRow(v, false))}
          {groups.filter(g => !hiddenGroups.includes(g.id)).map(g => groupRow(g, false))}
          {!groups.some(g => !hiddenGroups.includes(g.id)) && !inviteViews.some(v => inviteShown(v) && !hiddenGroups.includes(v.invite.id)) && <li className="text-xs text-muted-foreground px-2 pb-1">No groups yet.</li>}
          {(groups.some(g => hiddenGroups.includes(g.id)) || inviteViews.some(v => inviteShown(v) && hiddenGroups.includes(v.invite.id))) && <li>
            <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground" aria-expanded={showHiddenGroups} aria-controls="crypt-hidden-groups" onClick={() => setShowHiddenGroups(v => !v)}>
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', !showHiddenGroups && '-rotate-90')} />
              Hidden groups ({groups.filter(g => hiddenGroups.includes(g.id)).length + inviteViews.filter(v => inviteShown(v) && hiddenGroups.includes(v.invite.id)).length})
            </Button>
            {showHiddenGroups && <ul id="crypt-hidden-groups" className="space-y-1">
              {inviteViews.filter(v => inviteShown(v) && hiddenGroups.includes(v.invite.id)).map(v => inviteRow(v, true))}
              {groups.filter(g => hiddenGroups.includes(g.id)).map(g => groupRow(g, true))}</ul>}
          </li>}
              </ul>
            </CollapsibleContent>
          </Collapsible>
          <Collapsible open={friendsOpen} onOpenChange={setFriendsOpen}>
            <div className="flex items-center justify-between px-2">
              <CollapsibleTrigger className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-cheese">
                <ChevronDown className={cn('h-3.5 w-3.5 transition', !friendsOpen && '-rotate-90')} /> 🤝 Friends
              </CollapsibleTrigger>
              <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Add friend" title="Add friend" onClick={() => setAddingFriend(true)}><UserPlus className="h-4 w-4" /></Button>
            </div>
            <CollapsibleContent>
              <ul className="space-y-1 pt-1">
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
          {!partners.length && <li className="text-xs text-muted-foreground px-2 pb-2">{loading ? 'Loading…' : 'Add a friend to start chatting.'}</li>}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </aside>

      <section className="flex flex-col min-h-0">
        {!active ? (
          <p className="text-sm text-muted-foreground m-auto">💬 Pick or add a contact.</p>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-border font-semibold flex flex-wrap items-center gap-2">
              {activeInvite ? <div className="w-full space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  {activeInvite.avatar ? <PixelAvatar account={activeInvite.invite.id} avatar={activeInvite.avatar} className="h-7 w-7" /> : <span>👥</span>}
                  <span className="break-words">{activeInvite.name}</span>
                  <span className="text-[10px] font-normal text-muted-foreground">created by {nameFor(activeInvite.invite.creator)}</span>
                  <span className="ml-auto flex items-center gap-1">
                    {activeInvite.isCreator && activeInvite.status === 'joined' && <Button size="sm" variant="ghost" className="h-7 text-xs font-normal" onClick={() => setEditingInvite({ id: activeInvite.invite.id, name: activeInvite.name, avatar: activeInvite.avatar })}><Pencil className="h-3 w-3" /> Edit group</Button>}
                    {activeInvite.status === 'joined' && <Button size="sm" variant="ghost" className="h-7 text-xs font-normal text-destructive hover:text-destructive" onClick={() => setPendingNotice({ kind: 'leave', id: activeInvite.invite.id })}>🚪 Leave group</Button>}
                  </span>
                </div>
                <ul className="flex flex-wrap gap-x-3 gap-y-1" aria-label="Group members">
                  {activeInvite.invite.members.map(({ account: member }) => {
                    const isJoined = activeInvite.joined.includes(member);
                    const canRequest = member !== account && activeInvite.status === 'joined' && !contacts[member] && !blocked.includes(member) && !activeInvite.requested.includes(member) && !activeInvite.friendRequests.includes(member);
                    return <li key={member} className="flex items-center gap-1 text-xs font-normal min-w-0">
                      <PixelAvatar account={member} avatar={member === account ? key.avatar : avatars[member]} className="h-5 w-5 shrink-0" />
                      <span className="break-words">{nameFor(member)}{member === account && ' (you)'}</span>
                      <span className={cn('text-[10px]', isJoined ? 'text-cheese' : 'text-muted-foreground')}>{isJoined ? 'joined' : 'invited'}</span>
                      {canRequest && <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]" aria-label={`Send friend request to ${member}`} onClick={() => setPendingNotice({ kind: 'friend', id: activeInvite.invite.id, to: member })}><UserPlus className="h-3 w-3" /> Friend request</Button>}
                      {member !== account && activeInvite.requested.includes(member) && !contacts[member] && <span className="text-[10px] text-muted-foreground">request sent</span>}
                    </li>;
                  })}
                </ul>
                {activeInvite.friendRequests.filter(a => !contacts[a] && !blocked.includes(a) && !friendDeclines.includes(`${activeInvite.invite.id}:${a}`)).map(a =>
                  <div key={a} className="flex flex-wrap items-center gap-2 rounded-md border border-cheese/30 bg-cheese/10 px-2 py-1 text-xs font-normal">
                    🤝 {nameFor(a)} sent you a friend request.
                    <Button size="sm" className="h-6 text-[11px] bg-cheese text-primary-foreground hover:bg-cheese/90" onClick={() => setPendingNotice({ kind: 'friend-ok', id: activeInvite.invite.id, to: a })}>Accept</Button>
                    <Button size="sm" variant="outline" className="h-6 text-[11px]" onClick={() => setFriendDeclines(declineFriendRequest(account, activeInvite.invite.id, a))}>Decline</Button>
                  </div>)}
              </div> : activeGroup ? activeGroup.members.map(member => <span key={member} className="flex items-center gap-1 text-xs min-w-0">
                <PixelAvatar account={member} avatar={member === account ? key.avatar : avatars[member]} className="h-6 w-6 shrink-0" /><span className="break-words">{nameFor(member)}{member === account && ' (you)'}{nameFor(member) !== member && <span className="block text-[10px] text-muted-foreground">{member}</span>}</span>
                {member !== account && <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" aria-label={`Edit nickname for ${member}`} title={`Edit nickname for ${member}`} onClick={() => setEditingFriend(member)}><Pencil className="h-3 w-3" /></Button>}
              </span>) : <><PixelAvatar account={active} avatar={avatars[active]} /><span className="min-w-0 break-words">{nameFor(active)}{nameFor(active) !== active && <span className="block text-xs text-muted-foreground">{active}</span>}</span><Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label={`Edit nickname for ${active}`} title={`Edit nickname for ${active}`} onClick={() => setEditingFriend(active)}><Pencil className="h-3 w-3" /></Button></>}
              {!activeGroup && !activeInvite && <span className="ml-auto flex items-center gap-1">
                {contacts[active] && <Button size="sm" variant="ghost" className="h-7 text-xs font-normal" onClick={() => saveFriend(active, true)}>💾 Save to {FRIENDS_DIR}</Button>}
                <Button size="sm" variant="ghost" className="h-7 text-xs font-normal text-destructive hover:text-destructive" aria-label={`Block ${active}`}
                  onClick={() => { if (window.confirm(`Block ${active}? Their messages will be hidden on this device.`)) blockAccount(active); }}><Ban className="h-3.5 w-3.5" /> Block</Button>
              </span>}</div>
            <Dialog open={!!openQuote} onOpenChange={(o) => { if (!o) setOpenQuote(null); }}>
              <DialogContent className="max-w-lg">
                {openQuote && (() => {
                  const original = thread.find(x => x.from === openQuote.author && x.time === openQuote.time);
                  const full = original ? (parseReply(original.text)?.body ?? original.text) : null;
                  return <>
                    <DialogHeader>
                      <DialogTitle>↩️ {openQuote.author === account ? 'Your message' : nameFor(openQuote.author)}</DialogTitle>
                      <DialogDescription>{new Date(openQuote.time).toLocaleString()}{original?.txId && <> · <a href={`https://waxblock.io/transaction/${encodeURIComponent(original.txId)}`} target="_blank" rel="noreferrer" className="font-semibold text-cheese underline underline-offset-2">Tx</a></>}</DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap break-words text-sm">
                      {original?.voice ? <VoiceNoteBubble note={original.voice} />
                        : full != null ? parseNftMessage(full).map((seg, i) => seg.type === 'nft' ? <CryptNftCard key={i} assetId={seg.assetId} txId={original!.txId} /> : <span key={i} className="block">{seg.text}</span>)
                        : <><span className="block">{openQuote.quote || '…'}</span><span className="mt-2 block text-xs text-muted-foreground">The original message isn't loaded here, so this is the quoted snippet.</span></>}
                    </div>
                  </>;
                })()}
              </DialogContent>
            </Dialog>
            <div className="relative flex min-h-0 flex-1">
            <ol ref={listRef} aria-label="Chat messages" className="min-h-0 flex-1 overflow-y-auto space-y-2 p-4"
              onScroll={(e) => { const el = e.currentTarget; nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; replyNavigation.inspectVisible(); }}>
              {thread.map((m, i) => (
                <Fragment key={m.key}>
                  {i === firstNew && firstNew >= 0 && (
                    <li ref={newMarkerRef} aria-hidden className="flex items-center gap-2 py-1">
                      <span className="h-px flex-1 bg-border" />
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">New messages</span>
                      <span className="h-px flex-1 bg-border" />
                    </li>
                  )}
                  <ChatMessageItem m={m} account={account} keyAvatar={key?.avatar} avatars={avatars}
                    contacts={contacts} active={active} activeGroup={activeGroup} nameFor={nameFor}
                    highlighted={replyNavigation.highlighted.has(m.key)}
                    onReply={(x) => { setReplyingTo({ author: x.from, time: x.time, quote: quoteOf(x.text, !!x.voice) }); setVoice(null); setTimeout(() => composerRef.current?.focus(), 0); }}
                    onOpenQuote={setOpenQuote} openedAt={acceptedRequestMessages.current.has(m.key) ? { current: Infinity } : openedAt} />
                </Fragment>
              ))}
              {!thread.length && <li className="text-sm text-muted-foreground">{activeGroup || activeInvite ? 'No group messages yet.' : `No messages with ${nameFor(active)} yet.`}</li>}
              <li ref={endRef} aria-hidden />
            </ol>
            {replyNavigation.pending.length > 0 && <Button size="icon" title="Jump to your earliest unseen reply"
              aria-label={`Jump to earliest unseen reply (${replyNavigation.pending.length} remaining)`}
              onClick={replyNavigation.jump}
              className="absolute bottom-3 right-4 h-12 w-12 rounded-full bg-reply text-reply-foreground hover:bg-reply/90 font-bold text-sm ring-2 ring-background">
              @{replyNavigation.pending.length > 99 ? '99+' : replyNavigation.pending.length}
            </Button>}
            </div>
            {activeInvite?.status === 'invited' ? (
              <div className="space-y-2 p-4 border-t border-border text-sm">
                <p>✉️ <span className="font-semibold">{nameFor(activeInvite.invite.creator)}</span> invited you to <span className="font-semibold">{activeInvite.name}</span> with {activeInvite.invite.members.length - 1} other{activeInvite.invite.members.length > 2 ? 's' : ''}.</p>
                <p className="text-xs text-muted-foreground">Joining tells the other members in encrypted messages. Declining sends nothing.</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="bg-cheese text-primary-foreground hover:bg-cheese/90" onClick={() => setPendingNotice({ kind: 'joined', id: activeInvite.invite.id })}>Join</Button>
                  <Button size="sm" variant="outline" onClick={() => declineInvite(activeInvite.invite.id, false)}>Decline</Button>
                  <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => { if (window.confirm(`Decline and block ${activeInvite.invite.creator}? Their messages will be hidden on this device.`)) declineInvite(activeInvite.invite.id, true); }}>Decline and block</Button>
                </div>
              </div>
            ) : activeInvite?.status === 'left' ? (
              <p className="text-sm text-muted-foreground p-4 border-t border-border">You left this group. Your history stays readable here.</p>
            ) : activeInvite && !recipients.length ? (
              <p className="text-sm text-muted-foreground p-4 border-t border-border">Nobody else has joined yet. You can send messages once someone joins.</p>
            ) : missingKeys.length ? (
              <p className="text-sm text-muted-foreground p-4 border-t border-border">Public keys needed: {missingKeys.join(', ')}. Add them by name or load their public files.</p>
            ) : (
              <div className="space-y-2 p-4 border-t border-border">
                {replyingTo && <div className="flex items-start gap-2 rounded border-l-2 border-reply bg-muted px-2 py-1 text-xs">
                  <span className="min-w-0 flex-1"><span className="block font-semibold text-reply">↩️ Replying to {replyingTo.author === account ? 'yourself' : nameFor(replyingTo.author)}</span><span className="block truncate opacity-80">{replyingTo.quote || '…'}</span></span>
                  <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" aria-label="Cancel reply" onClick={() => setReplyingTo(null)}>✕</Button>
                </div>}
                <Textarea ref={composerRef} value={text} onChange={(e) => setText(e.target.value)} rows={3} disabled={!!voice} placeholder={voice ? 'Sending a voice note — discard it to type a message' : activeGroup || activeInvite ? 'Message group' : `Message ${nameFor(active)}`} />
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={!voice && tooLong ? 'text-destructive' : 'text-muted-foreground'}>
                    {voice ? `${voiceParts} parts · ${voiceTxs} transaction${voiceTxs > 1 ? 's' : ''}` : `${bytes}/${maxBytes} · ${parts || 1} part${parts > 1 ? 's' : ''}`}{(activeGroup || activeInvite) && ` × ${copies} recipients`}
                  </span>
                  {!voice && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setAttachingNft(true); }}>🖼️ Attach NFT</Button>}
                  {!text.trim() && <VoiceRecorder clip={voice} onChange={setVoice} disabled={busy} />}
                  <TermsCheckbox checked={agreed} onCheckedChange={setAgreed} className="ml-2" />
                  <span className="ml-auto text-muted-foreground">{totalCost}</span>
                  {voice
                    ? <Button size="sm" disabled={busy || !agreed} onClick={sendVoice} className="bg-cheese text-primary-foreground hover:bg-cheese/90">Send voice{voiceTxs > 1 ? ` (${voiceTxs} signatures)` : ''}</Button>
                    : <Button size="sm" disabled={busy || !agreed || !text.trim() || tooLong} onClick={send}
                      className="bg-cheese text-primary-foreground hover:bg-cheese/90">Send</Button>}
                </div>
                {voice && <p className="text-[11px] text-muted-foreground">🎙️ Voice note: {voiceParts} encrypted parts, up to {VOICE_PARTS_PER_TX} per transaction, signed one after another. A flat 1 CHEESE fee is paid once in the first transaction (0.8000 nulled, 0.2000 to xcheeseliqst), plus 0.0010 CHEESE per part to each recipient. If a later transaction fails, the parts already sent stay on chain and the note shows as incomplete.</p>}
                <p className="text-[11px] text-muted-foreground">
                  {activeInvite ? `Each part: ${MESSAGE_FEE_QUANTITY} shared platform fee for the group + ${MESSAGE_RECIPIENT_QUANTITY} to each of the ${copies} members who joined. Members who haven't joined don't get a copy.` : activeGroup ? `Each part: ${MESSAGE_FEE_QUANTITY} shared platform fee for the group + ${MESSAGE_RECIPIENT_QUANTITY} to each of ${copies} recipients. Group delivery uses ${copies} encrypted copies in one transaction. Membership is fixed; start a new group to change participants.` : `Each part: ${MESSAGE_RECIPIENT_QUANTITY} to ${active} + ${MESSAGE_FEE_QUANTITY} platform fee (${MESSAGE_TOTAL_QUANTITY}). Long messages split into up to ${MAX_PARTS} parts (${MAX_PLAINTEXT_BYTES} bytes for one, ${PART_BODY_BYTES} per part after that), all in one transaction.`}
                  {` Attaching an NFT raises the first part's platform fee to ${NFT_FEE_QUANTITY}. Platform fees split 80% to eosio.null and 20% to xcheeseliqst; recipient payments are unchanged.`}
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
