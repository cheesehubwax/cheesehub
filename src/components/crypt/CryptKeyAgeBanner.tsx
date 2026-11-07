import { Button } from '@/components/ui/button';

/** Gentle reminder once a key is over 90 days old. Presentational. */
export function CryptKeyAgeBanner({ ageDays, onRotate, onSnooze }: { ageDays: number; onRotate: () => void; onSnooze: () => void }) {
  return <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
    <span>🔄 Your key is {ageDays} days old. Rotate it?</span>
    <span className="flex gap-2">
      <Button size="sm" className="h-7 text-xs" onClick={onRotate}>Rotate</Button>
      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onSnooze}>Remind me later</Button>
    </span>
  </div>;
}
