import type { ReactNode } from 'react';
import { Ban, ChevronDown, Pencil, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PixelAvatar } from '@/components/crypt/PixelAvatar';
import { cn } from '@/lib/utils';
import type { CryptAvatar } from '@/lib/cryptAvatar';
import type { CryptGroup } from '@/lib/cryptGroups';
import { declineFriendRequest, type InviteGroupView } from '@/lib/cryptInviteGroups';
import { FRIENDS_DIR } from '@/lib/cryptVault';

type Notice = { kind: 'joined' | 'leave' | 'friend' | 'friend-ok'; id: string; to?: string };

/** Chat title bar: friend or group title, Members dropdown and per-chat actions. State lives in Messenger. */
export function CryptChatHeader({
  account, active, activeGroup, activeInvite, keyAvatar, avatars, contacts, blocked, friendDeclines, setFriendDeclines,
  nameFor, membersOpen, setMembersOpen, setPendingNotice, setEditingInvite, setEditingFriend, saveFriend, blockAccount,
}: {
  account: string; active: string | null; activeGroup: CryptGroup | undefined; activeInvite: InviteGroupView | undefined;
  keyAvatar?: CryptAvatar; avatars: Record<string, CryptAvatar>; contacts: Record<string, string>; blocked: string[];
  friendDeclines: string[]; setFriendDeclines: (v: string[]) => void; nameFor: (id: string) => string;
  membersOpen: boolean; setMembersOpen: (v: boolean) => void; setPendingNotice: (n: Notice) => void;
  setEditingInvite: (v: { id: string; name: string; avatar?: CryptAvatar }) => void; setEditingFriend: (v: string) => void;
  saveFriend: (name: string, ask: boolean) => Promise<unknown>; blockAccount: (name: string) => void;
}) {
  const memberLine = (member: string, status?: string, action?: ReactNode) => (
    <li key={member} className="flex items-center gap-2 min-w-0">
      <PixelAvatar account={member} avatar={member === account ? keyAvatar : avatars[member]} className="h-9 w-9 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold">{nameFor(member)}{member === account && ' (you)'}</span>
        <span className="block truncate font-mono text-[10px] text-muted-foreground">{member}</span>
      </span>
      {status && <span className={cn('shrink-0 text-[10px]', status === 'joined' ? 'text-cheese' : 'text-muted-foreground')}>{status}</span>}
      {action}
    </li>
  );
  const membersDropdown = (members: string[], status?: (member: string) => string | undefined, action?: (member: string) => ReactNode) => (
    <Popover open={membersOpen} onOpenChange={setMembersOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 shrink-0 gap-1 text-xs font-normal" aria-expanded={membersOpen}>
          👥 Members ({members.length}) <ChevronDown className={cn('h-3 w-3 transition', !membersOpen && '-rotate-90')} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="crypt-members-pop w-72 p-2">
        <ul className="max-h-60 space-y-1 overflow-y-auto">{members.map(member => memberLine(member, status?.(member), action?.(member)))}</ul>
      </PopoverContent>
    </Popover>
  );

  return (
    <div className={cn('min-w-0 px-4 py-3 border-b border-border font-semibold flex flex-wrap items-center gap-2 md:col-start-2 md:row-start-1', !active && 'hidden md:flex')}>
      {active && <>
            {activeInvite ? <div className="w-full space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {activeInvite.avatar ? <PixelAvatar account={activeInvite.invite.id} avatar={activeInvite.avatar} className="h-14 w-14" /> : <span aria-hidden className="flex h-14 w-14 shrink-0 items-center justify-center text-3xl">👥</span>}
                <span className="min-w-0">
                  <span className="block break-words">{activeInvite.name}</span>
                  <span className="block text-[10px] font-normal text-muted-foreground">created by {nameFor(activeInvite.invite.creator)}</span>
                </span>
                <span className="ml-auto flex items-center gap-1">
                  {membersDropdown(activeInvite.invite.members.map(({ account: member }) => member),
                    member => (activeInvite.joined.includes(member) ? 'joined' : 'invited'),
                    member => {
                      if (member !== account && activeInvite.status === 'joined' && !contacts[member] && !blocked.includes(member) && !activeInvite.requested.includes(member) && !activeInvite.friendRequests.includes(member))
                        return <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]" aria-label={`Send friend request to ${member}`} onClick={() => setPendingNotice({ kind: 'friend', id: activeInvite.invite.id, to: member })}><UserPlus className="h-3 w-3" /> Friend request</Button>;
                      if (member !== account && activeInvite.requested.includes(member) && !contacts[member]) return <span className="shrink-0 text-[10px] text-muted-foreground">request sent</span>;
                      return undefined;
                    })}
                  {activeInvite.isCreator && activeInvite.status === 'joined' && <Button size="sm" variant="ghost" className="h-7 text-xs font-normal" onClick={() => setEditingInvite({ id: activeInvite.invite.id, name: activeInvite.name, avatar: activeInvite.avatar })}><Pencil className="h-3 w-3" /> Edit group</Button>}
                  {activeInvite.status === 'joined' && <Button size="sm" variant="ghost" className="h-7 text-xs font-normal text-destructive hover:text-destructive" onClick={() => setPendingNotice({ kind: 'leave', id: activeInvite.invite.id })}>🚪 Leave group</Button>}
                </span>
              </div>
              {activeInvite.friendRequests.filter(a => !contacts[a] && !blocked.includes(a) && !friendDeclines.includes(`${activeInvite.invite.id}:${a}`)).map(a =>
                <div key={a} className="flex flex-wrap items-center gap-2 rounded-md border border-cheese/30 bg-cheese/10 px-2 py-1 text-xs font-normal">
                  🤝 {nameFor(a)} sent you a friend request.
                  <Button size="sm" className="h-6 text-[11px] bg-cheese text-primary-foreground hover:bg-cheese/90" onClick={() => setPendingNotice({ kind: 'friend-ok', id: activeInvite.invite.id, to: a })}>Accept</Button>
                  <Button size="sm" variant="outline" className="h-6 text-[11px]" onClick={() => setFriendDeclines(declineFriendRequest(account, activeInvite.invite.id, a))}>Decline</Button>
                </div>)}
            </div> : activeGroup ? <span className="flex min-w-0 items-center gap-2">
              <span aria-hidden>👥</span>
              <span className="break-words">Group</span>
              {membersDropdown(activeGroup.members, undefined, member => member !== account && <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" aria-label={`Edit nickname for ${member}`} title={`Edit nickname for ${member}`} onClick={() => setEditingFriend(member)}><Pencil className="h-3 w-3" /></Button>)}
            </span> : <><PixelAvatar account={active} avatar={avatars[active]} /><span className="min-w-0 break-words">{nameFor(active)}{nameFor(active) !== active && <span className="block text-xs text-muted-foreground">{active}</span>}</span><Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label={`Edit nickname for ${active}`} title={`Edit nickname for ${active}`} onClick={() => setEditingFriend(active)}><Pencil className="h-3 w-3" /></Button></>}
            {!activeGroup && !activeInvite && <span className="ml-auto flex items-center gap-1">
              {contacts[active] && <Button size="sm" variant="ghost" className="h-7 text-xs font-normal" onClick={() => saveFriend(active, true)}>💾 Save to {FRIENDS_DIR}</Button>}
              <Button size="sm" variant="ghost" className="h-7 text-xs font-normal text-destructive hover:text-destructive" aria-label={`Block ${active}`}
                onClick={() => { if (window.confirm(`Block ${active}? Their messages will be hidden on this device.`)) blockAccount(active); }}><Ban className="h-3.5 w-3.5" /> Block</Button>
            </span>}</>}
    </div>
  );
}
