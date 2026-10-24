// CHEESECrypt — encrypted on-chain messages paid in CHEESE.
// Intentionally not linked from the header or menus: reachable at /crypt only.
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BlockedDialog } from '@/components/crypt/BlockedDialog';
import { PublicInboxDialog } from '@/components/crypt/PublicInbox';
import { decodeInboxRequests, declineRequest, inboxCandidates, loadPublicInbox, loadRequestDeclines, savePublicInbox } from '@/lib/cryptPublicInbox';
import { buildProfileNoteBatches, isProfileNote, latestProfiles, profileNoteCost, profileNoteParts, profileRecipients } from '@/lib/cryptProfileNotes';
import { ProfileShareDialog } from '@/components/crypt/ProfileShareDialog';
import { addBlocked, loadBlocked, removeBlocked, saveBlocked, withoutBlocked } from '@/lib/cryptBlocklist';
import { TermsCheckbox } from '@/components/shared/TermsCheckbox';
import { Eye, EyeOff, Loader2, Upload } from 'lucide-react';
import { useWax } from '@/context/WaxContext';
import { useWaxTransaction } from '@/hooks/useWaxTransaction';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { encodeReply, parseReply, quoteOf, type ReplyRef } from '@/lib/cryptReply';
import { useCryptReplyNavigation } from '@/hooks/useCryptReplyNavigation';
import { AvatarEditor, WalletAvatarPicker } from '@/components/crypt/AvatarEditor';
import { CryptNftCard } from '@/components/crypt/CryptNftCard';
import { useQuery } from '@tanstack/react-query';
import { nftToken, parseNftMessage } from '@/lib/cryptNft';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FriendNameDialog } from '@/components/crypt/FriendNameDialog';
import { cryptDisplayName, loadCryptNames, saveCryptName } from '@/lib/cryptNames';
import { accountAvatar, type CryptAvatar } from '@/lib/cryptAvatar';
import { PixelAvatar } from '@/components/crypt/PixelAvatar';
import { VaultPrompt } from '@/components/crypt/VaultPrompt';
import { CreateGroupDialog } from '@/components/crypt/CreateGroupDialog';
import { PaidActionDialog } from '@/components/crypt/PaidActionDialog';
import { buildCg2Actions, encodeAdmission, encodeMemberAdd, MAX_PUBLIC_ROOM_MEMBERS, collectInvites, deriveInviteGroups, encodeGroupText, encodeInvite, encodeMeta, encodeNotice, inviteTextSize, invitesSignature, loadDecisions, MAX_INVITE_MEMBERS, loadFriendDecisions, loadInvites, newInviteGroupId, saveDecision, saveInvites, scopedKeys, eventFromMember, VOICE_REF_PREFIX, type Cg2Event, type InviteGroup, type InviteGroupView } from '@/lib/cryptInviteGroups';
import { ShareKeyDialog } from '@/components/crypt/ShareKeyDialog';
import { VoiceNoteBubble } from '@/components/crypt/VoiceNoteBubble';
import { buildVoiceBatches, voiceNoteCost, voicePartCount, voiceTransactions, type VoiceClip } from '@/lib/cryptVoice';
import { baselineMarks, firstUnreadIndex, firstVisitMarks, loadReadMarks, mergeMarks, sameMarks, saveReadMarks, unreadCounts, unreadReplies, type ReadMarks } from '@/lib/cryptUnread';
import { readKeyFileJson } from '@/lib/cryptKeyFileText';
import { clearLockedEnvelope, isAnchorSession, loadLockedEnvelope, openLockedKey, parseLockedKeyFile, saveLockedEnvelope, sealKey, signLock, withProfile, ANCHOR_REQUIRED, type LockedKeyFile } from '@/lib/cryptKeyLock';
import { buildGroupMessageActions, decodeConversations, groupMessageCost, groupMessageSize, loadGroups, loadHiddenGroups, mergeGroups, saveGroups, setGroupHidden, type CryptGroup } from '@/lib/cryptGroups';
import {
  DirHandle, FRIENDS_DIR, PRIVATE_DIR, VAULT_DIR, VaultFileExistsError, friendKeyName, pickVault, privateKeyName,
  findPrivateKey, readFriendKeys, readVaultMarks, recallVault, writeVaultMarks, rememberVault, updatePrivateKeyProfile, replaceWithLocked, vaultSupported, vaultWritable, writeFriendKey, writeOwnPublicKey,
} from '@/lib/cryptVault';
import type { PublicKeyFile } from '@/lib/cheeseCrypt';
import { ChainMemo, MessagingKey, MAX_MESSAGE_BYTES, MAX_HISTORY_PAGES, MAX_PARTS, messageCost, partCount, splitMessage, buildCreateKeyActions, KEY_CREATION_QUANTITY, buildPublishKeyActions, buildSendMessageActions, encryptMemo, fetchMessages, generateKey, loadContacts, loadContactAvatars, loadKey, loadRemovedContacts, removeContact, lookupPublishedKey, parseKeyFile, plaintextBytes, saveContact, saveKey, toPublicFile } from '@/lib/cheeseCrypt';
import { download } from '@/components/crypt/cryptDownload';
import { ChatMessageItem } from '@/components/crypt/ChatMessageItem';
import { EditedMessagesDialog } from '@/components/crypt/EditedMessagesDialog';
import { encodeAdmin, encodeCollapse, encodeReport, encodeModeration, encodePolicySnapshot, encodeRoomPolicy, type MuteMinutes } from '@/lib/cryptInviteGroups';
import { applyCollapses, canCollapseAuthor, canMuteMember, collapsedKeys, collectReports, loadSeenReports, reportKey, saveSeenReports, deriveModeration, founderBadges, loadModerationMemos, mergeModerationMemos, moderateMessages, mutedUntil, restrictedAt, roomRole, saveModerationMemos } from '@/lib/cryptModeration';
import { applyEdits, canEdit, editTarget, encodeEdit, publicEditLog } from '@/lib/cryptEdits';
import type { ConversationEntry } from '@/lib/cryptGroups';
import { CryptHero } from '@/components/crypt/CryptHero';
import { CryptKeySetup } from '@/components/crypt/CryptKeySetup';
import { CryptSidebar } from '@/components/crypt/CryptSidebar';
import { CryptChatHeader } from '@/components/crypt/CryptChatHeader';
import { CryptComposer } from '@/components/crypt/CryptComposer';
import { DiscoverRoomsDialog, JoinRequests, RoomListingDialog } from '@/components/crypt/PublicRooms';
import { fetchRoomMemos } from '@/lib/cheeseCrypt';
import {
  buildRoomActions, collectJoinRequests, collectListings, decodeRoomEvents, declineJoin, encodeListing, encodeUnlist, listedRoomIds, loadJoinDeclines,
  loadLocalListings, loadRoomRequests, ROOM_PREFIX, saveLocalListing, saveRoomRequest, type JoinRequest, type RoomListing,
} from '@/lib/cryptRooms';

const ACCOUNT_RE = /^[a-z1-5.]{1,12}$/;
/** How often an open, visible messenger checks history for new messages. */
const LIVE_POLL_MS = 6000;

const CheeseCrypt = () => {
  const { accountName, isConnected, login, session } = useWax();

  return (
    <Layout>
      <CryptHero />

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
  // Wallet-locked envelope of the current key (no secret inside); present once the key's backup is locked.
  const [lockedFile, setLockedFile] = useState<LockedKeyFile | null>(() => { const k = loadKey(account); return k ? loadLockedEnvelope(account, k.publicKey) : null; });
  const keyLocked = !!lockedFile && !!key && lockedFile.publicKey === key.publicKey;
  const canLock = isAnchorSession(session);
  const signer = useCallback((publicKey: string) => signLock(session as unknown as Parameters<typeof signLock>[0], publicKey), [session]);
  /** Opens a wallet-locked file with one free Anchor signature (never broadcast). */
  const unlockFile = useCallback(async (file: LockedKeyFile) => {
    if (!isAnchorSession(session)) throw new Error(`This key is locked to ${file.account}. ${ANCHOR_REQUIRED}`);
    const opened = await openLockedKey(signer, file, account);
    saveKey(opened); setKey(opened); saveLockedEnvelope(file); setLockedFile(file);
    return opened;
  }, [session, signer, account]);
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  // Public rooms: listings are public; my requests, local list actions and join declines stay on this device.
  const [roomsOpen, setRoomsOpen] = useState(false);
  const [listingRoom, setListingRoom] = useState<string | null>(null);
  const [askingRoom, setAskingRoom] = useState<RoomListing | null>(null);
  const [acceptingJoin, setAcceptingJoin] = useState<JoinRequest | null>(null);
  const [localListings, setLocalListings] = useState(() => loadLocalListings(account));
  const [roomRequests, setRoomRequests] = useState(() => loadRoomRequests(account));
  const [joinDeclines, setJoinDeclines] = useState(() => loadJoinDeclines(account));
  const [feeInfoOpen, setFeeInfoOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [listHidden, setListHidden] = useState(() => { try { return localStorage.getItem(`cheesecrypt-sidebar-collapsed-${account}`) === '1'; } catch { return false; } });
  const toggleList = () => setListHidden(v => {
    try { localStorage.setItem(`cheesecrypt-sidebar-collapsed-${account}`, v ? '0' : '1'); } catch { /* storage unavailable */ }
    return !v;
  });
  const [memos, setMemos] = useState<ChainMemo[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [readMarks, setReadMarks] = useState<ReadMarks | null>(() => loadReadMarks(account));
  const [text, setText] = useState('');
  const [editingMessage, setEditingMessage] = useState<ConversationEntry | null>(null);
  const [editLogRoom, setEditLogRoom] = useState<string | null>(null);
  const [pendingModeration, setPendingModeration] = useState<{ id: string; member: string; action: 'mute' | 'ban' | 'admin' | 'unadmin' | 'collapse' | 'report'; minutes?: MuteMinutes; target?: string } | null>(null);
  const [seenReports, setSeenReports] = useState<string[]>(() => loadSeenReports(account));
  const [reportFocus, setReportFocus] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const [savedControls, setSavedControls] = useState(() => loadModerationMemos(account));
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
    if (found.version === 2) {
      // Never pop a wallet request on its own; a locked file opens only when you ask.
      if (!ask) return false;
      try { await unlockFile(found as LockedKeyFile); }
      catch (e) { toast({ title: 'Could not unlock your key', description: (e as Error).message, variant: 'destructive' }); return true; }
      toast({ title: 'Your messaging key was unlocked', description: `Found in your ${VAULT_DIR} folder.` });
      return true;
    }
    saveKey(found as MessagingKey); setKey(found as MessagingKey);
    toast({ title: 'Your messaging key was loaded', description: `Found in your ${VAULT_DIR} folder.` });
    return true;
  }, [account, toast, unlockFile]);
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
  const visibleMemos = useMemo(() => withoutBlocked(mergeModerationMemos(savedControls, memos), account, blocked), [memos, savedControls, account, blocked]);

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
  // Creators of public rooms I asked to join: their listing key reads only their invite to that room.
  const roomInviters = useMemo(() => Object.fromEntries(Object.values(roomRequests)
    .filter(r => contacts[r.creator] !== r.publicKey && !blocked.includes(r.creator)).map(r => [r.creator, r.publicKey])), [roomRequests, contacts, blocked]);
  const roomInviteEvents = useMemo(() => key && Object.keys(roomInviters).length ? decodeRoomEvents(visibleMemos, key, roomInviters)
    .filter(e => e.to === account && roomRequests[(e.control.kind === 'invite' || e.control.kind === 'admission') ? e.control.invite.id : e.control.id]?.creator === e.from && (e.control.kind === 'invite' || e.control.kind === 'admission' || e.control.kind === 'policy' || e.control.kind === 'room' || e.control.kind === 'add')) : [], [visibleMemos, key, roomInviters, roomRequests, account]);
  const allGroupEvents = useMemo(() => [...new Map([...cg2Events, ...roomInviteEvents].map(e => [e.key, e])).values()], [cg2Events, roomInviteEvents]);
  const invites = useMemo(() => key ? collectInvites(allGroupEvents, account, key.publicKey, contacts, inviteStore, roomRequests) : inviteStore,
    [allGroupEvents, account, key, contacts, inviteStore, roomRequests]);
  useEffect(() => {
    // Compares member keys too, so a creator adding members to a known group is saved.
    if (invitesSignature(invites) === invitesSignature(inviteStore)) return;
    saveInvites(account, invites); setInviteStore(invites);
  }, [invites, inviteStore, account]);
  const moderation = useMemo(() => deriveModeration(allGroupEvents, invites, account), [allGroupEvents, invites, account]);
  useEffect(() => {
    const controlTxs = new Set(allGroupEvents.filter(e => (e.control.kind === 'invite' || e.control.kind === 'admission') || e.control.kind === 'add' || e.control.kind === 'room' || e.control.kind === 'mute' || e.control.kind === 'ban' || e.control.kind === 'policy' || e.control.kind === 'admin' || e.control.kind === 'collapse' || e.control.kind === 'report').filter(e => {
      if ((e.control.kind === 'invite' || e.control.kind === 'admission')) return invites[e.control.invite.id]?.creator === e.from;
      return !!eventFromMember(e, invites, account);
    }).map(e => e.txId));
    const next = mergeModerationMemos(savedControls, memos.filter(m => controlTxs.has(m.txId)));
    if (next.length === savedControls.length) return;
    saveModerationMemos(account, next); setSavedControls(next);
  }, [allGroupEvents, invites, account, memos, savedControls]);
  const inviteViews = useMemo(() => deriveInviteGroups(cg2Events.filter(e => e.control.kind !== 'msg' || !restrictedAt(moderation[e.control.id], e.from, e.time)), invites, account, decisions).map(v => {
    const banned = moderation[v.invite.id]?.bans ?? {};
    return { ...v, joined: v.joined.filter(a => banned[a] === undefined) };
  }), [cg2Events, invites, account, decisions, moderation]);
  const { data: roomMemos, isFetching: roomsLoading, refetch: refetchRooms } = useQuery({
    queryKey: ['crypt-rooms'], enabled: !!key, queryFn: () => fetchRoomMemos(ROOM_PREFIX),
    staleTime: 60_000, refetchInterval: () => (document.visibilityState === 'visible' ? 60_000 : false), retry: false,
  });
  const listings = useMemo(() => collectListings(roomMemos ?? []).filter(l => !blocked.includes(l.creator)), [roomMemos, blocked]);
  const myRoomIds = useMemo(() => inviteViews.filter(v => v.isCreator && v.status === 'joined').map(v => v.invite.id), [inviteViews]);
  const listedIds = useMemo(() => listedRoomIds(account, listings, myRoomIds, localListings), [account, listings, myRoomIds, localListings]);
  /** Accounts known only through an invite group; they stay out of Friends and key discovery until a friend request is accepted. */
  const groupOnly = useMemo(() => {
    const s = new Set<string>();
    Object.values(invites).forEach(g => g.members.forEach(m => { if (m.account !== account && !contacts[m.account]) s.add(m.account); }));
    return s;
  }, [invites, account, contacts]);
  // Profile notes and group notices update state and never appear as chat messages or unread badges.
  // Invite-group messages/voice show only when they come from a member with that member's invite key.
  const editableConversations = useMemo(() => decoded.filter(c => {
    if (isProfileNote(c.text)) return false;
    if (!c.igroup) return !!c.group || !!contacts[c.from === account ? c.to : c.from];
    if (c.control && c.control.kind !== 'msg') return false;
    if (!c.usedKey) return false;
    const view = inviteViews.find(v => v.invite.id === c.igroup);
    return !!view && view.status !== 'declined' && !!eventFromMember({ key: c.key, txId: c.txId, time: c.time, from: c.from, to: c.to, control: { kind: 'joined', id: c.igroup }, usedKey: c.usedKey }, invites, account);
  }), [decoded, inviteViews, invites, account, contacts]);
  const edited = useMemo(() => {
    const originals = moderateMessages(editableConversations, moderation);
    const collapsed = collapsedKeys(originals, moderation);
    const targets = new Map(originals.map(m => [m.key, editTarget(m)]));
    const result = applyEdits(originals);
    return { ...result, targets, messages: applyCollapses(moderateMessages(result.messages, moderation), collapsed), log: result.log.filter(e => !e.original.igroup || !restrictedAt(moderation[e.original.igroup], e.original.from, e.original.time) && !restrictedAt(moderation[e.original.igroup], e.original.from, e.at)) };
  }, [editableConversations, moderation]);
  // Older originals may fall behind a recent edit; read further before resolving them.
  useEffect(() => {
    if (!memos.length || depth >= MAX_HISTORY_PAGES) return;
    const oldest = Math.min(...memos.map(m => m.time));
    if ((listedIds.size > 0 && clock - oldest < 72 * 60 * 60 * 1000) || editableConversations.some(m => (m.text?.startsWith('\u0005E1:') || m.voice?.editTarget) && !edited.log.some(e => e.replacement.editTxId === m.txId))) setDepth(d => Math.min(MAX_HISTORY_PAGES, d + 1));
  }, [memos, depth, listedIds, clock, editableConversations, edited]);
  const conversations = edited.messages;
  useEffect(() => {
    // Restore retained policies on another device by reading the bounded history window in full.
    if (Object.keys(invites).length && loaded && depth < MAX_HISTORY_PAGES) setDepth(d => d + 1);
  }, [invites, loaded, depth]);
  const cancelEdit = () => { setEditingMessage(null); setText(''); setVoice(null); setReplyingTo(null); };
  useEffect(() => { setEditingMessage(null); setText(''); }, [active]);
  const beginEdit = (m: ConversationEntry) => {
    const original = editableConversations.find(x => x.key === m.key);
    if (!original || !canEdit(original, account) || busy) return;
    setEditingMessage(original); setReplyingTo(parseReply(m.text)); setText(parseReply(m.text)?.body ?? m.text ?? ''); setVoice(null);
    setTimeout(() => composerRef.current?.focus({ preventScroll: true }), 0);
  };
  const partners = useMemo(() => {
    const s = new Set(Object.keys(contacts));
    return [...s].filter(name => !removedContacts.includes(name) && !blocked.includes(name) && !groupOnly.has(name)).sort();
  }, [contacts, visibleMemos, account, removedContacts, blocked, groupOnly]);
  const requestCandidates = useMemo(() => inboxCandidates(visibleMemos, account,
    new Set([...Object.keys(contacts), ...groupOnly, ...blocked, ...removedContacts, ...groups.flatMap(g => g.members)])),
    [visibleMemos, account, contacts, groupOnly, blocked, removedContacts, groups]);
  const { data: requestKeys = {} } = useQuery({
    queryKey: ['crypt-inbox-keys', account, key?.publicKey, requestCandidates],
    // Also looked up while I list a room, but then only used to read join requests (never message requests).
    enabled: (publicInbox || listedIds.size > 0) && !!key && requestCandidates.length > 0,
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
  const strangerJoinEvents = useMemo(() => key && listedIds.size ? decodeRoomEvents(visibleMemos, key,
    Object.fromEntries(requestCandidates.flatMap(from => requestKeys[from] ? [[from, requestKeys[from]]] : []))) : [],
    [key, listedIds, visibleMemos, requestCandidates, requestKeys]);
  const joinRequests = useMemo(() => collectJoinRequests([...cg2Events, ...strangerJoinEvents], account, listedIds,
    Object.fromEntries(Object.values(invites).map(g => [g.id, g.members.map(m => m.account)])), blocked, joinDeclines),
    [cg2Events, strangerJoinEvents, account, listedIds, invites, blocked, joinDeclines]);
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
  const activeModeration = activeInvite ? moderation[activeInvite.invite.id] : undefined;
  const roomBanned = activeModeration?.bans[account] !== undefined;
  const roomMutedUntil = mutedUntil(activeModeration, account, clock);
  const roomRestricted = roomBanned || !!roomMutedUntil;
  const myRoomRole = !activeInvite || activeInvite.status !== 'joined' ? 'member' : activeInvite.isCreator ? (listedIds.has(activeInvite.invite.id) ? 'owner' : 'member') : roomRole(activeModeration, activeInvite.invite, account, clock);
  const collapseTarget = (m: ConversationEntry) => {
    const target = edited.targets.get(m.key);
    if (!activeInvite || myRoomRole === 'member' || !target || !m.txId || m.missing || busy) return null;
    return myRoomRole === 'owner' || canCollapseAuthor(activeModeration, activeInvite.invite, account, m.from, clock) ? target : null;
  };
  const reportAction = (m: ConversationEntry) => {
    const target = edited.targets.get(m.key);
    if (!activeInvite || activeInvite.status !== 'joined' || myRoomRole === 'owner' || busy || roomRestricted || !target || !m.txId || m.missing || m.from === account || m.from === activeInvite.invite.creator || !listedIds.has(activeInvite.invite.id) || !activeModeration?.listed) return undefined;
    return { toOwner: myRoomRole === 'admin', onReport: () => setPendingModeration({ id: activeInvite.invite.id, member: m.from, action: 'report', target }) };
  };
  // Right-click moderation of a message's author; mirrors what moderationPlan accepts.
  const authorModeration = (m: ConversationEntry) => {
    if (!activeInvite || myRoomRole === 'member' || busy || m.from === account || m.from === activeInvite.invite.creator) return {};
    const id = activeInvite.invite.id, g = activeInvite.invite, state = activeModeration;
    if (!g.members.some(x => x.account === m.from) || state?.bans[m.from] !== undefined) return {};
    const owner = myRoomRole === 'owner';
    const muteState = state ?? { listed: true, protected: [], bans: {}, mutes: {}, admins: [], collapses: {} };
    return {
      onMute: canMuteMember(muteState, g, account, m.from, clock) ? (minutes: MuteMinutes) => setPendingModeration({ id, member: m.from, action: 'mute', minutes }) : undefined,
      ban: owner ? { disabled: founderBadges(state, g, true).includes(m.from), onBan: () => setPendingModeration({ id, member: m.from, action: 'ban' }) } : undefined,
      adminToggle: owner ? { isAdmin: !!state?.admins.includes(m.from), onToggle: () => setPendingModeration({ id, member: m.from, action: state?.admins.includes(m.from) ? 'unadmin' : 'admin' }) } : undefined,
    };
  };
  const inviteKeys = useMemo(() => activeInvite ? Object.fromEntries(activeInvite.invite.members.map(m => [m.account, m.publicKey])) : {}, [activeInvite]);
  const currentRecipients = activeInvite ? activeInvite.joined.filter(m => m !== account) : activeGroup ? activeGroup.members.filter(m => m !== account) : active ? [active] : [];
  // Edits go to the original recipients, not newly joined members who never received the original.
  const originalRecipients = useMemo(() => {
    if (!editingMessage || !key) return [];
    const candidates = [...new Set(visibleMemos.filter(m => m.from === account && m.txId === editingMessage.txId).map(m => m.to))];
    return candidates.filter(to => decodeConversations(visibleMemos.filter(m => m.from === account && m.to === to), key, contacts, clock, scoped)
      .some(m => m.igroup === editingMessage.igroup && m.group?.id === editingMessage.group?.id && editTarget(m) === editTarget(editingMessage)));
  }, [editingMessage, key, visibleMemos, account, contacts, clock, scoped]);
  const recipients = (editingMessage ? originalRecipients : currentRecipients).filter(a => activeModeration?.bans[a] === undefined);
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
  const unread = useMemo(() => readMarks ? unreadCounts(conversations, account, readMarks) : {}, [conversations, account, readMarks]);
  const replyUnread = useMemo(() => readMarks ? unreadReplies(conversations, account, readMarks) : {}, [conversations, account, readMarks]);
  // Two badges per room: cheese yellow for unread messages, reply blue for unread replies to you.
  // Both stay on the open room and count down live as messages scroll into view (onRead advances the read marker).
  const badge = (id: string) => {
    const u = unread[id] ?? 0, r = replyUnread[id] ?? 0;
    if (!u && !r) return null;
    return <span className="ml-auto flex shrink-0 items-center gap-1">
      {u > 0 && <span aria-label={`${u} unread`} className="min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold leading-5 text-center bg-cheese text-primary-foreground">{u > 99 ? '99+' : u}</span>}
      {r > 0 && <span aria-label={`${r} repl${r > 1 ? 'ies' : 'y'} to you`} data-reply="true" className="min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold leading-5 text-center bg-reply text-reply-foreground">↩ {r > 99 ? '99+' : r}</span>}
    </span>;
  };
  /** Totals for chats other than the open one, shown on the show-sidebar arrow while the list is hidden. */
  const hiddenUnread = Object.entries(unread).reduce((n, [id, c]) => id === active ? n : n + c, 0);
  const hiddenReplies = Object.entries(replyUnread).reduce((n, [id, c]) => id === active ? n : n + c, 0);


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
  const replyNavigation = useCryptReplyNavigation(account, active, thread, resumeAt, listRef, (time) => {
    if (!active || !readMarks || time <= (readMarks[active] ?? 0)) return;
    const next = { ...readMarks, [active]: time };
    saveReadMarks(account, next); setReadMarks(next);
  });
  // Reports addressed to me in the open room, matched to their message row by author + pre-edit digest.
  const reportedRows = useMemo(() => {
    if (!activeInvite || activeInvite.status !== 'joined') return [] as { report: string; key: string }[];
    const rows = new Map<string, string>();
    for (const [k, t] of edited.targets) { const m = editableConversations.find(x => x.key === k); if (m && m.igroup === activeInvite.invite.id) rows.set(`${m.from}:${t}`, k); }
    const shown = new Set(thread.map(m => m.key));
    return collectReports(allGroupEvents, invites, moderation, account).filter(r => r.id === activeInvite.invite.id)
      .flatMap(r => { const key = rows.get(`${r.author}:${r.target}`); return key && shown.has(key) ? [{ report: reportKey(r), key }] : []; });
  }, [activeInvite, edited.targets, editableConversations, thread, allGroupEvents, invites, moderation, account]);
  const pendingReports = reportedRows.filter(r => !seenReports.includes(r.report));
  const jumpToReport = () => {
    const next = pendingReports[0];
    if (!next) return;
    const viewed = pendingReports.filter(r => r.key === next.key).map(r => r.report);
    const keys = [...new Set([...seenReports, ...viewed])];
    saveSeenReports(account, keys); setSeenReports(keys); setReportFocus(next.key);
    listRef.current?.querySelector<HTMLElement>(`[data-reply-key="${CSS.escape(next.key)}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };
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
    // Profile fields sit outside the seal, so a locked backup refreshes without a new signature.
    const lockedNow = keyLocked && lockedFile ? withProfile(lockedFile, updated) : null;
    if (lockedNow) { saveLockedEnvelope(lockedNow); setLockedFile(lockedNow); }
    try {
      if (!vault || !(await vaultWritable(vault, true))) throw new Error('Folder access unavailable');
      await updatePrivateKeyProfile(vault, updated);
      await writeOwnPublicKey(vault, toPublicFile(updated)).catch(() => {});
      toast({ title: 'Profile and private backup updated', description: 'Share your updated public key file so friends see your name and avatar.' });
    } catch {
      download(privateKeyName(account), lockedNow ?? updated);
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
      clearLockedEnvelope(account); setLockedFile(null);
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

  /** Seals the current key to this Anchor wallet (two free signatures, never broadcast) and replaces the plain backup. */
  const lockKey = async () => {
    if (!key || busy) return;
    if (!canLock) { toast({ title: 'Anchor needed', description: ANCHOR_REQUIRED, variant: 'destructive' }); return; }
    setBusy(true);
    try {
      const file = await sealKey(signer, key, account);
      saveLockedEnvelope(file); setLockedFile(file);
      try {
        if (!vault || !(await vaultWritable(vault, true))) throw new Error('Folder access unavailable');
        await replaceWithLocked(vault, file, key);
        toast({ title: 'Key locked to your wallet', description: `Your ${VAULT_DIR} backup is now locked. Delete any other copies of the old unlocked file.` });
      } catch {
        download(privateKeyName(account), file);
        toast({ title: 'Locked key downloaded', description: 'Replace your old key file with it and delete the old unlocked copy.' });
      }
    } catch (e) {
      toast({ title: 'Key not locked', description: (e as Error).message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const onFile = async (f: File) => {
    try {
      const json = await readKeyFileJson(f);
      const lockedIn = parseKeyFile(json) ? null : parseLockedKeyFile(json);
      if (lockedIn) {
        if (lockedIn.account !== account) { toast({ title: `That private key is locked to ${lockedIn.account}`, variant: 'destructive' }); return; }
        try { await unlockFile(lockedIn); toast({ title: 'Your messaging key was unlocked' }); }
        catch (e) { toast({ title: 'Could not unlock your key', description: (e as Error).message, variant: 'destructive' }); }
        return;
      }
      const parsed = parseKeyFile(json);
      if (!parsed) throw new Error();
      if (parsed.type === 'gpk-msg-key') {
        if (parsed.account !== account) { toast({ title: `That private key belongs to ${parsed.account}`, variant: 'destructive' }); return; }
        saveKey(parsed); setKey(parsed);
        const env = loadLockedEnvelope(account, parsed.publicKey); setLockedFile(env);
        toast(env ? { title: 'Your messaging key was loaded' } : { title: 'Your messaging key was loaded', description: "This file isn't locked to your wallet. Use Menu → Lock key so a copied file can't read your messages." });
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
    if (activeInvite && (activeInvite.status !== 'joined' || restrictedAt(activeModeration, account, Date.now()))) return;
    if (editingMessage && !canEdit(editingMessage, account)) { toast({ title: 'The 24-hour editing window has ended', variant: 'destructive' }); return; }
    setBusy(true);
    try {
      const actions = activeInvite ? buildCg2Actions(key, recipients, inviteKeys, encodeGroupText(activeInvite.invite.id, outgoing), [permission], hasNft)
        : activeGroup ? buildGroupMessageActions(key, activeGroup, outgoing, contacts, [permission], hasNft)
        : buildSendMessageActions(account, active, splitMessage(outgoing).map(p => encryptMemo(p, contacts[active], key.secretKey)), [permission], hasNft);
      const r = await executeTransaction(actions, { successTitle: editingMessage ? 'Message edited' : 'Message sent' });
      if (r.success && r.txId) { setText(''); setReplyingTo(null); if (!editingMessage) nearBottom.current = true; setEditingMessage(null); [2000, 5000, 10000].forEach(ms => setTimeout(poll, ms)); }
    } catch (e) { toast({ title: 'Could not send', description: (e as Error).message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };

  /** Signs each batch of up to 30 parts in turn; parts already sent stay on chain if a later one fails. */
  const sendVoice = async () => {
    if (!key || !active || !voice || missingKeys.length || !agreed) return;
    if (activeInvite && (activeInvite.status !== 'joined' || restrictedAt(activeModeration, account, Date.now()))) return;
    if (editingMessage && !canEdit(editingMessage, account)) { toast({ title: 'The 24-hour editing window has ended', variant: 'destructive' }); return; }
    setBusy(true);
    let sent = 0, total = 0;
    try {
      const batches = buildVoiceBatches(key, recipients, activeInvite ? { id: `${VOICE_REF_PREFIX}${activeInvite.invite.id}`, members: ['-'] } : activeGroup ?? null, voice, activeInvite ? inviteKeys : contacts, [permission], undefined, editingMessage ? editTarget(editingMessage) : undefined);
      total = batches.length;
      for (let i = 0; i < batches.length; i++) {
        if (activeInvite && restrictedAt(activeModeration, account, Date.now())) throw new Error('You are muted or removed from this room.');
        if (editingMessage && !canEdit(editingMessage, account)) throw new Error('The 24-hour editing window has ended.');
        const r = await executeTransaction(batches[i], { successTitle: total > 1 ? `Voice note: transaction ${i + 1} of ${total} sent` : 'Voice note sent' });
        if (!r.success || !r.txId) break;
        sent++;
      }
    } catch (e) { toast({ title: 'Could not send voice note', description: (e as Error).message, variant: 'destructive' }); }
    finally {
      setBusy(false);
      if (sent && sent === total) { setVoice(null); setText(''); setReplyingTo(null); if (!editingMessage) nearBottom.current = true; setEditingMessage(null); }
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
    if (!invite || invite.members.length > MAX_INVITE_MEMBERS) return false;
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
    if (n.kind === 'joined' && moderation[n.id]?.bans[account] !== undefined) return null;
    const others = v.invite.members.map(m => m.account).filter(a => a !== account && moderation[n.id]?.bans[a] === undefined);
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
    const to = v.invite.members.map(m => m.account).filter(a => a !== account && moderation[v.invite.id]?.bans[a] === undefined);
    if (!(await sendCg2(to, keysOf(v.invite), payload, 'Group updated'))) return false;
    setEditingInvite(null);
    return true;
  };

  // ---- public rooms ----
  const roomJoinCost = cg2Cost(encodeNotice('join', '0'.repeat(16)), 1);
  const roomStatus = (l: RoomListing) => {
    if (l.creator === account) return 'own' as const;
    const v = viewById(l.id);
    if (v && v.status === 'invited') return 'invited' as const;
    if (v && v.status !== 'declined') return 'member' as const;
    return roomRequests[l.id] ? 'requested' as const : null;
  };
  const askToJoin = async (l: RoomListing) => {
    if (!key || l.creator === account || blocked.includes(l.creator)) return false;
    setBusy(true);
    let mine: string | null = null;
    try { mine = await lookupPublishedKey(account); }
    catch { toast({ title: 'Key lookup failed', description: 'History servers did not answer. Try again shortly.', variant: 'destructive' }); return false; }
    finally { setBusy(false); }
    if (mine !== key.publicKey) {
      toast({ title: 'Publish your public key first', description: 'Use Menu → Publish so the room creator can read your request.', variant: 'destructive' });
      return false;
    }
    if (!(await sendCg2([l.creator], { [l.creator]: l.publicKey }, encodeNotice('join', l.id), `Request sent to ${l.creator}`))) return false;
    setRoomRequests(saveRoomRequest(account, l));
    setAskingRoom(null);
    return true;
  };
  const listRoom = async (id: string, info: { name: string; topic: string; tags: string[] }) => {
    const v = viewById(id);
    if (!key || !v || !v.isCreator) return false;
    let memo: string;
    try { memo = encodeListing({ id, ...info, publicKey: key.publicKey, members: Math.max(1, v.joined.length) }); }
    catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); return false; }
    // Publish the immutable protected roster privately to every member in the same paid transaction.
    const protectedMembers = moderation[id]?.protected ?? v.invite.members.map(m => m.account);
    const payload = encodeRoomPolicy(id, true, protectedMembers);
    const to = v.invite.members.map(m => m.account).filter(a => a !== account);
    return sendRoomPolicy(v, memo, payload, to, true);
  };
  const sendRoomPolicy = async (v: InviteGroupView, memo: string, payload: string, to: string[], listed: boolean) => {
    if (!key || busy) return false;
    setBusy(true);
    try {
      const actions = [...buildRoomActions(account, memo, [permission]), ...buildCg2Actions(key, to, keysOf(v.invite), payload, [permission])];
      const r = await executeTransaction(actions, { successTitle: listed ? 'Room listed' : 'Room unlisted' });
      if (!r.success || !r.txId) return false;
      setLocalListings(saveLocalListing(account, v.invite.id, listed));
      await refresh(); void refetchRooms();
      return true;
    } catch (e) { toast({ title: 'Room update failed', description: (e as Error).message, variant: 'destructive' }); return false; }
    finally { setBusy(false); }
  };
  const unlistRoom = (id: string) => {
    const v = viewById(id);
    if (!v?.isCreator) return Promise.resolve(false);
    if (v.invite.members.length > MAX_INVITE_MEMBERS) { toast({ title: 'Rooms larger than eight members must stay public', variant: 'destructive' }); return Promise.resolve(false); }
    return sendRoomPolicy(v, encodeUnlist(id), encodeRoomPolicy(id, false, moderation[id]?.protected ?? v.invite.members.map(m => m.account)), v.invite.members.map(m => m.account).filter(a => a !== account), false);
  };
  const moderationPlan = (n: NonNullable<typeof pendingModeration>) => {
    const v = viewById(n.id), state = moderation[n.id];
    if (!v || v.status !== 'joined' || !v.invite.members.some(m => m.account === n.member) || state?.bans[n.member] !== undefined) return null;
    const now = Date.now(), owner = v.isCreator;
    if (n.action === 'report') {
      // Members report to the owner and current admins; admins escalate to the owner only. Owners ban directly.
      const role = roomRole(state, v.invite, account, now);
      if (owner || !listedIds.has(n.id) || !state?.listed || !n.target || n.member === account || n.member === v.invite.creator || restrictedAt(state, account, now)) return null;
      const to = role === 'admin' ? [v.invite.creator] : [v.invite.creator, ...state.admins.filter(a => a !== account && !restrictedAt(state, a, now) && v.invite.members.some(m => m.account === a))];
      const payload = encodeReport(n.id, n.member, n.target, role === 'admin' ? 'owner' : 'admin');
      return { v, to, payload, policy: null, cost: `${parseFloat(cg2Cost(payload, to.length)).toFixed(4)} CHEESE` };
    }
    // Owners act on their own listing; admins only inside a verified public-room policy.
    if (owner ? !listedIds.has(n.id) : roomRole(state, v.invite, account, now) !== 'admin') return null;
    let payload: string;
    if (n.action === 'mute') { if (!n.minutes || !canMuteMember(state ?? { listed: true, protected: [], bans: {}, mutes: {}, admins: [], collapses: {} }, v.invite, account, n.member, now)) return null; payload = encodeModeration(n.id, n.member, n.minutes); }
    else if (n.action === 'ban') { if (!owner || !state || state.protected.includes(n.member) || n.member === account) return null; payload = encodeModeration(n.id, n.member); }
    else if (n.action === 'admin' || n.action === 'unadmin') { if (!owner || n.member === account || (n.action === 'admin') === !!state?.admins.includes(n.member)) return null; payload = encodeAdmin(n.id, n.member, n.action === 'admin'); }
    else { if (!n.target || (!owner && !canCollapseAuthor(state, v.invite, account, n.member, now)) || state?.collapses[`${n.member}:${n.target}`]) return null; payload = encodeCollapse(n.id, n.member, n.target); }
    const policy = !state && owner ? encodeRoomPolicy(n.id, true, v.invite.members.map(m => m.account)) : null;
    const to = v.invite.members.map(m => m.account).filter(a => a !== account && state?.bans[a] === undefined);
    if (!to.length) return null;
    return { v, to, payload, policy, cost: `${(parseFloat(cg2Cost(payload, to.length)) + (policy ? parseFloat(cg2Cost(policy, to.length)) : 0)).toFixed(4)} CHEESE` };
  };
  const moderationTitles = { mute: 'Member muted', ban: 'Member removed', admin: 'Admin appointed', unadmin: 'Admin removed', collapse: 'Message collapsed', report: 'Report sent' } as const;
  const confirmModeration = async () => {
    if (!key || !pendingModeration || busy) return false;
    const plan = moderationPlan(pendingModeration);
    if (!plan) return false;
    setBusy(true);
    try {
      const actions = [...(plan.policy ? buildCg2Actions(key, plan.to, keysOf(plan.v.invite), plan.policy, [permission]) : []), ...buildCg2Actions(key, plan.to, keysOf(plan.v.invite), plan.payload, [permission])];
      const r = await executeTransaction(actions, { successTitle: moderationTitles[pendingModeration.action] });
      if (!r.success || !r.txId) return false;
      setPendingModeration(null); await refresh();
      return true;
    } catch (e) { toast({ title: 'Moderation failed', description: (e as Error).message, variant: 'destructive' }); return false; }
    finally { setBusy(false); }
  };
  /** The creator adds the requester by sending the grown invite to every member (old members keep their keys). */
  const joinPlan = (r: JoinRequest) => {
    const v = viewById(r.groupId);
    if (!v || !v.isCreator || !listedIds.has(r.groupId) || v.invite.members.length >= MAX_PUBLIC_ROOM_MEMBERS || v.invite.members.some(m => m.account === r.from) || moderation[r.groupId]?.bans[r.from] !== undefined) return null;
    if (v.invite.members.length > MAX_INVITE_MEMBERS && !moderation[r.groupId]?.listed) return null;
    const updated: InviteGroup = { ...v.invite, publicRoom: true, members: [...v.invite.members, { account: r.from, publicKey: r.publicKey }] };
    let payload: string;
    try { payload = encodeAdmission(updated); } catch { return null; }
    const to = v.invite.members.map(m => m.account).filter(a => a !== account && moderation[v.invite.id]?.bans[a] === undefined);
    const delta = encodeMemberAdd(v.invite, { account: r.from, publicKey: r.publicKey });
    const state = moderation[updated.id];
    const policy = encodeRoomPolicy(updated.id, true, state?.protected ?? v.invite.members.map(m => m.account));
    const snapshot = encodePolicySnapshot(updated.id, state?.protected ?? v.invite.members.map(m => m.account), Object.keys(state?.bans ?? {}), Object.entries(state?.mutes ?? {}).flatMap(([a, intervals]) => {
      const longest = intervals.filter(m => m.until > Date.now()).sort((a, b) => b.until - a.until)[0];
      return longest ? [[a, longest.from, longest.until] as [string, number, number]] : [];
    }), state?.admins ?? []);
    return { v, updated, payload, delta, policy, snapshot, to, cost: `${(parseFloat(cg2Cost(payload, 1)) + parseFloat(cg2Cost(delta, to.length)) + parseFloat(cg2Cost(policy, to.length + 1)) + parseFloat(cg2Cost(snapshot, 1))).toFixed(4)} CHEESE` };
  };
  const confirmJoin = async () => {
    if (!acceptingJoin || busy) return false;
    const plan = joinPlan(acceptingJoin);
    if (!plan) { toast({ title: 'This room is full or the request is out of date', variant: 'destructive' }); setAcceptingJoin(null); return false; }
    if (!key) return false;
    const actions = [...buildCg2Actions(key, [acceptingJoin.from], keysOf(plan.updated), plan.payload, [permission]), ...buildCg2Actions(key, plan.to, keysOf(plan.updated), plan.delta, [permission]), ...buildCg2Actions(key, [acceptingJoin.from], keysOf(plan.updated), plan.snapshot, [permission]), ...buildCg2Actions(key, [...plan.to, acceptingJoin.from], keysOf(plan.updated), plan.policy, [permission])];
    setBusy(true);
    let r;
    try { r = await executeTransaction(actions, { successTitle: `${acceptingJoin.from} invited to ${plan.v.name}` }); }
    catch (e) { toast({ title: 'Invite failed', description: (e as Error).message, variant: 'destructive' }); return false; }
    finally { setBusy(false); }
    if (!r.success || !r.txId) return false;
    await refresh();
    const next = { ...inviteStore, [plan.updated.id]: plan.updated };
    saveInvites(account, next); setInviteStore(next);
    setAcceptingJoin(null);
    return true;
  };

  const hasNft = parseNftMessage(text).some(seg => seg.type === 'nft');
  const body = replyingTo && text.trim() ? encodeReply(replyingTo, text) : text;
  const outgoing = editingMessage && body.trim() ? encodeEdit(editTarget(editingMessage), body) : body;
  const size = activeInvite ? inviteTextSize(activeInvite.invite.id, outgoing) : activeGroup ? groupMessageSize(activeGroup, outgoing) : { bytes: plaintextBytes(outgoing), parts: partCount(outgoing), maxBytes: MAX_MESSAGE_BYTES };
  const { bytes, parts, maxBytes } = size;
  const tooLong = bytes > maxBytes || parts > MAX_PARTS;
  const copies = activeGroup || activeInvite ? recipients.length : 1;
  const voiceParts = voice ? voicePartCount(voice) + (editingMessage ? 1 : 0) : 0;
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
      <CryptKeySetup account={account} fileInput={fileInput} profileEditor={profileEditor} creationDialog={creationDialog}
        fileRef={fileRef} searchingVault={searchingVault} findKeyInFolder={findKeyInFolder} makeKey={makeKey} />
    );
  }


  return (
    <div className="w-full rounded-lg border border-cheese/20 bg-card/80 overflow-hidden flex flex-col md:grid h-[80dvh] min-h-[480px] md:grid-cols-[240px_1fr] md:grid-rows-[auto_1fr]">
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
          <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-background/50 px-2 py-1.5">
            <span className="min-w-0 text-[11px] text-muted-foreground">{listedIds.has(editingInvite.id) ? '🌐 This room is listed publicly, so anyone can find it and ask to join.' : '🌐 Not listed. Only people you invite can find this room.'}</span>
            <Button size="sm" variant="outline" className="h-7 shrink-0 text-xs" aria-label={listedIds.has(editingInvite.id) ? 'Manage public room listing' : 'List room publicly'} onClick={() => setListingRoom(editingInvite.id)}>🌐 {listedIds.has(editingInvite.id) ? 'Manage listing' : 'List room'}</Button>
          </div>
          {v.isCreator && listedIds.has(v.invite.id) && <Button variant="outline" size="sm" onClick={() => setEditLogRoom(v.invite.id)}>✏️ Edited messages</Button>}
        </PaidActionDialog>;
      })()}
      {pendingModeration && (() => {
        const plan = moderationPlan(pendingModeration);
        if (!plan) return null;
        const who = nameFor(pendingModeration.member);
        const copy = {
          mute: { title: `🔇 Mute ${who}`, description: `Mute for ${pendingModeration.minutes} minutes. Messages sent during the mute stay hidden after it ends.`, confirm: 'Pay & mute' },
          ban: { title: `🚫 Remove ${who}`, description: 'Exclude this member from future room messages. Existing blockchain copies and keys cannot be revoked.', confirm: 'Pay & remove' },
          admin: { title: `🛡️ Make ${who} an admin`, description: 'Admins can mute anyone except you and collapse messages from members who joined after the room went public. They cannot remove members or appoint admins.', confirm: 'Pay & appoint' },
          unadmin: { title: `🛡️ Remove ${who} as admin`, description: `${who} goes back to being a regular member. Their earlier mutes and collapses stay in place.`, confirm: 'Pay & remove admin' },
          report: myRoomRole === 'admin'
            ? { title: `🚩 Report ${who} to the owner`, description: `Only the room owner is notified, so they can review ${who} for a ban.`, confirm: 'Pay & report' }
            : { title: `🚩 Report ${who}'s message`, description: 'The room owner and admins are notified privately and can jump to this message.', confirm: 'Pay & report' },
          collapse: { title: `🙈 Collapse ${who}'s message`, description: 'Every member sees this message collapsed. Room moderators can still open it. The blockchain copy cannot be deleted.', confirm: 'Pay & collapse' },
        }[pendingModeration.action];
        return <PaidActionDialog title={copy.title} description={copy.description} cost={plan.cost} confirmLabel={copy.confirm} busy={busy} onConfirm={confirmModeration} onClose={() => setPendingModeration(null)} />;
      })()}
      {editLogRoom && (() => {
        const v = viewById(editLogRoom);
        if (!v?.isCreator || !listedIds.has(editLogRoom)) return null;
        return <EditedMessagesDialog entries={publicEditLog(edited.log, editLogRoom, v.invite.creator, account, true, clock)} nameFor={nameFor} onClose={() => setEditLogRoom(null)} />;
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
      <DiscoverRoomsDialog open={roomsOpen} onOpenChange={o => { setRoomsOpen(o); if (o) void refetchRooms(); }} listings={listings} loading={roomsLoading}
        refresh={() => void refetchRooms()} account={account} roomStatus={roomStatus} joinCost={roomJoinCost} onAsk={l => { setRoomsOpen(false); setAskingRoom(l); }} />
      {askingRoom && <PaidActionDialog title={`🌐 Ask to join ${askingRoom.name}`} cost={roomJoinCost} confirmLabel="Pay & ask" busy={busy}
        description={`Sends ${askingRoom.creator} an encrypted request naming only this room. If they accept, an invite appears in your Groups and you choose Join or Decline.`}
        onConfirm={() => askToJoin(askingRoom)} onClose={() => setAskingRoom(null)} />}
      {acceptingJoin && (() => {
        const plan = joinPlan(acceptingJoin);
        if (!plan) return null;
        return <PaidActionDialog title={`🌐 Add ${nameFor(acceptingJoin.from)} to ${plan.v.name}`} cost={plan.cost} confirmLabel="Pay & invite" busy={busy}
          description={`Sends ${acceptingJoin.from} a complete encrypted invite and notifies ${plan.to.length} existing members of the addition. ${acceptingJoin.from} then chooses Join or Decline. Existing members and their keys stay the same.`}
          onConfirm={confirmJoin} onClose={() => setAcceptingJoin(null)} />;
      })()}
      {listingRoom && (() => {
        const v = viewById(listingRoom);
        if (!v || !v.isCreator) return null;
        return <RoomListingDialog groupId={v.invite.id} groupName={v.name} members={Math.max(1, v.joined.length)} publicKey={key.publicKey} listed={listedIds.has(v.invite.id)} busy={busy}
          cost={`${(0.0100 + parseFloat(cg2Cost(encodeRoomPolicy(v.invite.id, !listedIds.has(v.invite.id), moderation[v.invite.id]?.protected ?? v.invite.members.map(m => m.account)), v.invite.members.length - 1))).toFixed(4)} CHEESE`}
          onList={info => listRoom(v.invite.id, info)} onUnlist={() => unlistRoom(v.invite.id)} onClose={() => setListingRoom(null)} />;
      })()}
      <PublicInboxDialog enabled={publicInbox} onChange={enabled => { savePublicInbox(account, enabled); setPublicInbox(enabled); }} open={inboxOpen} onOpenChange={setInboxOpen} />
      <CryptSidebar account={account} cryptKey={key} loading={loading} refresh={refresh} setEditingAvatar={setEditingAvatar}
        menuOpen={menuOpen} setMenuOpen={setMenuOpen} fileRef={fileRef} sharePublicKey={sharePublicKey} busy={busy} publish={publish}
        blocked={blocked} setShowBlocked={setShowBlocked} makeKey={makeKey} publicInbox={publicInbox} setInboxOpen={setInboxOpen}
        toggleList={toggleList} listHidden={listHidden} hiddenUnread={hiddenUnread} hiddenReplies={hiddenReplies}
        messageRequests={messageRequests} acceptRequest={acceptRequest} dismissRequest={dismissRequest} blockAccount={blockAccount}
        groupsOpen={groupsOpen} setGroupsOpen={setGroupsOpen} setCreatingGroup={setCreatingGroup} inviteViews={inviteViews}
        inviteShown={inviteShown} hiddenGroups={hiddenGroups} inviteRow={inviteRow} groups={groups} groupRow={groupRow}
        showHiddenGroups={showHiddenGroups} setShowHiddenGroups={setShowHiddenGroups} friendsOpen={friendsOpen} setFriendsOpen={setFriendsOpen}
        setAddingFriend={setAddingFriend} partners={partners} active={active} setActive={setActive} avatars={avatars} nameFor={nameFor}
        contacts={contacts} lastAt={lastAt} badge={badge} removeFriend={removeFriend} setRoomsOpen={setRoomsOpen}
        backupFile={keyLocked ? lockedFile : key} keyLocked={keyLocked} canLock={canLock} lockKey={() => void lockKey()}
        joinRequestsPanel={<JoinRequests requests={joinRequests} nameFor={nameFor} roomName={id => viewById(id)?.name ?? 'a room'}
          roomFull={id => (invites[id]?.members.length ?? MAX_PUBLIC_ROOM_MEMBERS) >= MAX_PUBLIC_ROOM_MEMBERS} onAccept={setAcceptingJoin}
          onDecline={r => setJoinDeclines(declineJoin(account, r.groupId, r.from, r.time))}
          onBlock={r => { setJoinDeclines(declineJoin(account, r.groupId, r.from, r.time)); blockAccount(r.from); }} />} />

      <CryptChatHeader account={account} active={active} activeGroup={activeGroup} activeInvite={activeInvite} keyAvatar={key.avatar}
        avatars={avatars} contacts={contacts} blocked={blocked} friendDeclines={friendDeclines} setFriendDeclines={setFriendDeclines}
        nameFor={nameFor} membersOpen={membersOpen} setMembersOpen={setMembersOpen} setPendingNotice={setPendingNotice}
        setEditingInvite={setEditingInvite} setEditingFriend={setEditingFriend} saveFriend={saveFriend} blockAccount={blockAccount}
        admins={activeModeration?.admins ?? []}
        />

      <section className={cn('flex flex-1 flex-col min-h-0 md:row-start-2', listHidden ? 'md:col-start-1 md:col-span-2' : 'md:col-start-2')}>
        {!active ? (
          <p className="text-sm text-muted-foreground m-auto">💬 Pick or add a contact.</p>
        ) : (
          <>
            <Dialog open={!!openQuote} onOpenChange={(o) => { if (!o) setOpenQuote(null); }}>
              <DialogContent className="max-w-lg">
                {openQuote && (() => {
                  const original = thread.find(x => x.from === openQuote.author && x.time === openQuote.time);
                  const quoteHidden = restrictedAt(activeModeration, openQuote.author, openQuote.time) || (!!original?.collapsed && myRoomRole === 'member');
                  const full = original ? (parseReply(original.text)?.body ?? original.text) : null;
                  return <>
                    <DialogHeader>
                      <DialogTitle>↩️ {openQuote.author === account ? 'Your message' : nameFor(openQuote.author)}</DialogTitle>
                      <DialogDescription>{new Date(openQuote.time).toLocaleString()}{original?.txId && <> · <a href={`https://waxblock.io/transaction/${encodeURIComponent(original.txId)}`} target="_blank" rel="noreferrer" className="font-semibold text-cheese underline underline-offset-2">Tx</a></>}</DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap break-words text-sm">
                      {quoteHidden ? null : original?.voice ? <VoiceNoteBubble note={original.voice} />
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
                    highlighted={replyNavigation.highlighted.has(m.key)} reportHighlighted={reportFocus === m.key} report={reportAction(m)}
                    editable={canEdit(m, account, clock) && !busy && !roomRestricted && (!activeInvite || activeInvite.status === 'joined')} onEdit={beginEdit}
                    onReply={(x) => { setEditingMessage(null); setReplyingTo({ author: x.from, time: x.time, quote: quoteOf(x.text, !!x.voice) }); setVoice(null); setTimeout(() => composerRef.current?.focus(), 0); }}
                    canReveal={myRoomRole !== 'member'} revealed={revealed.has(m.key)} onReveal={() => setRevealed(s => new Set(s).add(m.key))}
                    onCollapse={collapseTarget(m) && activeInvite ? () => setPendingModeration({ id: activeInvite.invite.id, member: m.from, action: 'collapse', target: collapseTarget(m)! }) : undefined}
                    badges={activeInvite ? { owner: m.from === activeInvite.invite.creator, admin: m.from !== activeInvite.invite.creator && !!moderation[activeInvite.invite.id]?.admins.includes(m.from), founder: founderBadges(moderation[activeInvite.invite.id], activeInvite.invite, listedIds.has(activeInvite.invite.id)).includes(m.from) } : undefined}
                    {...authorModeration(m)} onOpenQuote={setOpenQuote} openedAt={acceptedRequestMessages.current.has(m.key) ? { current: Infinity } : openedAt} />
                </Fragment>
              ))}
              {!thread.length && <li className="text-sm text-muted-foreground">{activeGroup || activeInvite ? 'No group messages yet.' : `No messages with ${nameFor(active)} yet.`}</li>}
              <li ref={endRef} aria-hidden />
            </ol>
            {pendingReports.length > 0 && <Button size="icon" title="Jump to the earliest reported message"
              aria-label={`Jump to reported message (${pendingReports.length} remaining)`}
              onClick={jumpToReport}
              className={cn('absolute right-4 h-12 w-12 rounded-full bg-report text-report-foreground hover:bg-report/90 font-bold text-sm ring-2 ring-background', replyNavigation.pending.length > 0 ? 'bottom-[4.5rem]' : 'bottom-3')}>
              🚩{pendingReports.length > 99 ? '99+' : pendingReports.length}
            </Button>}
            {replyNavigation.pending.length > 0 && <Button size="icon" title="Jump to your earliest unseen reply"
              aria-label={`Jump to earliest unseen reply (${replyNavigation.pending.length} remaining)`}
              onClick={replyNavigation.jump}
              className="absolute bottom-3 right-4 h-12 w-12 rounded-full bg-reply text-reply-foreground hover:bg-reply/90 font-bold text-sm ring-2 ring-background">
              @{replyNavigation.pending.length > 99 ? '99+' : replyNavigation.pending.length}
            </Button>}
            </div>
            {roomRestricted ? <p className="text-sm text-muted-foreground p-4 border-t border-border">{roomBanned ? 'You were removed from this room. Your earlier history stays readable.' : `Muted until ${new Date(roomMutedUntil).toLocaleString()}. Messages sent during the mute remain hidden.`}</p> : activeInvite?.status === 'invited' ? (
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
              <CryptComposer account={account} active={active} activeGroup={activeGroup} activeInvite={activeInvite} nameFor={nameFor}
                replyingTo={replyingTo} setReplyingTo={setReplyingTo} composerRef={composerRef} text={text} setText={setText} voice={voice} setVoice={setVoice}
                tooLong={tooLong} bytes={bytes} maxBytes={maxBytes} parts={parts} copies={copies} voiceParts={voiceParts} voiceTxs={voiceTxs}
                setAttachingNft={setAttachingNft} busy={busy} listHidden={listHidden} agreed={agreed} setAgreed={setAgreed}
                feeInfoOpen={feeInfoOpen} setFeeInfoOpen={setFeeInfoOpen} totalCost={totalCost} send={send} sendVoice={sendVoice}
                editing={!!editingMessage} cancelEdit={cancelEdit} editExpired={!!editingMessage && !canEdit(editingMessage, account, clock)} />
            )}
          </>
        )}
      </section>
    </div>
  );
}

export default CheeseCrypt;
