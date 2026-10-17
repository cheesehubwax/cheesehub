import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PixelAvatar } from '@/components/crypt/PixelAvatar';
import type { CryptAvatar } from '@/lib/cryptAvatar';

export function CreateGroupDialog({ contacts, avatars, onClose, onCreate }: {
  contacts: Record<string, string>; avatars: Record<string, CryptAvatar>; onClose: () => void; onCreate: (members: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>👥 New group</DialogTitle><DialogDescription>Select 2–5 friends. You are included automatically.</DialogDescription></DialogHeader>
      <div className="max-h-72 overflow-y-auto space-y-2">
        {Object.keys(contacts).sort().map(name => <label key={name} className="flex items-center gap-3 py-2 cursor-pointer">
          <Checkbox aria-label={name} checked={selected.includes(name)} disabled={selected.length === 5 && !selected.includes(name)}
            onCheckedChange={checked => setSelected(current => checked ? [...current, name] : current.filter(m => m !== name))} />
          <PixelAvatar account={name} avatar={avatars[name]} /><span className="min-w-0 break-all text-sm">{name}</span>
        </label>)}
        {!Object.keys(contacts).length && <p className="text-sm text-muted-foreground">Add friends’ public keys first.</p>}
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={selected.length < 2} onClick={() => onCreate(selected)}>Create group</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}