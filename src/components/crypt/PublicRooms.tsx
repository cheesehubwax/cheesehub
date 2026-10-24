import { useMemo, useState } from 'react';
import { Globe, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TermsCheckbox } from '@/components/shared/TermsCheckbox';
import { MAX_INVITE_MEMBERS } from '@/lib/cryptInviteGroups';
import {
  cleanRoomName, cleanRoomTopic, cleanTags, encodeListing, MAX_ROOM_NAME, MAX_ROOM_TOPIC, ROOM_FEE_QUANTITY, searchListings,
  type JoinRequest, type RoomListing,
} from '@/lib/cryptRooms';

/** Search listed rooms; asking to join is confirmed (and paid) by the Messenger. Presentational only. */
export function DiscoverRoomsDialog({ open, onOpenChange, listings, loading, refresh, account, roomStatus, joinCost, onAsk }: {
  open: boolean; onOpenChange: (open: boolean) => void; listings: RoomListing[]; loading: boolean; refresh: () => void; account: string;
  roomStatus: (l: RoomListing) => 'own' | 'member' | 'invited' | 'requested' | null; joinCost: string; onAsk: (l: RoomListing) => void;
}) {
  const [q, setQ] = useState('');
  const shown = useMemo(() => searchListings(listings, q), [listings, q]);
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-lg max-h-[85dvh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>🌐 Public rooms</DialogTitle>
        <DialogDescription>Rooms their creators chose to list. Ask to join and the creator decides; if they accept you get a normal encrypted invite. Members and messages stay private.</DialogDescription>
      </DialogHeader>
      <div className="flex gap-2">
        <Input placeholder="Search name, topic or #tag" aria-label="Search rooms" value={q} onChange={e => setQ(e.target.value)} />
        <Button size="icon" variant="outline" aria-label="Refresh rooms" disabled={loading} onClick={refresh}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>
      <ul className="space-y-2" aria-label="Listed rooms">
        {!shown.length && <li className="py-4 text-center text-sm text-muted-foreground">{loading ? 'Looking for rooms…' : 'No rooms found.'}</li>}
        {shown.map(l => {
          const status = roomStatus(l);
          const full = l.members >= MAX_INVITE_MEMBERS;
          return <li key={`${l.creator}:${l.id}`} className="space-y-1.5 rounded-md border border-border bg-background/50 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="break-words font-semibold text-cheese">{l.name}</div>
                <div className="truncate font-mono text-[11px] text-muted-foreground">by {l.creator === account ? 'you' : l.creator}</div>
              </div>
              <span className="shrink-0 text-[11px] text-muted-foreground">{l.members}/{MAX_INVITE_MEMBERS}</span>
            </div>
            {l.topic && <p className="break-words text-sm">{l.topic}</p>}
            {l.tags.length > 0 && <div className="flex flex-wrap gap-1">{l.tags.map(t => <span key={t} className="rounded bg-cheese/10 px-1.5 py-0.5 text-[11px] text-cheese">#{t}</span>)}</div>}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground">Listed {new Date(l.time).toLocaleDateString()}</span>
              {status === 'own' ? <span className="text-xs text-muted-foreground">Your room</span>
                : status === 'member' ? <span className="text-xs text-muted-foreground">Joined</span>
                : status === 'invited' ? <span className="text-xs text-cheese">Invite waiting in Groups</span>
                : status === 'requested' ? <span className="text-xs text-muted-foreground">Requested</span>
                : <Button size="sm" disabled={full} className="bg-cheese text-primary-foreground hover:bg-cheese/90" onClick={() => onAsk(l)}>{full ? 'Full' : `Ask to join (${joinCost})`}</Button>}
            </div>
          </li>;
        })}
      </ul>
      <p className="text-[11px] text-muted-foreground">Your request privately includes your public key so only the room creator can read it; you do not need to publish your key. Only recently listed rooms appear; creators can list again to stay visible.</p>
    </DialogContent>
  </Dialog>;
}

/** Creator-only listing controls for an invite group. Listing and unlisting each cost the room fee and need the Terms box. */
export function RoomListingDialog({ groupId, groupName, members, publicKey, listed, busy, onList, onUnlist, onClose, cost = ROOM_FEE_QUANTITY }: {
  groupId: string; groupName: string; members: number; publicKey: string; listed: boolean; busy: boolean;
  onList: (info: { name: string; topic: string; tags: string[] }) => Promise<boolean>; onUnlist: () => Promise<boolean>; onClose: () => void;
  cost?: string;
}) {
  const [name, setName] = useState(cleanRoomName(groupName));
  const [topic, setTopic] = useState('');
  const [tags, setTags] = useState('');
  const [agreed, setAgreed] = useState(false);
  const info = { name: cleanRoomName(name), topic: cleanRoomTopic(topic), tags: cleanTags(tags) };
  let error = '';
  if (!listed) {
    if (!info.name) error = 'Give the room a name';
    else try { encodeListing({ id: groupId, ...info, publicKey, members }); } catch (e) { error = (e as Error).message; }
  }
  return <Dialog open onOpenChange={o => { if (!o && !busy) onClose(); }}>
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>🌐 {listed ? 'Listed publicly' : 'Make room public'}</DialogTitle>
        <DialogDescription>{listed
          ? 'People can find this room and ask you to join. Requests appear at the top of your sidebar. Unlisting hides it from search.'
          : 'Publishes the room name, topic, tags, member count and your public key on chain so others can ask to join. The member list and messages are never published.'}</DialogDescription>
      </DialogHeader>
      {!listed && <div className="space-y-2">
        <Input maxLength={MAX_ROOM_NAME} aria-label="Room name" placeholder="Room name" value={name} onChange={e => setName(e.target.value)} />
        <Input maxLength={MAX_ROOM_TOPIC} aria-label="Room topic" placeholder="Short topic, e.g. Cheese lovers of Brisbane" value={topic} onChange={e => setTopic(e.target.value)} />
        <Input aria-label="Room tags" placeholder="Up to 3 tags, e.g. cheese wax nfts" value={tags} onChange={e => setTags(e.target.value)} />
        {info.tags.length > 0 && <p className="text-[11px] text-muted-foreground">{info.tags.map(t => `#${t}`).join(' ')}</p>}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>}
      {!listed && <p className="rounded-md border border-cheese/30 bg-cheese/5 p-2 text-xs text-muted-foreground">⚠️ <span className="font-semibold text-cheese">Your account and public messaging key are published on chain</span> with this listing, so anyone can read them. That only lets people send join requests for this room: regular messages from accounts you have not added stay hidden unless you turn on the Public Inbox, and you can block anyone at any time.</p>}
      <p className="text-xs text-muted-foreground">Cost: {cost}. Platform fees split 80% to eosio.null and 20% to xcheeseliqst; includes encrypted room-policy copies for members.</p>
      <TermsCheckbox id="crypt-room-terms" checked={agreed} onCheckedChange={setAgreed} />
      <DialogFooter>
        <Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
        {listed
          ? <Button disabled={busy || !agreed} onClick={() => void onUnlist().then(ok => { if (ok) onClose(); })}>{busy ? 'Sending…' : 'Pay & unlist'}</Button>
          : <Button disabled={busy || !agreed || !!error} onClick={() => void onList(info).then(ok => { if (ok) onClose(); })}>{busy ? 'Sending…' : 'Pay & list room'}</Button>}
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}

/** Join requests to my listed rooms, shown at the top of the sidebar. Declining and blocking are free. */
export function JoinRequests({ requests, roomName, roomFull, nameFor, onAccept, onDecline, onBlock }: {
  requests: JoinRequest[]; roomName: (id: string) => string; roomFull: (id: string) => boolean; nameFor: (a: string) => string;
  onAccept: (r: JoinRequest) => void; onDecline: (r: JoinRequest) => void; onBlock: (r: JoinRequest) => void;
}) {
  if (!requests.length) return null;
  return <section aria-label="Room join requests" className="space-y-2 rounded-md border border-cheese/30 bg-cheese/5 p-2">
    <div className="flex items-center gap-1 px-1 text-[10px] font-bold uppercase tracking-wider text-cheese"><Globe className="h-3.5 w-3.5" /> Join requests</div>
    {requests.map(r => {
      const full = roomFull(r.groupId);
      return <div key={`${r.groupId}:${r.from}`} className="space-y-1.5 px-1">
        <p className="text-xs break-words"><span className="font-semibold">{nameFor(r.from)}</span>{nameFor(r.from) !== r.from && <span className="font-mono text-muted-foreground"> ({r.from})</span>} wants to join <span className="font-semibold">{roomName(r.groupId)}</span></p>
        <div className="flex gap-1">
          <Button size="sm" className="h-7 flex-1 bg-cheese text-primary-foreground hover:bg-cheese/90" disabled={full} title={full ? 'This room is full' : 'Sends the updated invite to everyone in the room'} onClick={() => onAccept(r)}>{full ? 'Full' : 'Accept'}</Button>
          <Button size="sm" variant="outline" className="h-7 flex-1" onClick={() => onDecline(r)}>Decline</Button>
          <Button size="sm" variant="ghost" className="h-7 text-destructive hover:text-destructive" onClick={() => onBlock(r)}>Block</Button>
        </div>
      </div>;
    })}
  </section>;
}
