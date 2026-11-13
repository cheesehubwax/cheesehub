import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TermsContent } from "./TermsContent";

interface Props {
  open: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

/** Blocking clickwrap shown before wallet connection; it can only be closed by accepting or declining. */
export function TermsGateDialog({ open, onAccept, onDecline }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onDecline(); }}>
      <DialogContent
        className="sm:max-w-2xl max-h-[85vh] flex flex-col"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-cheese">🧀 Terms of Use</DialogTitle>
          <DialogDescription>
            Please read and accept the Terms of Use to connect your wallet. Acceptance covers every action you take on CHEESEHub.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto pr-2 border border-border rounded-md p-3" style={{ maxHeight: "calc(85vh - 12rem)" }}>
          <TermsContent />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onDecline}>Cancel</Button>
          <Button onClick={onAccept} className="bg-cheese hover:bg-cheese-dark text-primary-foreground">I accept — Connect</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
