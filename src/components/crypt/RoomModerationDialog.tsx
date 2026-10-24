import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { InviteGroupView, MuteMinutes } from '@/lib/cryptInviteGroups';
import { mutedUntil, type RoomModeration } from '@/lib/cryptModeration';

export function RoomModerationDialog({ view, state, now, busy, nameFor, onAction, onClose }: {
  view: InviteGroupView; state?: RoomModeration; now: number; busy: boolean; nameFor: (a: string) => string;
  onAction: (member: string, minutes?: MuteMinutes) => void; onClose: () => void;
}) {
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="max-w-lg max-h-[85dvh] overflow-y-auto" aria-describedby={undefined}>
      <DialogHeader><DialogTitle>🔇 Moderate {view.name}</DialogTitle></DialogHeader>
      <ul className="space-y-4">
        {view.invite.members.filter(m => m.account !== view.invite.creator).map(({ account }) => {
          const banned = state?.bans[account] !== undefined;
          const until = mutedUntil(state, account, now);
          const protectedMember = !state || state.protected.includes(account);
          return <li key={account} className="space-y-2 border-b border-border pb-3">
            <p className="text-sm font-semibold break-words">{nameFor(account)} <span className="text-xs font-normal text-muted-foreground">({account})</span></p>
            <p className="text-xs text-muted-foreground">{banned ? 'Removed' : until ? `Muted until ${new Date(until).toLocaleString()}` : protectedMember ? 'Pre-public member · protected from removal' : 'Public-room member'}</p>
            {!banned && <div className="flex flex-wrap gap-2">
              {([{ minutes: 15, label: '15m' }, { minutes: 60, label: '1hr' }, { minutes: 360, label: '6hrs' }, { minutes: 1440, label: '24hrs' }] as const).map(({ minutes, label }) =>
                <Button key={minutes} variant="outline" size="sm" disabled={busy} aria-label={`Mute ${account} for ${label}`} onClick={() => onAction(account, minutes)}>🔇 {label}</Button>)}
              <Button variant="outline" size="sm" className="text-destructive" disabled={busy || protectedMember} title={protectedMember ? 'Members from before the first public listing cannot be removed' : undefined} aria-label={`Remove ${account}`} onClick={() => onAction(account)}>🚫 Remove</Button>
            </div>}
          </li>;
        })}
      </ul>
    </DialogContent>
  </Dialog>;
}