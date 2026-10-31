import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TermsCheckbox } from '@/components/shared/TermsCheckbox';
import { useWax } from '@/context/WaxContext';
import { useToast } from '@/hooks/use-toast';
import { closeWharfkitModals, getTransactPlugins } from '@/lib/wharfKit';
import { fetchRoomMemos } from '@/lib/cheeseCrypt';
import { collectListings, ROOM_PREFIX } from '@/lib/cryptRooms';
import { activeHides, buildHideAction, fetchRoomHides, HIDE_QUANTITY, hideEntry, isSuppressed, type HideTarget } from '@/lib/cryptRoomDenylist';

type Pending = { target: HideTarget; hidden: boolean; label: string };

/** Admin-only: permanently hide (or restore) CHEESECrypt public rooms for every CHEESEHub visitor via an on-chain memo. */
export function CryptRoomModerationPanel() {
  const { session } = useWax();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [wholeAccount, setWholeAccount] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);

  const rooms = useQuery({ queryKey: ['admin-crypt-rooms'], queryFn: async () => collectListings(await fetchRoomMemos(ROOM_PREFIX)), staleTime: 60_000, retry: false });
  const hides = useQuery({ queryKey: ['crypt-room-hides'], queryFn: fetchRoomHides, staleTime: 60_000, retry: false });
  const active = useMemo(() => activeHides(hides.data ?? []), [hides.data]);
  const shown = useMemo(() => {
    const w = q.toLowerCase().trim();
    return (rooms.data ?? []).filter(l => !w || `${l.name} ${l.topic} ${l.creator} ${l.id}`.toLowerCase().includes(w));
  }, [rooms.data, q]);
  const accountHides = (hides.data ?? []).filter(h => h.hidden && h.id === '*');

  const submit = async () => {
    if (!session || !pending) return;
    setBusy(true);
    try {
      const actor = session.actor.toString();
      const result = await session.transact({ actions: [buildHideAction(actor, [session.permissionLevel], pending.target, pending.hidden)] as never }, { transactPlugins: getTransactPlugins(session) });
      const txId = result.resolved?.transaction.id?.toString();
      if (!txId) throw new Error('No transaction ID returned');
      toast({ title: pending.hidden ? 'Room hidden' : 'Room restored', description: `TX ${txId.slice(0, 10)}… It may take a minute to show for everyone.` });
      setPending(null); setAgreed(false); setWholeAccount('');
      setTimeout(() => void qc.invalidateQueries({ queryKey: ['crypt-room-hides'] }), 4000);
    } catch (e) {
      closeWharfkitModals();
      toast({ title: 'Transaction declined', description: e instanceof Error ? e.message : 'Transaction failed', variant: 'destructive' });
    } finally {
      setBusy(false);
      setTimeout(() => closeWharfkitModals(), 100);
    }
  };

  const validAccount = /^[a-z1-5.]{1,12}$/.test(wholeAccount.trim());

  return <Card>
    <CardHeader>
      <CardTitle className="flex items-center justify-between gap-2">
        <span>🔐 CHEESECrypt public rooms</span>
        <Button size="icon" variant="outline" aria-label="Refresh rooms" disabled={rooms.isFetching || hides.isFetching} onClick={() => { void rooms.refetch(); void hides.refetch(); }}>
          {rooms.isFetching || hides.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </CardTitle>
      <CardDescription>Hide a room from the CHEESECrypt directory for every visitor. Each hide or restore is a public {HIDE_QUANTITY} nulled transfer from your admin account. The listing itself stays on the blockchain and its members can keep chatting.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      {hides.isError && <p className="text-sm text-destructive">Couldn't read the current hide list. Refresh before making changes.</p>}
      <Input placeholder="Search room name, topic, creator or ID" aria-label="Search public rooms" value={q} onChange={e => setQ(e.target.value)} />
      <ul className="max-h-[420px] space-y-2 overflow-y-auto" aria-label="Public rooms">
        {!shown.length && <li className="py-4 text-center text-sm text-muted-foreground">{rooms.isLoading ? 'Loading rooms…' : rooms.isError ? "Couldn't load rooms." : 'No listed rooms.'}</li>}
        {shown.map(l => {
          const hidden = isSuppressed(l, active);
          const byAccount = active.includes(`${l.creator}:*`);
          return <li key={`${l.creator}:${l.id}`} className={`flex items-center justify-between gap-3 rounded-md border border-border p-3 ${hidden ? 'opacity-60' : ''}`}>
            <div className="min-w-0">
              <div className="break-words font-semibold text-cheese">{l.name}</div>
              <div className="truncate text-xs text-muted-foreground">by {l.creator} · {l.id} · listed {new Date(l.time).toLocaleDateString()}</div>
              {l.topic && <div className="break-words text-xs">{l.topic}</div>}
              {hidden && <div className="text-xs text-destructive">{byAccount ? 'Hidden (whole account)' : 'Hidden for everyone'}</div>}
            </div>
            {!byAccount && <Button size="sm" variant={hidden ? 'outline' : 'destructive'} disabled={!session || hides.isError}
              onClick={() => setPending({ target: { creator: l.creator, id: l.id }, hidden: !hidden, label: `"${l.name}" by ${l.creator}` })}>
              {hidden ? 'Restore' : 'Hide'}
            </Button>}
          </li>;
        })}
      </ul>
      <div className="space-y-2 rounded-md border border-border p-3">
        <p className="text-sm font-semibold">Hide every room from one account</p>
        <div className="flex gap-2">
          <Input placeholder="WAX account" aria-label="Account to hide" value={wholeAccount} onChange={e => setWholeAccount(e.target.value.toLowerCase())} />
          <Button variant="destructive" disabled={!session || !validAccount || hides.isError}
            onClick={() => setPending({ target: { creator: wholeAccount.trim(), id: '*' }, hidden: true, label: `every room by ${wholeAccount.trim()}` })}>Hide all</Button>
        </div>
        {accountHides.length > 0 && <ul className="space-y-1">
          {accountHides.map(h => <li key={hideEntry(h)} className="flex items-center justify-between text-xs">
            <span>{h.creator} (hidden by {h.by})</span>
            <Button size="sm" variant="outline" disabled={!session} onClick={() => setPending({ target: { creator: h.creator, id: '*' }, hidden: false, label: `every room by ${h.creator}` })}>Restore</Button>
          </li>)}
        </ul>}
      </div>
    </CardContent>
    {pending && <Dialog open onOpenChange={o => { if (!o && !busy) { setPending(null); setAgreed(false); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{pending.hidden ? '🛡️ Hide' : '👁️ Restore'} {pending.label}</DialogTitle>
          <DialogDescription>
            {pending.hidden ? 'It will stop appearing in the CHEESECrypt directory for everyone.' : 'It will appear in the CHEESECrypt directory again.'} This sends {HIDE_QUANTITY} to eosio.null with a public note. Your admin account and this decision are permanently visible on the blockchain.
          </DialogDescription>
        </DialogHeader>
        <TermsCheckbox checked={agreed} onCheckedChange={setAgreed} />
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => { setPending(null); setAgreed(false); }}>Cancel</Button>
          <Button variant={pending.hidden ? 'destructive' : 'default'} disabled={!agreed || busy} onClick={() => void submit()}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Pay & {pending.hidden ? 'hide' : 'restore'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>}
  </Card>;
}
