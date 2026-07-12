import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useWax } from "@/context/WaxContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2, X } from "lucide-react";
import { formatSlotDateUTC } from "./SlotCalendar";
import { IPFS_GATEWAYS } from "@/lib/ipfsGateways";
import { closeWharfkitModals, getTransactPlugins } from "@/lib/wharfKit";
import { Checkbox } from "@/components/ui/checkbox";
import { TermsDialog } from "@/components/shared/TermsDialog";
import { OpenMojiIcon } from '@/components/OpenMojiIcon';

export interface BulkSlotSelection {
  time: number;
  position: number;
  isJoining: boolean;
  rentalMode: "exclusive" | "shared";
}

interface BulkRentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selections: BulkSlotSelection[];
  waxPricePerDay: number;
  onRemoveSlot: (time: number, position: number) => void;
  onUpdateSlotMode: (time: number, position: number, mode: "exclusive" | "shared") => void;
  onSuccess: () => void;
}

export function BulkRentDialog({ open, onOpenChange, selections, waxPricePerDay, onRemoveSlot, onUpdateSlotMode, onSuccess }: BulkRentDialogProps) {
  const { session, refreshBalance } = useWax();
  const { toast } = useToast();
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [ipfsHash, setIpfsHash] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const SHARED_DISCOUNT = 0.30;
  const PROMOZ_DISCOUNT = 0.50;
  const isPromoz = session?.actor?.toString() === "cheesepromoz";

  const getSlotPrice = (slot: BulkSlotSelection) => {
    const baseMultiplier = slot.isJoining || slot.rentalMode === "shared" ? (1 - SHARED_DISCOUNT) : 1;
    const promozMultiplier = isPromoz ? (1 - PROMOZ_DISCOUNT) : 1;
    return waxPricePerDay * baseMultiplier * promozMultiplier;
  };

  const totalWax = selections.reduce((sum, s) => sum + getSlotPrice(s), 0);
  const previewUrl = ipfsHash ? `${IPFS_GATEWAYS[0]}${ipfsHash}` : "";
  const setAllMode = (mode: "exclusive" | "shared") => { selections.filter(s => !s.isJoining).forEach(s => onUpdateSlotMode(s.time, s.position, mode)); };
  const hasNewRentals = selections.some(s => !s.isJoining);

  const handleBulkRent = async () => {
    if (!session) { toast({ title: "Wallet Not Connected", description: "Please connect your wallet first", variant: "destructive" }); return; }
    if (selections.length === 0) { toast({ title: "No Slots Selected", description: "Please select at least one slot", variant: "destructive" }); return; }
    setIsSubmitting(true);
    try {
      const actions: any[] = [];
      for (const slot of selections) {
        const modeChar = slot.isJoining ? "j" : (slot.rentalMode === "shared" ? "s" : "e");
        const slotPrice = getSlotPrice(slot);
        const memo = `banner|${slot.time}|1|${slot.position}|${modeChar}`;
        actions.push({ account: "eosio.token", name: "transfer", authorization: [session.permissionLevel], data: { from: session.actor.toString(), to: "cheesebannad", quantity: `${slotPrice.toFixed(8)} WAX`, memo } });
        if (ipfsHash) {
          const editAction = slot.isJoining ? "editsharedad" : "editadbanner";
          actions.push({ account: "cheesebannad", name: editAction, authorization: [session.permissionLevel], data: { user: session.actor.toString(), start_time: slot.time, position: slot.position, ipfs_hash: ipfsHash, website_url: websiteUrl } });
        }
      }
      await session.transact({ actions }, { transactPlugins: getTransactPlugins(session) });
      toast({ title: "Slots Rented! ", description: `${selections.length} slot${selections.length > 1 ? "s" : ""} rented successfully` });
      refreshBalance?.();
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Bulk rent failed:", error);
      closeWharfkitModals();
      toast({ title: "Rent Failed", description: error instanceof Error ? error.message : "Transaction failed", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => closeWharfkitModals(), 100);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Rent {selections.length} Banner Slot{selections.length > 1 ? "s" : ""}</DialogTitle>
          <DialogDescription>All slots will be rented in a single transaction</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {hasNewRentals && <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">Set all to:</span><Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAllMode("exclusive")}>Exclusive</Button><Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAllMode("shared")}>Shared</Button></div>}
          <div><Label className="text-sm font-medium">Selected Slots</Label>
            <div className="mt-2 space-y-2 max-h-52 overflow-y-auto">
              {selections.map((slot) => (
                <div key={`${slot.time}-${slot.position}`} className="flex items-center justify-between rounded-lg border border-border/30 bg-muted/30 px-3 py-2 gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-shrink"><span className="text-sm whitespace-nowrap">{formatSlotDateUTC(slot.time)}</span><Badge variant="outline" className="text-xs shrink-0">Pos {slot.position}</Badge></div>
                  <div className="flex items-center gap-2 shrink-0">
                    {slot.isJoining ? <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">Join</Badge> : (
                      <div className="flex rounded-md border border-border/50 overflow-hidden">
                        <button type="button" className={`px-2 py-0.5 text-xs transition-colors ${slot.rentalMode === "exclusive" ? "bg-cheese/20 text-cheese font-medium" : "text-muted-foreground hover:bg-muted/50"}`} onClick={() => onUpdateSlotMode(slot.time, slot.position, "exclusive")}>Excl</button>
                        <button type="button" className={`px-2 py-0.5 text-xs transition-colors border-l border-border/50 ${slot.rentalMode === "shared" ? "bg-cheese/20 text-cheese font-medium" : "text-muted-foreground hover:bg-muted/50"}`} onClick={() => onUpdateSlotMode(slot.time, slot.position, "shared")}>Shared</button>
                      </div>
                    )}
                    <span className="text-xs text-muted-foreground w-16 text-right">{getSlotPrice(slot).toFixed(2)} WAX</span>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={() => onRemoveSlot(slot.time, slot.position)}><X className="h-3 w-3" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div><Label>IPFS Hash <span className="text-xs text-muted-foreground">(applied to all slots)</span></Label><Input value={ipfsHash} onChange={(e) => setIpfsHash(e.target.value.replace(/^https?:\/\/.*$/i, ""))} placeholder="QmXyz... or bafyabc..." maxLength={128} className="mt-1" /></div>
          <div><Label>Website URL <span className="text-xs text-muted-foreground">(applied to all slots)</span></Label><Input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://example.com" maxLength={256} className="mt-1" /></div>
          <div className="rounded-lg border border-border/30 bg-muted/30 p-3 text-xs text-muted-foreground space-y-1"><p className="font-medium text-foreground text-sm"><OpenMojiIcon emoji="📐" size={14} /> Required Dimensions</p><p><strong>580 × 150 px</strong> — exact size required</p></div>
          {previewUrl && <div><Label className="text-muted-foreground">Preview</Label><div className="mt-2 rounded-lg overflow-hidden border border-border/30"><img src={previewUrl} alt="Banner preview" className="w-full h-auto max-h-40 object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} /></div></div>}
          <div className="rounded-lg bg-muted/50 p-3 text-sm"><p className="font-medium">{totalWax.toFixed(2)} WAX total</p><p className="text-xs text-muted-foreground">{selections.length} slot{selections.length > 1 ? "s" : ""} × avg {(totalWax / selections.length).toFixed(2)} WAX each</p>{isPromoz && <p className="text-xs font-medium mt-1" style={{ color: 'hsl(142 71% 45%)' }}><OpenMojiIcon emoji="🧀" size={14} /> Promoz 50% discount applied</p>}</div>
        </div>
        <div className="flex items-start gap-3 py-2">
          <Checkbox id="terms-bulkrent" checked={termsAgreed} onCheckedChange={(v) => setTermsAgreed(v === true)} className="mt-0.5" />
          <label htmlFor="terms-bulkrent" className="text-sm cursor-pointer leading-relaxed text-muted-foreground">
           I have read the{" "}
            <TermsDialog />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleBulkRent} disabled={isSubmitting || !session || selections.length === 0 || !termsAgreed} className="bg-cheese hover:bg-cheese-dark text-primary-foreground">{isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Rent {selections.length} Slot{selections.length > 1 ? "s" : ""}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
