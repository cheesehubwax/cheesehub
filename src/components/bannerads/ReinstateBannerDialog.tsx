import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useWax } from "@/context/WaxContext";
import { useToast } from "@/hooks/use-toast";
import { closeWharfkitModals, getTransactPlugins } from "@/lib/wharfKit";
import { Loader2, ShieldCheck } from "lucide-react";
import { BannerSlot } from "@/hooks/useBannerSlots";
import { formatSlotDateUTC } from "./SlotCalendar";

interface ReinstateBannerDialogProps { open: boolean; onOpenChange: (open: boolean) => void; slot: BannerSlot; onSuccess: () => void; }

export function ReinstateBannerDialog({ open, onOpenChange, slot, onSuccess }: ReinstateBannerDialogProps) {
  const { session } = useWax();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleReinstate = async () => {
    if (!session) return;
    setIsSubmitting(true);
    try {
      const result = await session.transact({ actions: [{ account: "cheesebannad", name: "reinstateadbanner", authorization: [session.permissionLevel], data: { caller: session.actor.toString(), start_time: slot.time, position: slot.position } }] }, { transactPlugins: getTransactPlugins(session) });
      if (result.resolved?.transaction.id) { toast({ title: "Banner Reinstated", description: `Position ${slot.position} on ${formatSlotDateUTC(slot.time)} is now unsuspended.` }); onSuccess(); onOpenChange(false); }
    } catch (error) {
      console.error("Reinstate banner failed:", error);
      closeWharfkitModals();
      toast({ title: "Reinstate Failed", description: error instanceof Error ? error.message : "Transaction failed", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => closeWharfkitModals(), 100);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-green-500" />Reinstate Banner Ad</DialogTitle>
          <DialogDescription>This will lift the suspension and allow the renter to re-upload their banner content.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
            <p><span className="text-muted-foreground">Slot:</span> <span className="font-medium">{formatSlotDateUTC(slot.time)}</span></p>
            <p><span className="text-muted-foreground">Position:</span> <span className="font-medium">{slot.position}</span></p>
            <p><span className="text-muted-foreground">Renter:</span> <span className="font-medium font-mono">{slot.user}</span></p>
          </div>
          <p className="text-xs text-muted-foreground">The renter will need to call <strong>Edit Banner</strong> again to upload new content after reinstatement.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleReinstate} disabled={isSubmitting || !session} className="bg-green-600 hover:bg-green-700 text-white">{isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Reinstate</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
