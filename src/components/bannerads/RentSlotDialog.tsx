import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useWax } from "@/context/WaxContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { formatSlotDateUTC } from "./SlotCalendar";
import { IPFS_GATEWAYS } from "@/lib/ipfsGateways";
import { closeWharfkitModals, getTransactPlugins } from "@/lib/wharfKit";
import { isDomainBlocked } from "@/lib/bannerBlocklist";
import { Checkbox } from "@/components/ui/checkbox";
import { TermsDialog } from "@/components/shared/TermsDialog";
import { OpenMojiIcon } from '@/components/OpenMojiIcon';

interface RentSlotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startTime: number;
  position: number;
  waxPricePerDay: number;
  isJoining?: boolean;
  onSuccess: () => void;
}

export function RentSlotDialog({ open, onOpenChange, startTime, position, waxPricePerDay, isJoining = false, onSuccess }: RentSlotDialogProps) {
  const { session, refreshBalance } = useWax();
  const { toast } = useToast();
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [numDays, setNumDays] = useState(1);
  const [rentalMode, setRentalMode] = useState<"exclusive" | "shared">(isJoining ? "shared" : "exclusive");
  const [ipfsHash, setIpfsHash] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const SHARED_DISCOUNT = 0.30;
  const PROMOZ_DISCOUNT = 0.50;
  const isPromoz = session?.actor?.toString() === "cheesepromoz";
  const sharedMultiplier = rentalMode === "shared" ? (1 - SHARED_DISCOUNT) : 1;
  const promozMultiplier = isPromoz ? (1 - PROMOZ_DISCOUNT) : 1;
  const priceMultiplier = sharedMultiplier * promozMultiplier;
  const totalWax = waxPricePerDay * numDays * priceMultiplier;
  const modeChar = isJoining ? "j" : (rentalMode === "shared" ? "s" : "e");
  const memo = `banner|${startTime}|${numDays}|${position}|${modeChar}`;
  const previewUrl = ipfsHash ? `${IPFS_GATEWAYS[0]}${ipfsHash}` : "";

  const handleRent = async () => {
    if (!session) { toast({ title: "Wallet Not Connected", description: "Please connect your wallet first", variant: "destructive" }); return; }
    setIsSubmitting(true);
    try {
      const actions: any[] = [{ account: "eosio.token", name: "transfer", authorization: [session.permissionLevel], data: { from: session.actor.toString(), to: "cheesebannad", quantity: `${totalWax.toFixed(8)} WAX`, memo } }];
      if (ipfsHash) {
        const editAction = isJoining ? "editsharedad" : "editadbanner";
        const DAY_SECONDS = 86400;
        for (let i = 0; i < numDays; i++) {
          actions.push({ account: "cheesebannad", name: editAction, authorization: [session.permissionLevel], data: { user: session.actor.toString(), start_time: startTime + i * DAY_SECONDS, position, ipfs_hash: ipfsHash, website_url: websiteUrl } });
        }
      }
      await session.transact({ actions }, { transactPlugins: getTransactPlugins(session) });
      toast({ title: "Slot Rented! 🧀", description: `Position ${position} rented for ${numDays} day(s)` });
      refreshBalance?.();
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Rent failed:", error);
      closeWharfkitModals();
      toast({ title: "Rent Failed", description: error instanceof Error ? error.message : "Transaction failed", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => closeWharfkitModals(), 100);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isJoining ? "Join Shared Banner Slot" : "Rent Banner Slot"}</DialogTitle>
          <DialogDescription>Position {position} starting {formatSlotDateUTC(startTime)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div><Label>Number of Days</Label><Input type="number" min={1} max={365} value={numDays} onChange={(e) => setNumDays(Math.max(1, Math.min(365, parseInt(e.target.value) || 1)))} className="mt-1" /></div>
          {!isJoining && (
            <div><Label>Rental Type</Label>
              <RadioGroup value={rentalMode} onValueChange={(v) => setRentalMode(v as "exclusive" | "shared")} className="mt-2 space-y-2">
                <div className="flex items-center space-x-2 p-3 rounded-lg border border-border/50"><RadioGroupItem value="exclusive" id="mode-exclusive" /><Label htmlFor="mode-exclusive" className="cursor-pointer flex-1"><span className="font-medium">Exclusive</span><span className="text-xs text-muted-foreground ml-2">100% display time, full price</span></Label></div>
                <div className="flex items-center space-x-2 p-3 rounded-lg border border-border/50"><RadioGroupItem value="shared" id="mode-shared" /><Label htmlFor="mode-shared" className="cursor-pointer flex-1"><span className="font-medium">Shared (Save 30%)</span><span className="text-xs text-muted-foreground ml-2">50% display time with rotation</span></Label></div>
              </RadioGroup>
            </div>
          )}
          <div><Label>IPFS Hash</Label><Input value={ipfsHash} onChange={(e) => setIpfsHash(e.target.value.replace(/^https?:\/\/.*$/i, ""))} placeholder="QmXyz... or bafyabc..." maxLength={128} className="mt-1" /><p className="text-xs text-muted-foreground mt-1">IPFS hash only (no URLs). Max 128 characters.</p></div>
          <div><Label>Website URL</Label><Input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://example.com" maxLength={256} className="mt-1" />{isDomainBlocked(websiteUrl) && <p className="text-xs text-destructive mt-1 font-medium">This domain is not allowed.</p>}<p className="text-xs text-muted-foreground mt-1">Max 256 characters</p></div>
          <div className="rounded-lg border border-border/30 bg-muted/30 p-3 text-xs text-muted-foreground space-y-1"><p className="font-medium text-foreground text-sm"><OpenMojiIcon emoji="📐" size={14} /> Required Dimensions</p><p><strong>580 × 150 px</strong> — exact size required</p><p>Upload your image to IPFS and paste the hash here.</p></div>
          {previewUrl && <div><Label className="text-muted-foreground">Preview</Label><div className="mt-2 rounded-lg overflow-hidden border border-border/30"><img src={previewUrl} alt="Banner preview" className="w-full h-auto max-h-40 object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} /></div></div>}
          <div className="rounded-lg bg-muted/50 p-3 text-sm"><p className="font-medium">{totalWax.toFixed(2)} WAX</p><p className="text-xs text-muted-foreground">{(waxPricePerDay * priceMultiplier).toFixed(2)} WAX × {numDays} day{numDays > 1 ? "s" : ""}</p>{isPromoz && <p className="text-xs font-medium mt-1" style={{color: 'hsl(142 71% 45%)'}}><OpenMojiIcon emoji="🧀" size={14} /> Promoz 50% discount applied</p>}</div>
          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground"><p>Memo: <code className="text-foreground">{memo}</code></p></div>
        </div>
        <div className="flex items-start gap-3 py-2">
          <Checkbox id="terms-rent" checked={termsAgreed} onCheckedChange={(v) => setTermsAgreed(v === true)} className="mt-0.5" />
          <label htmlFor="terms-rent" className="text-sm cursor-pointer leading-relaxed text-muted-foreground">
           I have read the{" "}
            <TermsDialog />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleRent} disabled={isSubmitting || !session || isDomainBlocked(websiteUrl) || !termsAgreed} className="bg-cheese hover:bg-cheese-dark text-primary-foreground">{isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Rent Slot</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
