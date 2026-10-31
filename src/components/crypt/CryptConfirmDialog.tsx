import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export type CryptConfirm = { title: string; body: string; okLabel?: string; run: () => void };

/** Two-button OK/Cancel gate for sidebar menu commands. Rendered outside the menu popover so it survives the menu closing. */
export function CryptConfirmDialog({ confirm, onClose }: { confirm: CryptConfirm | null; onClose: () => void }) {
  if (!confirm) return null;
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>{confirm.title}</DialogTitle><DialogDescription>{confirm.body}</DialogDescription></DialogHeader>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => { onClose(); confirm.run(); }}>{confirm.okLabel ?? 'OK'}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
