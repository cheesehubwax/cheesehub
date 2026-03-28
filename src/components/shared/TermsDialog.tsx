import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TermsContent } from "./TermsContent";

export function TermsDialog() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-primary hover:underline inline-flex items-center gap-1 font-medium"
      >
        Terms of Use
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-cheese">Terms of Use</DialogTitle>
            <p className="text-xs text-muted-foreground">Last updated: March 2025</p>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2" style={{ maxHeight: 'calc(80vh - 6rem)' }}>
            <TermsContent />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
