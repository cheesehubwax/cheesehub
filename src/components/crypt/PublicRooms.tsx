import { useMemo, useState } from 'react';
import { Globe, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TermsCheckbox } from '@/components/shared/TermsCheckbox';
import { MAX_PUBLIC_ROOM_MEMBERS } from '@/lib/cryptInviteGroups';
import { PixelAvatar } from '@/components/crypt/PixelAvatar';
import type { CryptAvatar } from '@/lib/cryptAvatar';
import {
  cleanRoomName, cleanRoomTopic, cleanTags, encodeListing, LISTING_FEE_QUANTITY, MAX_ROOM_NAME, MAX_ROOM_TOPIC, ROOM_FEE_QUANTITY, searchListings,
  type JoinRequest, type RoomListing,
} from '@/lib/cryptRooms';

/** Search listed rooms; asking to join is confirmed (and paid) by the Messenger. Presentational only. */
export function DiscoverRoomsDialog({ open, onOpenChange, listings, loading, refresh, account, nameFor, roomStatus, joinCost, onAsk }: {
  open: boolean; onOpenChange: (open: boolean) => void; listings: RoomListing[]; loading: boolean; refresh: () => void; account: string;
  roomStatus: (l: RoomListing) => 'own' | 'member' | 'invited' | 'requested' | 'left' | 'restricted' | null; joinCost: string; onAsk: (l: RoomListing) => void;
  nameFor?: (account: string) => string;
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
          const full = l.members >= MAX_PUBLIC_ROOM_MEMBERS;
          return <li key={`${l.creator}:${l.id}`} className="space-y-1.5 rounded-md border border-border bg-background/50 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <PixelAvatar account={l.id} avatar={l.avatar ? { version: 1, pixels: l.avatar } : undefined} className="h-10 w-10 shrink-0" />
                <div className="min-w-0">
                  <div className="break-words font-semibold text-cheese">{l.name}</div>
                  <div className="truncate text-[11px] text-muted-foreground" title={l.creator}>by {l.creatorName || nameFor?.(l.creator) || (l.creator === account ? 'you' : l.creator)}</div>
                </div>
              </div>
              <span className="shrink-0 text-[11px] text-muted-foreground">{l.members}/{MAX_PUBLIC_ROOM_MEMBERS} members</span>
            </div>
            {l.topic && <p className="break-words text-sm">{l.topic}</p>}
            {l.tags.length > 0 && <div className="flex flex-wrap gap-1">{l.tags.map(t => <span key={t} className="rounded bg-cheese/10 px-1.5 py-0.5 text-[11px] text-cheese">#{t}</span>)}</div>}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground">Listed {new Date(l.time).toLocaleDateString()}</span>
              {status === 'own' ? <span className="text-xs text-muted-foreground">Your room</span>
                : status === 'member' ? <span className="text-xs text-muted-foreground">Joined</span>
                : status === 'restricted' ? <span className="text-xs text-muted-foreground">Muted or removed</span>
                : status === 'left' ? <Button size="sm" variant="outline" onClick={() => onAsk(l)}>Ask to rejoin ({joinCost})</Button>
                : status === 'invited' ? <span className="text-xs text-cheese">Invite waiting in Groups</span>
                : status === 'requested' ? <span className="text-xs text-muted-foreground">Requested</span>
                : <Button size="sm" disabled={full} className="bg-cheese text-primary-foreground hover:bg-cheese/90" onClick={() => onAsk(l)}>{full ? 'Full' : `Ask to join (${joinCost})`}</Button>}
            </div>
          </li>;
        })}
      </ul>
    </DialogContent>
  </Dialog>;
}

/** Creator-only room settings: the group name/picture and the public listing in one window, so a
 *  group update can never be mistaken for a listing update. A fresh listing pays the 100.0000 CHEESE
 *  anti-spam listing fee; updating a listed room's details and unlisting pay the normal room fee.
 *  One Terms box gates every paid button; each button shows its own cost. */
export function RoomSettingsDialog({ groupId, groupName, groupAvatar, members, publicKey, creatorName, listed, busy, metaCost, onNameChange, onPaint, onUpdateMeta, onList, onUnlist, onEditLog, onClose, listCost = LISTING_FEE_QUANTITY, updateCost = ROOM_FEE_QUANTITY, unlistCost = ROOM_FEE_QUANTITY, initialName, initialTopic = '', initialTags = [] }: {
  groupId: string; groupName: string; groupAvatar?: CryptAvatar; members: number; publicKey: string; listed: boolean; busy: boolean;
  metaCost: string; onNameChange: (name: string) => void; onPaint: () => void; onUpdateMeta: () => Promise<boolean>;
  onList: (info: { name: string; topic: string; tags: string[] }) => Promise<boolean>; onUnlist: () => Promise<boolean>; onClose: () => void;
  listCost?: string; updateCost?: string; unlistCost?: string; initialName?: string; initialTopic?: string; initialTags?: string[];
  creatorName?: string; onEditLog?: () => void;
}) {
  const [name, setName] = useState(cleanRoomName(initialName ?? groupName));
  const [topic, setTopic] = useState(initialTopic);
  const [tags, setTags] = useState(initialTags.join(' '));
  const [agreed, setAgreed] = useState(false);
  const info = { name: cleanRoomName(name), topic: cleanRoomTopic(topic), tags: cleanTags(tags) };
  let error = '';
  if (!info.name) error = 'Give the room a name';
  else try { encodeListing({ id: groupId, ...info, publicKey, members, creatorName }); } catch (e) { error = (e as Error).message; }
  return <Dialog open onOpenChange={o => { if (!o && !busy) onClose(); }}>
    <DialogContent className="max-w-md max-h-[85dvh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>✏️ Room settings</DialogTitle>
        <DialogDescription>Only you, the creator, can change these. Members get group updates encrypted; the newest one wins.</DialogDescription>
      </DialogHeader>
      <section className="space-y-2" aria-label="Group settings">
        <p className="text-[10px] font-bold uppercase tracking-wider text-cheese">👥 Group</p>
        <div className="flex items-center gap-3">
          <button type="button" onClick={onPaint} aria-label="Change group picture" className="shrink-0 rounded-md border border-border p-1 hover:border-cheese">
            {groupAvatar ? <PixelAvatar account="group" avatar={groupAvatar} className="h-10 w-10" /> : <span className="flex h-10 w-10 items-center justify-center text-xl">👥</span>}
          </button>
          <Input value={groupName} maxLength={40} aria-label="Group name" onChange={e => onNameChange(e.target.value)} />
        </div>
        <Button size="sm" disabled={busy || !agreed || !metaCost} onClick={() => void onUpdateMeta()}>{busy ? 'Sending…' : `Pay & update group (${metaCost || 'enter a name'})`}</Button>
      </section>
      <hr className="border-border" />
      <section className="space-y-2" aria-label="Public listing">
        <p className="text-[10px] font-bold uppercase tracking-wider text-cheese">🌐 Public listing</p>
        <p className="text-[11px] text-muted-foreground">{listed
          ? 'This room is listed publicly, so anyone can find it and ask to join. Requests appear at the top of your sidebar.'
          : 'Not listed. Only people you invite can find this room. Listing publishes the room name, topic, tags, member count, your username and public key on chain so others can ask to join; the member list and messages are never published.'}</p>
        <Input maxLength={MAX_ROOM_NAME} aria-label="Listed room name" placeholder="Room name" value={name} onChange={e => setName(e.target.value)} />
        <Input maxLength={MAX_ROOM_TOPIC} aria-label="Room topic" placeholder="Short topic, e.g. Cheese lovers of Brisbane" value={topic} onChange={e => setTopic(e.target.value)} />
        <Input aria-label="Room tags" placeholder="Up to 3 tags, e.g. cheese wax nfts" value={tags} onChange={e => setTags(e.target.value)} />
        {info.tags.length > 0 && <p className="text-[11px] text-muted-foreground">{info.tags.map(t => `#${t}`).join(' ')}</p>}
        {error && <p className="text-xs text-destructive">{error}</p>}
        <p className="rounded-md border border-cheese/30 bg-cheese/5 p-2 text-xs text-muted-foreground">⚠️ <span className="font-semibold text-cheese">Your account and public messaging key are published on chain</span> with this listing, so anyone can read them. That only lets people send join requests for this room: regular messages from accounts you have not added stay hidden unless you turn on the Public Inbox, and you can block anyone at any time.</p>
        <p className="text-xs text-muted-foreground">{listed
          ? 'Updating details and unlisting pay the normal room fee; platform fees split 80% to eosio.null and 20% to xcheeseliqst. Costs include encrypted room-policy copies for members.'
          : 'Making a room public pays a one-time, non-refundable 100.0000 CHEESE listing fee (split 80% to eosio.null and 20% to xcheeseliqst) to deter throwaway spam listings; updating details later costs only the normal fee. Costs include encrypted room-policy copies for members.'}</p>
        <div className="flex flex-wrap gap-2">
          {listed && <Button size="sm" variant="outline" disabled={busy || !agreed} onClick={() => void onUnlist()}>{busy ? 'Sending…' : `Pay & unlist (${unlistCost})`}</Button>}
          <Button size="sm" disabled={busy || !agreed || !!error} onClick={() => void onList(info)}>{busy ? 'Sending…' : listed ? `Update details (${updateCost})` : `Pay & list room (${listCost})`}</Button>
        </div>
      </section>
      {onEditLog && <Button variant="outline" size="sm" onClick={onEditLog}>✏️ Edited messages</Button>}
      <TermsCheckbox id="crypt-room-settings-terms" checked={agreed} onCheckedChange={setAgreed} />
      <DialogFooter>
        <Button variant="outline" disabled={busy} onClick={onClose}>Close</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}

/** Join requests to my listed rooms, shown at the top of the sidebar. Declining and blocking are free. */
export function JoinRequests({ requests, roomName, roomFull, nameFor, onAccept, onDecline, onBlock, isRejoin = () => false, label = 'Room join requests' }: {
  requests: JoinRequest[]; roomName: (id: string) => string; roomFull: (id: string, requester: string) => boolean; nameFor: (a: string) => string;
  onAccept: (r: JoinRequest) => void; onDecline: (r: JoinRequest) => void; onBlock: (r: JoinRequest) => void;
  isRejoin?: (r: JoinRequest) => boolean; label?: string;
}) {
  if (!requests.length) return null;
  return <section aria-label={label} className="space-y-2 rounded-md border border-cheese/30 bg-cheese/5 p-2">
    <div className="flex items-center gap-1 px-1 text-[10px] font-bold uppercase tracking-wider text-cheese"><Globe className="h-3.5 w-3.5" /> Join requests</div>
    {requests.map(r => {
      const full = roomFull(r.groupId, r.from);
      return <div key={`${r.groupId}:${r.from}`} className="space-y-1.5 px-1">
        <p className="text-xs break-words"><span className="font-semibold">{nameFor(r.from)}</span>{nameFor(r.from) !== r.from && <span className="font-mono text-muted-foreground"> ({r.from})</span>} wants to {isRejoin(r) ? 'rejoin' : 'join'} <span className="font-semibold">{roomName(r.groupId)}</span></p>
        {r.note && <p className="text-xs italic text-muted-foreground break-words">“{r.note}”</p>}
        <div className="flex gap-1">
          <Button size="sm" className="h-7 flex-1 bg-cheese text-primary-foreground hover:bg-cheese/90" disabled={full} title={full ? 'This room is full' : 'Sends the updated invite to everyone in the room'} onClick={() => onAccept(r)}>{full ? 'Full' : 'Accept'}</Button>
          <Button size="sm" variant="outline" className="h-7 flex-1" onClick={() => onDecline(r)}>Decline</Button>
          <Button size="sm" variant="ghost" className="h-7 text-destructive hover:text-destructive" onClick={() => onBlock(r)}>Block</Button>
        </div>
      </div>;
    })}
  </section>;
}
