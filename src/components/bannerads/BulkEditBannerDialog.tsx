import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWax } from "@/context/WaxContext";
import { useToast } from "@/hooks/use-toast";
import { closeWharfkitModals, getTransactPlugins } from "@/lib/wharfKit";
import { Loader2, X, Pencil } from "lucide-react";
import { BannerSlot } from "@/hooks/useBannerSlots";
import { IPFS_GATEWAYS } from "@/lib/ipfsGateways";
import { isDomainBlocked } from "@/lib/bannerBlocklist";
import { formatSlotDateUTC } from "./SlotCalendar";
import { OpenMojiIcon } from '@/components/OpenMojiIcon';

interface BulkEditBannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slots: BannerSlot[];
  onRemoveSlot: (time: number, position: number) => void;
  onSuccess: () => void;
}

export function BulkEditBannerDialog({ open, onOpenChange, slots, onRemoveSlot, onSuccess }: BulkEditBannerDialogProps) {
  const { session } = useWax();
  const { toast } = useToast();
  const [ipfsHash, setIpfsHash] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const previewUrl = ipfsHash ? `${IPFS_GATEWAYS[0]}${ipfsHash}` : "";
  const blocked = isDomainBlocked(websiteUrl);

  const handleSave = async () => {
    if (!session || slots.length === 0) return;
    setIsSubmitting(true);
    try {
      const actorName = session.actor.toString();
      const actions = slots.map((slot) => {
        const isShared = slot.sharedUser === actorName;
        return {
          account: "cheesebannad",
          name: isShared ? "editsharedad" : "editadbanner",
          authorization: [session.permissionLevel],
          data: {
            user: isShared ? slot.sharedUser : slot.user,
            start_time: slot.time,
            position: slot.position,
            ipfs_hash: ipfsHash,
            website_url: websiteUrl,
          },
        };
      });

      const result = await session.transact({ actions }, { transactPlugins: getTransactPlugins(session) });
      if (result.resolved?.transaction.id) {
        toast({ title: "Banners Updated! ", description: `${slots.length} banner${slots.length > 1 ? "s" : ""} updated successfully.` });
        onSuccess();
        onOpenChange(false);
        setIpfsHash("");
        setWebsiteUrl("");
      }
    } catch (error) {
      console.error("Bulk edit failed:", error);
      closeWharfkitModals();
      toast({ title: "Update Failed", description: error instanceof Error ? error.message : "Transaction failed", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => closeWharfkitModals(), 100);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-cheese" />
            Bulk Edit — {slots.length} Slot{slots.length !== 1 ? "s" : ""}
          </DialogTitle>
          <DialogDescription>Apply the same banner image and link to all selected slots.</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-2">
          <div className="space-y-4 py-2">
            {/* Selected slots list */}
            <div>
              <Label className="text-muted-foreground text-xs">Selected Slots</Label>
              <div className="mt-1.5 space-y-1">
                {slots.map((slot) => (
                  <div key={`${slot.time}-${slot.position}`} className="flex items-center justify-between rounded-md border border-border/30 bg-muted/30 px-3 py-1.5 text-sm">
                    <span>{formatSlotDateUTC(slot.time)} — Pos {slot.position}</span>
                    <button onClick={() => onRemoveSlot(slot.time, slot.position)} className="text-muted-foreground hover:text-destructive transition-colors">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* IPFS Hash */}
            <div>
              <Label>IPFS Hash</Label>
              <Input
                value={ipfsHash}
                onChange={(e) => setIpfsHash(e.target.value.replace(/^https?:\/\/.*$/i, ""))}
                placeholder="QmXyz... or bafyabc..."
                maxLength={128}
                className="mt-1"
              />
            </div>

            {/* Website URL */}
            <div>
              <Label>Website URL</Label>
              <Input
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://example.com"
                maxLength={256}
                className="mt-1"
              />
              {blocked && <p className="text-xs text-destructive mt-1 font-medium">This domain is not allowed.</p>}
            </div>

            {/* Dimensions reminder */}
            <div className="rounded-lg border border-border/30 bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground text-sm"><OpenMojiIcon emoji="" size={14} /> Required Dimensions</p>
              <p><strong>580 × 150 px</strong> — exact size required</p>
            </div>

            {/* Preview */}
            {previewUrl && (
              <div>
                <Label className="text-muted-foreground">Preview</Label>
                <div className="mt-2 rounded-lg overflow-hidden border border-border/30">
                  <img
                    src={previewUrl}
                    alt="Banner preview"
                    className="w-full h-auto max-h-40 object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={isSubmitting || !session || blocked || !ipfsHash || slots.length === 0}
            className="bg-cheese hover:bg-cheese-dark text-primary-foreground"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Update {slots.length} Slot{slots.length !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
