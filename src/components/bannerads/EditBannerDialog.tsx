import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWax } from "@/context/WaxContext";
import { useToast } from "@/hooks/use-toast";
import { closeWharfkitModals, getTransactPlugins } from "@/lib/wharfKit";
import { Loader2 } from "lucide-react";
import { BannerSlot } from "@/hooks/useBannerSlots";
import { IPFS_GATEWAYS } from "@/lib/ipfsGateways";

interface EditBannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slot: BannerSlot;
  onSuccess: () => void;
}

export function EditBannerDialog({ open, onOpenChange, slot, onSuccess }: EditBannerDialogProps) {
  const { session } = useWax();
  const { toast } = useToast();
  const isSharedUser = slot.sharedUser === session?.actor?.toString();
  const [ipfsHash, setIpfsHash] = useState(isSharedUser ? slot.sharedIpfsHash || "" : slot.ipfsHash);
  const [websiteUrl, setWebsiteUrl] = useState(isSharedUser ? slot.sharedWebsiteUrl || "" : slot.websiteUrl);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const previewUrl = ipfsHash ? `${IPFS_GATEWAYS[0]}${ipfsHash}` : "";

  const handleSave = async () => {
    if (!session) return;
    setIsSubmitting(true);
    try {
      const isShared = slot.sharedUser === session.actor.toString();
      const actionName = isShared ? "editsharedad" : "editadbanner";
      const action = { account: "cheesebannad", name: actionName, authorization: [session.permissionLevel], data: { user: session.actor.toString(), start_time: slot.time, position: slot.position, ipfs_hash: ipfsHash, website_url: websiteUrl } };
      const result = await session.transact({ actions: [action] }, { transactPlugins: getTransactPlugins(session) });
      if (result.resolved?.transaction.id) { toast({ title: "Banner Updated! 🧀", description: "Your banner ad has been updated." }); onSuccess(); onOpenChange(false); }
    } catch (error) {
      console.error("Edit banner failed:", error);
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
          <DialogTitle>Edit Banner Ad</DialogTitle>
          <DialogDescription>Position {slot.position} — Update your banner image and link.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div><Label>IPFS Hash</Label><Input value={ipfsHash} onChange={(e) => setIpfsHash(e.target.value.replace(/^https?:\/\/.*$/i, ""))} placeholder="QmXyz... or bafyabc..." maxLength={128} className="mt-1" /></div>
          <div><Label>Website URL</Label><Input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://example.com" maxLength={256} className="mt-1" /></div>
          <div className="rounded-lg border border-border/30 bg-muted/30 p-3 text-xs text-muted-foreground space-y-1"><p className="font-medium text-foreground text-sm">📐 Required Dimensions</p><p><strong>580 × 150 px</strong> — exact size required</p></div>
          {previewUrl && <div><Label className="text-muted-foreground">Preview</Label><div className="mt-2 rounded-lg overflow-hidden border border-border/30"><img src={previewUrl} alt="Banner preview" className="w-full h-auto max-h-40 object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} /></div></div>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSubmitting || !session} className="bg-cheese hover:bg-cheese-dark text-primary-foreground">{isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
