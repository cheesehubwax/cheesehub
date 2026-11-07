import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RETENTION_OPTIONS, retentionLabel, type Retention } from '@/lib/cryptKeyRing';
import type { RetiredView } from '@/hooks/useCryptKeyRotation';
import { CryptConfirmDialog, type CryptConfirm } from './CryptConfirmDialog';

const day = (iso: string | null) => iso ? new Date(iso).toLocaleDateString() : 'never';

/** Privacy dialog card: key age, Rotate key, how long old keys are kept, and the retired-key list. Presentational. */
export function CryptKeyRotationCard({ ageDays, retention, setRetention, retired, pendingFriends, onRotate, onAnnounce, onDestroy }: {
  ageDays: number | null; retention: Retention; setRetention: (r: Retention) => void; retired: RetiredView[];
  pendingFriends: number; onRotate: () => void; onAnnounce: () => void; onDestroy: (publicKey: string) => void;
}) {
  const [confirm, setConfirm] = useState<CryptConfirm | null>(null);
  return <section className="space-y-2 rounded-md border border-border p-3">
    <h3 className="font-semibold text-foreground">🔄 Key rotation</h3>
    <p>{ageDays === null ? 'Your key age is unknown.' : `Your key is ${ageDays} day${ageDays === 1 ? '' : 's'} old.`} Rotating swaps it for a fresh one, privately: only your friends get the new key, inside encrypted notices. Friends and groups stay.</p>
    <p className="text-xs">The real privacy gain comes when old keys are destroyed: messages only they could open become unreadable for everyone, including you. Backup files you downloaded earlier still hold old keys until you delete them.</p>
    <div className="flex flex-wrap gap-2">
      <Button size="sm" onClick={onRotate}>🔄 Rotate key</Button>
      {pendingFriends > 0 && <Button size="sm" variant="outline" onClick={onAnnounce}>Tell {pendingFriends} friend{pendingFriends === 1 ? '' : 's'} my new key</Button>}
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-foreground">Keep old keys for</span>
      {RETENTION_OPTIONS.map(r => (
        <Button key={String(r)} size="sm" variant={retention === r ? 'default' : 'outline'} aria-pressed={retention === r} onClick={() => setRetention(r)}>{retentionLabel(r)}</Button>
      ))}
    </div>
    <p className="text-xs">Old keys are only destroyed once every friend has your new key and no room still uses the old one.</p>
    {retired.length > 0 && <ul className="space-y-1">
      {retired.map(r => <li key={r.publicKey} className="flex items-center justify-between gap-2 rounded border border-border px-2 py-1 text-xs">
        <span>Retired {day(r.retiredAt)} · {r.pinnedRooms ? `kept for ${r.pinnedRooms} room${r.pinnedRooms === 1 ? '' : 's'}` : `expires ${day(r.expiresAt)}`}</span>
        <Button size="sm" variant="outline" className="h-6 text-xs" disabled={r.pinnedRooms > 0} onClick={() => setConfirm({
          title: '🔥 Destroy this old key now?',
          body: `Messages that only this key can open become permanently unreadable on this device.${pendingFriends ? ` ${pendingFriends} friend${pendingFriends === 1 ? ' has' : 's have'} not been told your new key yet, so their next messages may not open.` : ''}`,
          okLabel: 'Destroy key', run: () => onDestroy(r.publicKey),
        })}>Destroy now</Button>
      </li>)}
    </ul>}
    <CryptConfirmDialog confirm={confirm} onClose={() => setConfirm(null)} />
  </section>;
}
