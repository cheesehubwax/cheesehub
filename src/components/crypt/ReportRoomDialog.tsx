import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TermsCheckbox } from '@/components/shared/TermsCheckbox';
import { REPORT_EMAIL, REPORT_QUANTITY, REPORT_REASONS, REPORT_TELEGRAM, reportEmailHref, type ReportReason } from '@/lib/cryptRoomReports';

/** Report a public room listing to CHEESEHub (not the room's owner). The Messenger signs the in-app report. */
export function ReportRoomDialog({ room, busy, onReport, onClose }: {
  room: { name: string; creator: string; id: string }; busy: boolean;
  onReport: (reason: ReportReason) => void; onClose: () => void;
}) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [agreed, setAgreed] = useState(false);
  return <Dialog open onOpenChange={o => { if (!o && !busy) onClose(); }}>
    <DialogContent className="max-w-md max-h-[85dvh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>🚩 Report {room.name} to CHEESEHub</DialogTitle>
        <DialogDescription>This goes to the CHEESEHub moderation team, not the room's owner or admins. For the fastest response, use the in-app report or the official CHEESE Telegram group.</DialogDescription>
      </DialogHeader>
      <div className="space-y-2 rounded-md border border-cheese/40 bg-cheese/5 p-3">
        <p className="text-sm font-semibold">1. In-app report (fastest)</p>
        <div className="grid gap-1.5" role="radiogroup" aria-label="Report reason">
          {(Object.entries(REPORT_REASONS) as unknown as [string, string][]).map(([k, label]) => {
            const r = Number(k) as ReportReason;
            return <Button key={k} type="button" size="sm" role="radio" aria-checked={reason === r} variant={reason === r ? 'default' : 'outline'}
              className={reason === r ? 'justify-start bg-cheese text-primary-foreground hover:bg-cheese/90' : 'justify-start'} onClick={() => setReason(r)}>{label}</Button>;
          })}
        </div>
        <p className="text-xs text-muted-foreground">Sends {REPORT_QUANTITY} to eosio.null with only the room and the reason above, so it appears straight away in the CHEESEHub admin reports list. Your WAX account and the report are public on the blockchain. Reporting doesn't hide the room by itself; a CHEESEHub admin reviews it.</p>
        <TermsCheckbox checked={agreed} onCheckedChange={setAgreed} />
        <Button className="w-full bg-cheese text-primary-foreground hover:bg-cheese/90" disabled={!reason || !agreed || busy} onClick={() => reason && onReport(reason)}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Pay {REPORT_QUANTITY} & report
        </Button>
      </div>
      <div className="space-y-1.5 rounded-md border border-border p-3">
        <p className="text-sm font-semibold">2. Official CHEESE Telegram (fast)</p>
        <p className="text-xs text-muted-foreground">Message the moderators with the room name <span className="font-mono">{room.name}</span>, creator <span className="font-mono">{room.creator}</span> and room ID <span className="font-mono">{room.id}</span>.</p>
        <Button asChild variant="outline" className="w-full"><a href={REPORT_TELEGRAM} target="_blank" rel="noopener noreferrer">Open Telegram</a></Button>
      </div>
      <div className="space-y-1.5 rounded-md border border-border p-3">
        <p className="text-sm font-semibold">3. Email</p>
        <p className="text-xs text-muted-foreground">For formal or legal notices. Email to {REPORT_EMAIL} is checked less often, so expect a slower reply than the in-app report or Telegram.</p>
        <Button asChild variant="outline" className="w-full"><a href={reportEmailHref(room)}>Email {REPORT_EMAIL}</a></Button>
      </div>
    </DialogContent>
  </Dialog>;
}
