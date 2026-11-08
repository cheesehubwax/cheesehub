import { useState } from 'react';
import { Ban, Check, Copy, MessageSquare, Pencil, UserMinus, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PixelAvatar } from '@/components/crypt/PixelAvatar';
import { CryptTrustBadge } from '@/components/crypt/CryptTrustBadge';
import type { CryptAvatar } from '@/lib/cryptAvatar';

/** Public profile: display only. Names and quotes are presentation; the WAX account stays the identity. */
export function CryptProfileDialog({ account, self, name, sharedName, nickname, avatar, bio, onClose, onEditProfile, onMessage, onEditNickname, friend, onBlock }: {
  account: string; self: boolean; name: string; sharedName?: string; nickname?: string; avatar?: CryptAvatar; bio?: string;
  onClose: () => void;
  onEditProfile?: () => void;
  /** Opens the direct chat (friends only). */
  onMessage?: () => void;
  onEditNickname?: () => void;
  friend?: { isFriend: boolean; onAdd?: () => void; onRemove?: () => void; pendingLabel?: string };
  onBlock?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(account); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard unavailable */ }
  };
  const close = (fn?: () => void) => fn && (() => { onClose(); fn(); });
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="max-w-sm">
      <DialogHeader className="items-center text-center">
        <PixelAvatar account={account} avatar={avatar} className="h-24 w-24" />
        <DialogTitle className="pt-2 text-xl font-bold text-cheese break-words [overflow-wrap:anywhere]">{self ? `${name} (you)` : name}</DialogTitle>
        <DialogDescription asChild>
          <div className="flex flex-col items-center gap-1">
            <button type="button" onClick={() => void copy()} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={copied ? 'Account name copied' : `Copy account name ${account}`} title="Copy WAX account name">
              {account}{copied ? <Check className="h-3 w-3 text-cheese" /> : <Copy className="h-3 w-3" />}
            </button>
            {!self && nickname && sharedName && sharedName !== nickname && <span className="text-[11px] text-muted-foreground">Their name: {sharedName} · your nickname: {nickname}</span>}
          </div>
        </DialogDescription>
      </DialogHeader>
      <div className="flex justify-center"><CryptTrustBadge account={account} /></div>
      {bio
        ? <blockquote className="max-h-60 overflow-y-auto whitespace-pre-wrap break-words [overflow-wrap:anywhere] rounded-md border-l-2 border-cheese bg-muted/50 px-3 py-2 text-sm italic">{bio}</blockquote>
        : <p className="text-center text-xs italic text-muted-foreground">No quote or bio added yet.</p>}
      <div className="flex flex-wrap justify-center gap-2">
        {self && onEditProfile && <Button size="sm" onClick={close(onEditProfile)} className="bg-cheese text-primary-foreground hover:bg-cheese/90"><Pencil className="h-4 w-4" /> Edit profile</Button>}
        {!self && onMessage && <Button size="sm" onClick={close(onMessage)} className="bg-cheese text-primary-foreground hover:bg-cheese/90"><MessageSquare className="h-4 w-4" /> Send message</Button>}
        {!self && friend && !friend.isFriend && (friend.onAdd
          ? <Button size="sm" variant="outline" onClick={close(friend.onAdd)}><UserPlus className="h-4 w-4" /> Add friend</Button>
          : friend.pendingLabel && <Button size="sm" variant="outline" disabled>{friend.pendingLabel}</Button>)}
        {!self && onEditNickname && <Button size="sm" variant="outline" onClick={close(onEditNickname)}><Pencil className="h-4 w-4" /> Nickname</Button>}
        {!self && friend?.isFriend && friend.onRemove && <Button size="sm" variant="ghost" onClick={close(friend.onRemove)}><UserMinus className="h-4 w-4" /> Remove friend</Button>}
        {!self && onBlock && <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={close(onBlock)}><Ban className="h-4 w-4" /> Block</Button>}
      </div>
      {!self && !onMessage && !friend?.onAdd && <p className="text-center text-[11px] text-muted-foreground">To message {name} privately, add them as a friend first (from a shared room, or with their public key file).</p>}
    </DialogContent>
  </Dialog>;
}
