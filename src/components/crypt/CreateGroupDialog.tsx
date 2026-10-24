import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PixelAvatar } from '@/components/crypt/PixelAvatar';
import { AvatarEditor } from '@/components/crypt/AvatarEditor';
import { TermsCheckbox } from '@/components/shared/TermsCheckbox';
import { MAX_INVITE_MEMBERS } from '@/lib/cryptInviteGroups';
import { parseCryptName } from '@/lib/cryptNames';
import type { CryptAvatar } from '@/lib/cryptAvatar';
import { cleanRoomTopic, cleanTags, MAX_ROOM_TOPIC } from '@/lib/cryptRooms';

/** New invite group: name, 1–7 friends, optional picture; invites are paid encrypted messages. */
export function CreateGroupDialog({ contacts, avatars, nameFor = account => account, onClose, onCreate, costFor, busy = false }: {
  contacts: Record<string, string>; avatars: Record<string, CryptAvatar>; onClose: () => void;
  onCreate: (name: string, members: string[], avatar?: CryptAvatar, info?: { topic: string; tags: string[] }) => Promise<boolean> | void;
  /** Total CHEESE for the invites, or '' when nothing is selected yet. */
  costFor?: (name: string, members: string[], avatar?: CryptAvatar) => string;
  nameFor?: (account: string) => string; busy?: boolean;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [tags, setTags] = useState('');
  const [avatar, setAvatar] = useState<CryptAvatar | undefined>();
  const [painting, setPainting] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const max = MAX_INVITE_MEMBERS - 1;
  const validName = parseCryptName(name);
  const cost = validName && selected.length ? costFor?.(validName, selected, avatar) ?? '' : '';
  const info = { topic: cleanRoomTopic(topic), tags: cleanTags(tags) };
  return <>
    <Dialog open={!painting} onOpenChange={open => { if (!open && !busy) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>👥 New group</DialogTitle>
          <DialogDescription>Pick 1–{max} friends (up to {MAX_INVITE_MEMBERS} people with you). Public rooms can grow to 50.</DialogDescription></DialogHeader>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setPainting(true)} aria-label="Set group picture" title="Set group picture" className="shrink-0 rounded-md border border-border p-1 hover:border-cheese">
            {avatar ? <PixelAvatar account="group" avatar={avatar} className="h-10 w-10" /> : <span className="flex h-10 w-10 items-center justify-center text-xl">👥</span>}
          </button>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Group name" aria-label="Group name" maxLength={40} />
        </div>
        <Input value={topic} onChange={e => setTopic(e.target.value)} maxLength={MAX_ROOM_TOPIC} aria-label="Group description" placeholder="Description (optional), shown if you make it public" />
        <Input value={tags} onChange={e => setTags(e.target.value)} aria-label="Group tags" placeholder="Up to 3 tags (optional), e.g. cheese wax nfts" />
        {info.tags.length > 0 && <p className="text-[11px] text-muted-foreground">{info.tags.map(t => `#${t}`).join(' ')}</p>}
        <div className="max-h-64 overflow-y-auto space-y-2">
          {Object.keys(contacts).sort().map(n => <label key={n} className="flex items-center gap-3 py-2 cursor-pointer">
            <Checkbox aria-label={n} checked={selected.includes(n)} disabled={selected.length === max && !selected.includes(n)}
              onCheckedChange={checked => setSelected(current => checked ? [...current, n] : current.filter(m => m !== n))} />
            <PixelAvatar account={n} avatar={avatars[n]} /><span className="min-w-0 break-words text-sm">{nameFor(n)}{nameFor(n) !== n && <span className="block text-xs text-muted-foreground">{n}</span>}</span>
          </label>)}
          {!Object.keys(contacts).length && <p className="text-sm text-muted-foreground">Add friends’ public keys first.</p>}
        </div>
        {cost && <p className="text-xs text-muted-foreground">Invites cost {cost}: 0.0100 CHEESE per part platform fee (80% eosio.null, 20% xcheeseliqst) plus 0.0001 CHEESE per part to each invited friend, in one transaction.</p>}
        <TermsCheckbox id="crypt-group-terms" checked={agreed} onCheckedChange={setAgreed} />
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button disabled={busy || !agreed || !validName || selected.length < 1} onClick={() => { if (validName) void onCreate(validName, selected, avatar, info); }}>
            {busy ? 'Sending invites…' : 'Create & send invites'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    {painting && <AvatarEditor account="group" avatar={avatar} title="🎨 Group picture" onClose={() => setPainting(false)} onSave={a => { setAvatar(a); setPainting(false); }} />}
  </>;
}
