import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { InviteGroupView, MuteMinutes } from '@/lib/cryptInviteGroups';
import { mutedUntil, type RoomModeration } from '@/lib/cryptModeration';

export type ModerationAction = 'mute' | 'ban' | 'admin' | 'unadmin';

/** Owners mute, remove (not founders) and appoint admins; admins only mute, never the owner or themselves. */
export function RoomModerationDialog({ view, state, role, account, now, busy, nameFor, onAction, onClose }: {
  view: InviteGroupView; state?: RoomModeration; role: 'owner' | 'admin'; account: string; now: number; busy: boolean; nameFor: (a: string) => string;
  onAction: (member: string, action: ModerationAction, minutes?: MuteMinutes) => void; onClose: () => void;
}) {
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="max-w-lg max-h-[85dvh] overflow-y-auto" aria-describedby={undefined}>
      <DialogHeader><DialogTitle>🔇 Moderate {view.name}</DialogTitle></DialogHeader>
      {role === 'admin' && <p className="text-xs text-muted-foreground">🛡️ You are an admin: you can mute members. Only the owner can remove members or appoint admins.</p>}
      <ul className="space-y-4">
        {view.invite.members.filter(m => m.account !== view.invite.creator && m.account !== account).map(({ account: member }) => {
          const banned = state?.bans[member] !== undefined;
          const until = mutedUntil(state, member, now);
          const protectedMember = !state || state.protected.includes(member);
          const admin = !!state?.admins.includes(member);
          return <li key={member} className="space-y-2 border-b border-border pb-3">
            <p className="text-sm font-semibold break-words">{nameFor(member)} <span className="text-xs font-normal text-muted-foreground">({member})</span>{admin && <span className="ml-1 text-xs font-normal text-cheese">🛡️ Admin</span>}</p>
            <p className="text-xs text-muted-foreground">{banned ? 'Removed' : until ? `Muted until ${new Date(until).toLocaleString()}` : protectedMember ? 'Founding member · protected from removal' : 'Public-room member'}</p>
            {!banned && <div className="flex flex-wrap gap-2">
              {([{ minutes: 15, label: '15m' }, { minutes: 60, label: '1hr' }, { minutes: 360, label: '6hrs' }, { minutes: 1440, label: '24hrs' }] as const).map(({ minutes, label }) =>
                <Button key={minutes} variant="outline" size="sm" disabled={busy} aria-label={`Mute ${member} for ${label}`} onClick={() => onAction(member, 'mute', minutes)}>🔇 {label}</Button>)}
              {role === 'owner' && <>
                <Button variant="outline" size="sm" disabled={busy} aria-label={admin ? `Remove ${member} as admin` : `Make ${member} an admin`} onClick={() => onAction(member, admin ? 'unadmin' : 'admin')}>🛡️ {admin ? 'Remove admin' : 'Make admin'}</Button>
                <Button variant="outline" size="sm" className="text-destructive" disabled={busy || protectedMember} title={protectedMember ? 'Members from before the first public listing cannot be removed' : undefined} aria-label={`Remove ${member}`} onClick={() => onAction(member, 'ban')}>🚫 Remove</Button>
              </>}
            </div>}
          </li>;
        })}
      </ul>
    </DialogContent>
  </Dialog>;
}
