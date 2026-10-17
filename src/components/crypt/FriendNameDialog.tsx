import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MAX_CRYPT_NAME_LENGTH, parseCryptName } from '@/lib/cryptNames';

export function FriendNameDialog({ account, nickname, sharedName, onClose, onSave }: { account: string; nickname?: string; sharedName?: string; onClose: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState(nickname ?? '');
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>🤝 Friend nickname</DialogTitle><DialogDescription>{account}{sharedName ? ` · Shared name: ${sharedName}` : ''}. This nickname is private to this browser. Leave blank to use their shared name or account.</DialogDescription></DialogHeader>
      <label htmlFor="crypt-friend-name" className="text-sm font-medium">Nickname</label>
      <Input id="crypt-friend-name" value={name} maxLength={MAX_CRYPT_NAME_LENGTH} placeholder={sharedName ?? account} onChange={e => setName(e.target.value)} />
      <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!!name.trim() && !parseCryptName(name)} onClick={() => onSave(name)}>Save nickname</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}