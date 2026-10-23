import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/** Device-only block list: add by account, unblock any entry. */
export function BlockedDialog({ blocked, onBlock, onUnblock, onClose }: {
  blocked: string[]; onBlock: (account: string) => void; onUnblock: (account: string) => void; onClose: () => void;
}) {
  const [acct, setAcct] = useState('');
  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>🚫 Blocked accounts</DialogTitle>
          <DialogDescription>Messages, group messages and voice notes from blocked accounts are skipped before decryption on this device. Nothing changes on-chain.</DialogDescription>
        </DialogHeader>
        <form className="flex gap-2" onSubmit={e => { e.preventDefault(); onBlock(acct); setAcct(''); }}>
          <Input value={acct} maxLength={12} onChange={e => setAcct(e.target.value)} placeholder="account.wam" aria-label="Account to block" />
          <Button type="submit" variant="destructive" disabled={!acct.trim()}>Block</Button>
        </form>
        <ul className="max-h-60 space-y-1 overflow-y-auto">
          {!blocked.length && <li className="text-sm text-muted-foreground">No one is blocked.</li>}
          {blocked.map(a => (
            <li key={a} className="flex items-center justify-between rounded-md px-2 py-1 hover:bg-muted">
              <span className="font-mono text-sm">{a}</span>
              <Button size="sm" variant="outline" aria-label={`Unblock ${a}`} onClick={() => onUnblock(a)}>Unblock</Button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
