import { parseReply } from '@/lib/cryptReply';
import { Inbox } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CardAction } from '@/components/crypt/CardAction';
import { PixelAvatar } from '@/components/crypt/PixelAvatar';
import { parseNftMessage } from '@/lib/cryptNft';
import type { InboxRequest } from '@/lib/cryptPublicInbox';
import { cn } from '@/lib/utils';

export function PublicInboxButton({ enabled, onClick }: { enabled: boolean; onClick: () => void }) {
  return <CardAction icon={<Inbox className="h-4 w-4" />} label="Inbox" aria-label="Public inbox" title={`Public inbox is ${enabled ? 'on' : 'off'}`} className={cn(enabled && 'text-cheese')} onClick={onClick} />;
}

/** Uncontrolled renders its own button; pass open/onOpenChange to open it from elsewhere (e.g. a menu that unmounts). */
export function PublicInboxDialog({ enabled, onChange, open: openProp, onOpenChange }: { enabled: boolean; onChange: (enabled: boolean) => void; open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const [ownOpen, setOwnOpen] = useState(false);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : ownOpen;
  const setOpen = (v: boolean) => controlled ? onOpenChange?.(v) : setOwnOpen(v);
  return <>
    {!controlled && <PublicInboxButton enabled={enabled} onClick={() => setOpen(true)} />}
    <Dialog open={open} onOpenChange={setOpen}>
    <DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>📥 Public inbox</DialogTitle><DialogDescription>Let people you haven’t added send you message requests.</DialogDescription></DialogHeader>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="crypt-public-inbox" className="text-sm font-semibold">Accept message requests</label>
        <Switch id="crypt-public-inbox" checked={enabled} onCheckedChange={onChange} />
      </div>
      <p className="text-sm text-muted-foreground">Off by default. When on, text and NFT messages from accounts with published keys appear as requests, not friend chats. Voice and group invites aren’t accepted from strangers.</p>
      <p className="text-sm text-muted-foreground">Publish your own public key so people can find you. This setting stays on this device; accepting, declining and blocking a request are free and send nothing on-chain.</p>
    </DialogContent>
    </Dialog>
  </>;
}

export function MessageRequests({ requests, onAccept, onDecline, onBlock }: { requests: InboxRequest[]; onAccept: (from: string) => void; onDecline: (from: string) => void; onBlock: (from: string) => void }) {
  if (!requests.length) return null;
  return <section className="space-y-3 border-b border-border pb-3" aria-label="Message requests">
    <h2 className="px-2 text-xs font-bold text-cheese">📥 Message requests ({requests.length})</h2>
    {requests.map(r => <div key={r.from} className="space-y-2 px-2">
      <div className="flex items-center gap-2"><PixelAvatar account={r.from} /><div className="min-w-0"><p className="break-words text-xs font-semibold">{r.from}</p><p className="text-[10px] text-muted-foreground">{r.messages.length} message{r.messages.length === 1 ? '' : 's'}</p></div></div>
      {r.messages.slice(-3).map(m => <p key={m.key} className="line-clamp-2 whitespace-pre-wrap break-words text-xs text-muted-foreground">{parseNftMessage(parseReply(m.text)?.body ?? m.text ?? '').map(s => s.type === 'nft' ? '🖼️ Sent an NFT' : s.text).join(' ')}</p>)}
      <div className="flex flex-wrap gap-1">
        <Button size="sm" className="h-7 px-2 text-xs" aria-label={`Accept request from ${r.from}`} onClick={() => onAccept(r.from)}>Accept</Button>
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" aria-label={`Decline request from ${r.from}`} onClick={() => onDecline(r.from)}>Decline</Button>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive" aria-label={`Block request from ${r.from}`} onClick={() => { if (window.confirm(`Block ${r.from}? Their messages will be hidden on this device.`)) onBlock(r.from); }}>Block</Button>
      </div>
    </div>)}
  </section>;
}