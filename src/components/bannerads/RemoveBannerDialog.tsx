import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useWax } from "@/context/WaxContext";
import { useToast } from "@/hooks/use-toast";
import { closeWharfkitModals, getTransactPlugins } from "@/lib/wharfKit";
import { Loader2, ShieldAlert } from "lucide-react";
import { BannerSlot } from "@/hooks/useBannerSlots";
import { IPFS_GATEWAYS } from "@/lib/ipfsGateways";
import { formatSlotDateUTC } from "./SlotCalendar";

function BannerPreview({ ipfsHash, label }: { ipfsHash: string; label: string }) {
  const [gatewayIdx, setGatewayIdx] = useState(0);
  if (!ipfsHash) return null;
  const imgUrl = `${IPFS_GATEWAYS[gatewayIdx]}${ipfsHash}`;
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <img src={imgUrl} alt={label} className="w-full max-w-[580px] h-auto rounded-md border border-border/50 object-cover" onError={() => { if (gatewayIdx < IPFS_GATEWAYS.length - 1) setGatewayIdx((i) => i + 1); }} />
    </div>
  );
}

interface RemoveBannerDialogProps { open: boolean; onOpenChange: (open: boolean) => void; slot: BannerSlot; onSuccess: () => void; }

export function RemoveBannerDialog({ open, onOpenChange, slot, onSuccess }: RemoveBannerDialogProps) {
  const { session } = useWax();
  const { toast } = useToast();
  const [clearShared, setClearShared] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasSharedRenter = slot.rentalType === "shared" && !!slot.sharedUser;

  const handleRemove = async () => {
    if (!session) return;
    setIsSubmitting(true);
    try {
      const result = await session.transact({ actions: [{ account: "cheesebannad", name: "removeadbanner", authorization: [session.permissionLevel], data: { caller: session.actor.toString(), start_time: slot.time, position: slot.position, clear_shared: clearShared } }] }, { transactPlugins: getTransactPlugins(session) });
      if (result.resolved?.transaction.id) { toast({ title: "Banner Removed", description: `Position ${slot.position} on ${formatSlotDateUTC(slot.time)} has been suspended.` }); onSuccess(); onOpenChange(false); }
    } catch (error) {
      console.error("Remove banner failed:", error);
      closeWharfkitModals();
      toast({ title: "Remove Failed", description: error instanceof Error ? error.message : "Transaction failed", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => closeWharfkitModals(), 100);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-destructive" />Remove Banner Ad</DialogTitle>
          <DialogDescription>This will immediately pull down the advertisement and prevent the renter from re-uploading until an admin reinstates the slot.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
            <p><span className="text-muted-foreground">Slot:</span> <span className="font-medium">{formatSlotDateUTC(slot.time)}</span></p>
            <p><span className="text-muted-foreground">Position:</span> <span className="font-medium">{slot.position}</span></p>
            <p><span className="text-muted-foreground">Renter:</span> <span className="font-medium font-mono">{slot.user}</span></p>
            {hasSharedRenter && <p><span className="text-muted-foreground">Shared renter:</span> <span className="font-medium font-mono">{slot.sharedUser}</span></p>}
          </div>
          {slot.ipfsHash && <BannerPreview ipfsHash={slot.ipfsHash} label={`Banner by ${slot.user}`} />}
          {hasSharedRenter && slot.sharedIpfsHash && <BannerPreview ipfsHash={slot.sharedIpfsHash} label={`Banner by ${slot.sharedUser}`} />}
          {hasSharedRenter && (
            <div className="flex items-center gap-3 rounded-lg border border-border/50 p-3">
              <Checkbox id="clear-shared" checked={clearShared} onCheckedChange={(checked) => setClearShared(checked === true)} />
              <Label htmlFor="clear-shared" className="cursor-pointer text-sm">Also clear shared renter's content</Label>
            </div>
          )}
          <p className="text-xs text-muted-foreground">The slot will remain rented. Use <strong>Reinstate</strong> to allow the renter to re-upload after a community decision.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleRemove} disabled={isSubmitting || !session} variant="destructive">{isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Remove Ad</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
