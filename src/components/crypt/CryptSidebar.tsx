import type { ComponentProps, ReactNode } from 'react';
import { Ban, ChevronDown, Download, KeyRound, Loader2, Menu, PanelLeftClose, PanelLeftOpen, Pencil, Radio, RefreshCw, Save, Trash2, Upload, UserPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CardAction } from '@/components/crypt/CardAction';
import { MessageRequests, PublicInboxButton } from '@/components/crypt/PublicInbox';
import { PixelAvatar } from '@/components/crypt/PixelAvatar';
import { download } from '@/components/crypt/cryptDownload';
import { cn } from '@/lib/utils';
import type { CryptAvatar } from '@/lib/cryptAvatar';
import type { CryptGroup } from '@/lib/cryptGroups';
import type { InviteGroupView } from '@/lib/cryptInviteGroups';
import { MESSAGE_FEE_QUANTITY, type MessagingKey } from '@/lib/cheeseCrypt';

/** Sidebar: always-visible profile box with Menu and hide arrow, then the hideable requests, Groups and Friends lists. State lives in Messenger. */
export function CryptSidebar({
  account, cryptKey, loading, refresh, setEditingAvatar, menuOpen, setMenuOpen, fileRef, sharePublicKey, busy, publish, blocked, setShowBlocked,
  makeKey, publicInbox, setInboxOpen, toggleList, listHidden, hiddenUnread, hiddenReplies, messageRequests, acceptRequest, dismissRequest,
  blockAccount, groupsOpen, setGroupsOpen, setCreatingGroup, inviteViews, inviteShown, hiddenGroups, inviteRow, groups, groupRow,
  showHiddenGroups, setShowHiddenGroups, friendsOpen, setFriendsOpen, setAddingFriend, partners, active, setActive, avatars, nameFor,
  contacts, lastAt, badge, removeFriend,
}: {
  account: string; cryptKey: MessagingKey; loading: boolean; refresh: () => void; setEditingAvatar: (v: boolean) => void;
  menuOpen: boolean; setMenuOpen: (v: boolean) => void; fileRef: { current: HTMLInputElement | null };
  sharePublicKey: () => Promise<unknown>; busy: boolean; publish: () => Promise<unknown>; blocked: string[]; setShowBlocked: (v: boolean) => void;
  makeKey: () => void; publicInbox: boolean; setInboxOpen: (v: boolean) => void; toggleList: () => void; listHidden: boolean;
  hiddenUnread: number; hiddenReplies: number; messageRequests: ComponentProps<typeof MessageRequests>['requests'];
  acceptRequest: (from: string) => void; dismissRequest: (from: string) => void; blockAccount: (name: string) => void;
  groupsOpen: boolean; setGroupsOpen: (v: boolean) => void; setCreatingGroup: (v: boolean) => void;
  inviteViews: InviteGroupView[]; inviteShown: (v: InviteGroupView) => boolean; hiddenGroups: string[];
  inviteRow: (v: InviteGroupView, hidden: boolean) => ReactNode; groups: CryptGroup[]; groupRow: (g: CryptGroup, hidden: boolean) => ReactNode;
  showHiddenGroups: boolean; setShowHiddenGroups: (f: (v: boolean) => boolean) => void; friendsOpen: boolean; setFriendsOpen: (v: boolean) => void;
  setAddingFriend: (v: boolean) => void; partners: string[]; active: string | null; setActive: (id: string) => void;
  avatars: Record<string, CryptAvatar>; nameFor: (id: string) => string; contacts: Record<string, string>;
  lastAt: Record<string, number>; badge: (id: string) => ReactNode; removeFriend: (name: string) => void;
}) {
  const key = cryptKey;
  return (
    <>
      <div className="flex flex-col justify-center gap-2 p-3 border-b border-border md:border-r md:col-start-1 md:row-start-1">
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
        <div className="flex items-center gap-1">
          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 flex-1 gap-2 text-xs" aria-label="Menu" aria-expanded={menuOpen}>
                <Menu className="h-4 w-4" /> Menu <ChevronDown className={cn('h-3.5 w-3.5 transition', menuOpen && 'rotate-180')} />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-2">
              {/* Every action closes the menu first; dialogs live outside so they survive it unmounting. */}
              <div className="grid grid-cols-3 gap-1" onClickCapture={() => setMenuOpen(false)}>
                <CardAction icon={<Upload className="h-4 w-4" />} label="Restore" aria-label="Load a key file (yours or a contact's)" title="Load a key file (yours or a contact's)" onClick={() => fileRef.current?.click()} />
                <CardAction icon={<Download className="h-4 w-4" />} label="Public key" aria-label="Share my public key file" title="Save my public key file to share" onClick={() => void sharePublicKey()} />
                <CardAction icon={<Radio className="h-4 w-4" />} label="Publish" disabled={busy} aria-label={`Publish my key on chain (${MESSAGE_FEE_QUANTITY})`} title={`Publish my key on chain (${MESSAGE_FEE_QUANTITY})`} onClick={() => void publish()} />
                <CardAction icon={<Save className="h-4 w-4" />} label="Back up" aria-label="Back up private key" title="Download a backup of my private key — never share it" onClick={() => download(`${account}-cheesecrypt-key-PRIVATE.json`, key)} />
                <CardAction icon={<Ban className="h-4 w-4" />} label={blocked.length ? `Blocked (${blocked.length})` : 'Blocked'} aria-label="Blocked accounts" title="Accounts blocked on this device" onClick={() => setShowBlocked(true)} />
                <CardAction icon={<KeyRound className="h-4 w-4" />} label="New key" className="hover:text-destructive" aria-label="Create a new key" title="Create a new key (it cannot read messages sent to this one)" onClick={makeKey} />
                <PublicInboxButton enabled={publicInbox} onClick={() => setInboxOpen(true)} />
              </div>
            </PopoverContent>
          </Popover>
          <Button size="icon" variant="ghost" className="relative h-8 w-8 shrink-0" onClick={toggleList} aria-expanded={!listHidden}
            aria-label={listHidden ? 'Show groups and friends' : 'Hide groups and friends'} title={listHidden ? 'Show groups and friends' : 'Hide groups and friends'}>
            {listHidden ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {listHidden && hiddenUnread > 0 && <span data-reply={hiddenReplies ? 'true' : undefined} aria-label={hiddenReplies ? `${hiddenUnread} unread, ${hiddenReplies} repl${hiddenReplies > 1 ? 'ies' : 'y'} to you` : `${hiddenUnread} unread`}
              className={cn('absolute -right-1 -top-1 min-w-4 h-4 px-1 rounded-full text-[9px] font-bold leading-4 text-center', hiddenReplies ? 'bg-reply text-reply-foreground' : 'bg-cheese text-primary-foreground')}>{hiddenUnread > 99 ? '99+' : hiddenUnread}</span>}
          </Button>
        </div>
      </div>
      <div className={cn('min-h-0 max-h-[30dvh] md:max-h-none overflow-y-auto p-2 space-y-4 border-b border-border md:border-b-0 md:border-r md:col-start-1 md:row-start-2', listHidden && 'hidden')}>
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
    </>
  );
}
