import { useState, useMemo, useEffect, useCallback } from "react";
import { useBannerSlots, BannerSlotGroup, BannerSlot } from "@/hooks/useBannerSlots";
import { useWax } from "@/context/WaxContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, RefreshCw, Eye, ShoppingCart, CheckCircle2, Pencil } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { IPFS_GATEWAYS } from "@/lib/ipfsGateways";
import { sanitizeUrl } from "@/lib/sanitizeUrl";
import { RentSlotDialog } from "./RentSlotDialog";
import { BulkRentDialog, BulkSlotSelection } from "./BulkRentDialog";
import { BulkEditBannerDialog } from "./BulkEditBannerDialog";
import { EditBannerDialog } from "./EditBannerDialog";
import { RemoveBannerDialog } from "./RemoveBannerDialog";
import { ReinstateBannerDialog } from "./ReinstateBannerDialog";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { getContentFingerprint, isReviewValid, toggleReview } from "@/lib/adReviewStorage";
import { OpenMojiIcon } from '@/components/OpenMojiIcon';

function PreviewBannerImage({ ipfsHash, label }: { ipfsHash: string; label: string }) {
  const [gatewayIdx, setGatewayIdx] = useState(0);
  if (!ipfsHash) return null;
  const imgUrl = `${IPFS_GATEWAYS[gatewayIdx]}${ipfsHash}`;
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <img src={imgUrl} alt={label} className="w-full h-auto rounded-md border border-border/50 object-cover"
        onError={() => { if (gatewayIdx < IPFS_GATEWAYS.length - 1) setGatewayIdx((i) => i + 1); }} />
    </div>
  );
}

function PreviewBannerDialog({ open, onOpenChange, slot }: { open: boolean; onOpenChange: (o: boolean) => void; slot: BannerSlot }) {
  const hasShared = slot.rentalType === "shared" && !!slot.sharedUser;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-cheese" />
            Preview — Pos {slot.position}, {formatSlotDateUTC(slot.time)}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
            <p><span className="text-muted-foreground">Renter:</span> <span className="font-mono font-medium">{slot.user}</span></p>
            {slot.websiteUrl && <p><span className="text-muted-foreground">URL:</span> <a href={sanitizeUrl(slot.websiteUrl)} target="_blank" rel="noopener noreferrer" className="text-cheese hover:underline break-all">{slot.websiteUrl}</a></p>}
            {hasShared && <p><span className="text-muted-foreground">Shared renter:</span> <span className="font-mono font-medium">{slot.sharedUser}</span></p>}
            {hasShared && slot.sharedWebsiteUrl && <p><span className="text-muted-foreground">Shared URL:</span> <a href={sanitizeUrl(slot.sharedWebsiteUrl)} target="_blank" rel="noopener noreferrer" className="text-cheese hover:underline break-all">{slot.sharedWebsiteUrl}</a></p>}
          </div>
          {slot.ipfsHash && <PreviewBannerImage ipfsHash={slot.ipfsHash} label={`Banner by ${slot.user}`} />}
          {hasShared && slot.sharedIpfsHash && <PreviewBannerImage ipfsHash={slot.sharedIpfsHash} label={`Banner by ${slot.sharedUser}`} />}
          {!slot.ipfsHash && !(hasShared && slot.sharedIpfsHash) && (
            <p className="text-sm text-muted-foreground text-center py-4">No banner images uploaded yet.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const BANNER_CONTRACT = "cheesebannad";
const MIN_RENT_BUFFER_HOURS = 48;
const MIN_JOIN_BUFFER_HOURS = 12;

function isWithinBuffer(slotTime: number, bufferHours: number): boolean {
  const cutoff = Math.floor(Date.now() / 1000) + bufferHours * 3600;
  return slotTime >= cutoff;
}

function SlotBadge({ slot, accountName }: { slot: BannerSlot; accountName: string | null }) {
  const nowSec = Math.floor(Date.now() / 1000);
  const isLive = slot.time <= nowSec;
  const isPending = !isLive && !isWithinBuffer(slot.time, MIN_RENT_BUFFER_HOURS);

  if (isLive && slot.isOnChain) return <Badge className="bg-red-500/20 text-red-500 border-red-500/30 text-xs animate-pulse"><OpenMojiIcon emoji="🔴" size={14} /> Live</Badge>;
  if (!slot.isOnChain) {
    if (isPending) return <Badge className="bg-orange-500/20 text-orange-500 border-orange-500/30 text-xs">Pending</Badge>;
    return <Badge className="bg-green-500/20 text-green-600 border-green-500/30 text-xs">Available</Badge>;
  }
  if (slot.suspended) return <Badge variant="destructive" className="text-xs">Suspended</Badge>;
  if (slot.rentalType === "exclusive" && slot.user === accountName) return <Badge className="bg-cheese/20 text-cheese border-cheese/30 text-xs">Yours</Badge>;
  if (slot.rentalType === "exclusive" && slot.user !== BANNER_CONTRACT) return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">Rented</Badge>;
  if (slot.rentalType === "shared" && slot.user === accountName) {
    if (slot.sharedUser) return <Badge className="bg-cheese/20 text-cheese border-cheese/30 text-xs">Yours (Shared)</Badge>;
    return <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30 text-xs">Yours (Open)</Badge>;
  }
  if (slot.rentalType === "shared" && slot.sharedUser === accountName) return <Badge className="bg-cheese/20 text-cheese border-cheese/30 text-xs">Yours (Shared)</Badge>;
  if (slot.rentalType === "shared" && !slot.sharedUser) {
    if (isPending) return <Badge className="bg-orange-500/20 text-orange-500 border-orange-500/30 text-xs">Shared - Pending</Badge>;
    return <Badge className="bg-green-500/20 text-green-600 border-green-500/30 text-xs">Shared - Open</Badge>;
  }
  if (slot.rentalType === "shared" && slot.sharedUser) return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">Shared - Full</Badge>;
  if (isPending) return <Badge className="bg-orange-500/20 text-orange-500 border-orange-500/30 text-xs">Pending</Badge>;
  return <Badge className="bg-green-500/20 text-green-600 border-green-500/30 text-xs">Available</Badge>;
}

const utcDateFormatter = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
export function formatSlotDateUTC(slotTime: number): string {
  return utcDateFormatter.format(new Date(slotTime * 1000));
}

function filterFutureGroups(groups: BannerSlotGroup[], isAdmin: boolean): BannerSlotGroup[] {
  const nowSec = Math.floor(Date.now() / 1000);
  if (isAdmin) {
    const oneDayAgo = nowSec - 86400;
    return groups.filter((g) => g.time > oneDayAgo);
  }
  return groups.filter((g) => g.time > nowSec);
}

function LiveCountdown({ slotTime }: { slotTime: number }) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const diffSec = Math.max(0, slotTime - now);

  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 30_000);
    return () => clearInterval(id);
  }, []);

  if (diffSec <= 0) return <>{"< 1 min"}</>;
  const hrs = Math.floor(diffSec / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  if (hrs >= 1) return <>{`~${hrs} hr${hrs > 1 ? "s" : ""}`}</>;
  if (mins < 1) return <>{"< 1 min"}</>;
  return <>{`${mins} min`}</>;
}

export function SlotCalendar() {
  const { slotGroups, pricing, isLoading, refetch } = useBannerSlots();
  const { accountName } = useWax();
  const [rentTarget, setRentTarget] = useState<{ time: number; position: number; isJoining?: boolean } | null>(null);
  const [editTarget, setEditTarget] = useState<BannerSlot | null>(null);
  const [removeTarget, setRemoveTarget] = useState<BannerSlot | null>(null);
  const [reinstateTarget, setReinstateTarget] = useState<BannerSlot | null>(null);
  const [previewTarget, setPreviewTarget] = useState<BannerSlot | null>(null);
  const [selectedSlots, setSelectedSlots] = useState<BulkSlotSelection[]>([]);
  const [selectedEditSlots, setSelectedEditSlots] = useState<BannerSlot[]>([]);
  const [selectionMode, setSelectionMode] = useState<"rent" | "edit" | null>(null);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkEditDialogOpen, setBulkEditDialogOpen] = useState(false);
  const { isWhitelisted: isAdmin } = useAdminAccess();
  const [reviewVersion, setReviewVersion] = useState(0);

  const futureGroups = useMemo(() => filterFutureGroups(slotGroups, isAdmin), [slotGroups, isAdmin]);

  const handleToggleReview = useCallback((slot: BannerSlot) => {
    if (!accountName) return;
    const fp = getContentFingerprint(slot.ipfsHash, slot.websiteUrl, slot.sharedIpfsHash, slot.sharedWebsiteUrl);
    toggleReview(accountName, slot.time, slot.position, fp);
    setReviewVersion(v => v + 1);
  }, [accountName]);

  const isSlotSelected = useCallback((time: number, position: number) => {
    return selectedSlots.some(s => s.time === time && s.position === position);
  }, [selectedSlots]);

  const toggleSlotSelection = useCallback((time: number, position: number, isJoining: boolean) => {
    // Switching to rent mode clears edit selections
    if (selectionMode === "edit") {
      setSelectedEditSlots([]);
    }
    setSelectionMode("rent");
    setSelectedSlots(prev => {
      const exists = prev.some(s => s.time === time && s.position === position);
      if (exists) {
        const next = prev.filter(s => !(s.time === time && s.position === position));
        if (next.length === 0) setSelectionMode(null);
        return next;
      }
      return [...prev, { time, position, isJoining, rentalMode: isJoining ? "shared" as const : "exclusive" as const }];
    });
  }, [selectionMode]);

  const toggleEditSlotSelection = useCallback((slot: BannerSlot) => {
    // Switching to edit mode clears rent selections
    if (selectionMode === "rent") {
      setSelectedSlots([]);
    }
    setSelectionMode("edit");
    setSelectedEditSlots(prev => {
      const exists = prev.some(s => s.time === slot.time && s.position === slot.position);
      if (exists) {
        const next = prev.filter(s => !(s.time === slot.time && s.position === slot.position));
        if (next.length === 0) setSelectionMode(null);
        return next;
      }
      return [...prev, slot];
    });
  }, [selectionMode]);

  const removeSlotFromSelection = useCallback((time: number, position: number) => {
    setSelectedSlots(prev => {
      const next = prev.filter(s => !(s.time === time && s.position === position));
      if (next.length === 0) setSelectionMode(null);
      return next;
    });
  }, []);

  const removeEditSlotFromSelection = useCallback((time: number, position: number) => {
    setSelectedEditSlots(prev => {
      const next = prev.filter(s => !(s.time === time && s.position === position));
      if (next.length === 0) setSelectionMode(null);
      return next;
    });
  }, []);

  const updateSlotMode = useCallback((time: number, position: number, mode: "exclusive" | "shared") => {
    setSelectedSlots(prev => prev.map(s => s.time === time && s.position === position ? { ...s, rentalMode: mode } : s));
  }, []);

  const clearSelection = useCallback(() => { setSelectedSlots([]); setSelectedEditSlots([]); setSelectionMode(null); }, []);

  const handleBulkSuccess = useCallback(() => { clearSelection(); refetch(); }, [clearSelection, refetch]);

  const isSlotSelectable = (slot: BannerSlot): { selectable: boolean; isJoining: boolean } => {
    if ((slot.isAvailable || !slot.isOnChain) && slot.rentalType !== "shared" && isWithinBuffer(slot.time, MIN_RENT_BUFFER_HOURS)) return { selectable: true, isJoining: false };
    if (slot.isOnChain && slot.isAvailable && slot.rentalType === "shared" && !slot.sharedUser && isWithinBuffer(slot.time, MIN_JOIN_BUFFER_HOURS)) return { selectable: true, isJoining: true };
    return { selectable: false, isJoining: false };
  };

  const isSlotEditable = (slot: BannerSlot): boolean => {
    if (!accountName || !slot.isOnChain || slot.suspended) return false;
    if (slot.user !== accountName && slot.sharedUser !== accountName) return false;
    return isWithinBuffer(slot.time, MIN_RENT_BUFFER_HOURS);
  };

  if (isLoading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-cheese" /></div>;

  return (
    <TooltipProvider>
      <div className="flex flex-col items-center text-center mb-4 gap-3 px-2">
        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-sm w-full justify-center">
          <span className="text-foreground font-medium whitespace-nowrap">Exclusive: {pricing.waxPerDay} WAX/day</span>
          <span className="text-muted-foreground hidden sm:inline">|</span>
          <div className="flex flex-col items-center sm:items-start">
            <span className="text-foreground font-medium">Shared: {(pricing.waxPerDay * 0.7).toFixed(0)} WAX/day</span>
            <span className="text-xs text-muted-foreground">30% off, 50% display time</span>
            <span className="text-xs text-muted-foreground mt-0.5">OR</span>
            <span className="text-foreground font-medium">Shared: {(pricing.waxPerDay * 0.7 * 2).toFixed(0)} WAX/day</span>
            <span className="text-xs text-muted-foreground">and show 2 banners for less than 2 exclusive slots</span>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={refetch} className="text-cheese"><RefreshCw className="h-4 w-4 mr-1" />Refresh</Button>
      </div>

      <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
        <OpenMojiIcon emoji="⚠️" size={18} className="font-semibold" /> Warning: Content is moderated and if deemed offensive may be removed without warning. However you may question this decision in the{" "}
        <a href="https://t.me/cheeseonwaxofficial" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-amber-600 dark:hover:text-amber-300 transition-colors">$CHEESE Telegram group</a>{" "}
        and have it reviewed and possibly reinstated.
      </div>

      {futureGroups.length > 0 && <div className="mb-4 text-sm text-foreground text-center flex items-center justify-center gap-2"><Checkbox disabled className="pointer-events-none" /> Use the checkboxes to select multiple slots to rent or edit them all in one transaction</div>}

      <div className="space-y-3">
        {futureGroups.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg font-medium">No banner slots available</p>
            <p className="text-sm mt-1">No initialized slots found on-chain. Check back later.</p>
          </div>
        )}
        {futureGroups.map((group) => (
          <Card key={group.time} className="border-border/50 bg-card/50">
            <CardContent className="py-4 px-5">
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="md:w-40 shrink-0">
                  <p className="font-medium text-foreground">{formatSlotDateUTC(group.time)}</p>
                  <p className="text-xs text-muted-foreground">Starts 14:00 UTC</p>
                  <p className="text-xs text-cheese font-medium mt-0.5">Live in <LiveCountdown slotTime={group.time} /></p>
                </div>
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {group.slots.map((slot) => {
                    const { selectable, isJoining } = isSlotSelectable(slot);
                    const editable = isSlotEditable(slot);
                    const selected = isSlotSelected(slot.time, slot.position);
                    const editSelected = selectedEditSlots.some(s => s.time === slot.time && s.position === slot.position);
                    const isHighlighted = selected || editSelected;
                    return (
                      <div key={slot.position} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border p-3 bg-background/50 transition-colors ${isHighlighted ? "border-cheese/60 bg-cheese/5" : "border-border/30"}`}>
                        <div className="flex items-center gap-2 sm:gap-3">
                          {selectable && <Checkbox checked={selected} onCheckedChange={() => toggleSlotSelection(slot.time, slot.position, isJoining)} className="data-[state=checked]:bg-cheese data-[state=checked]:border-cheese" />}
                          {!selectable && editable && <Checkbox checked={editSelected} onCheckedChange={() => toggleEditSlotSelection(slot)} className="data-[state=checked]:bg-cheese data-[state=checked]:border-cheese" />}
                          <span className="text-sm font-medium text-muted-foreground">Pos {slot.position}</span>
                          <SlotBadge slot={slot} accountName={accountName} />
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                          {selectable && !selected && <Button size="sm" className="bg-cheese hover:bg-cheese-dark text-primary-foreground text-xs h-7" onClick={() => setRentTarget({ time: slot.time, position: slot.position, isJoining })}>{isJoining ? "Join" : "Rent"}</Button>}
                          {slot.isOnChain && !slot.suspended && (slot.user === accountName || slot.sharedUser === accountName) && isWithinBuffer(slot.time, MIN_RENT_BUFFER_HOURS) && <Button size="sm" variant="outline" className="border-cheese/30 text-cheese text-xs h-7" onClick={() => setEditTarget(slot)}>Edit</Button>}
                          {isAdmin && slot.isOnChain && slot.user !== BANNER_CONTRACT && <Button size="sm" variant="outline" className="border-green-500/50 text-green-600 text-xs h-7 hover:bg-green-500/10" onClick={() => setPreviewTarget(slot)}><Eye className="h-3 w-3 mr-1" />Preview</Button>}
                          {isAdmin && slot.isOnChain && slot.user !== BANNER_CONTRACT && !slot.suspended && <Button size="sm" variant="destructive" className="text-xs h-7" onClick={() => setRemoveTarget(slot)}>Remove</Button>}
                          {isAdmin && slot.isOnChain && slot.suspended && <Button size="sm" variant="outline" className="border-green-500/50 text-green-600 text-xs h-7 hover:bg-green-500/10" onClick={() => setReinstateTarget(slot)}>Reinstate</Button>}
                          {isAdmin && slot.isOnChain && slot.user !== BANNER_CONTRACT && (() => {
                            const fp = getContentFingerprint(slot.ipfsHash, slot.websiteUrl, slot.sharedIpfsHash, slot.sharedWebsiteUrl);
                            const reviewed = accountName ? isReviewValid(accountName, slot.time, slot.position, fp) : false;
                            // reviewVersion used to trigger re-render
                            void reviewVersion;
                            return (
                              <button
                                onClick={() => handleToggleReview(slot)}
                                className={`flex items-center gap-1 text-xs h-7 px-2 rounded-md border transition-colors ${reviewed ? "border-green-500/50 bg-green-500/10 text-green-600" : "border-border/50 bg-muted/30 text-muted-foreground hover:border-muted-foreground/30"}`}
                                title={reviewed ? "Reviewed by you — click to uncheck" : "Mark as reviewed"}
                              >
                                <CheckCircle2 className={`h-3.5 w-3.5 ${reviewed ? "text-green-600" : "text-muted-foreground/50"}`} />
                                {reviewed ? "Reviewed" : "Review"}
                              </button>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedSlots.length > 0 && selectionMode === "rent" && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-full border border-cheese/40 bg-card/95 backdrop-blur-sm shadow-lg px-5 py-3">
          <ShoppingCart className="h-4 w-4 text-cheese" />
          <span className="text-sm font-medium">{selectedSlots.length} slot{selectedSlots.length > 1 ? "s" : ""} selected</span>
          <Button size="sm" variant="ghost" className="text-xs text-muted-foreground h-7" onClick={clearSelection}>Clear</Button>
          <Button size="sm" className="bg-cheese hover:bg-cheese-dark text-primary-foreground h-8" onClick={() => setBulkDialogOpen(true)}>Rent All</Button>
        </div>
      )}

      {selectedEditSlots.length > 0 && selectionMode === "edit" && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-full border border-cheese/40 bg-card/95 backdrop-blur-sm shadow-lg px-5 py-3">
          <Pencil className="h-4 w-4 text-cheese" />
          <span className="text-sm font-medium">{selectedEditSlots.length} slot{selectedEditSlots.length > 1 ? "s" : ""} selected</span>
          <Button size="sm" variant="ghost" className="text-xs text-muted-foreground h-7" onClick={clearSelection}>Clear</Button>
          <Button size="sm" className="bg-cheese hover:bg-cheese-dark text-primary-foreground h-8" onClick={() => setBulkEditDialogOpen(true)}>Edit All</Button>
        </div>
      )}

      {rentTarget && <RentSlotDialog open={!!rentTarget} onOpenChange={(open) => !open && setRentTarget(null)} startTime={rentTarget.time} position={rentTarget.position} waxPricePerDay={pricing.waxPerDay} isJoining={rentTarget.isJoining || false} onSuccess={refetch} />}
      <BulkRentDialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen} selections={selectedSlots} waxPricePerDay={pricing.waxPerDay} onRemoveSlot={removeSlotFromSelection} onUpdateSlotMode={updateSlotMode} onSuccess={handleBulkSuccess} />
      <BulkEditBannerDialog open={bulkEditDialogOpen} onOpenChange={setBulkEditDialogOpen} slots={selectedEditSlots} onRemoveSlot={removeEditSlotFromSelection} onSuccess={handleBulkSuccess} />
      {editTarget && <EditBannerDialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)} slot={editTarget} onSuccess={refetch} />}
      {removeTarget && <RemoveBannerDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)} slot={removeTarget} onSuccess={refetch} />}
      {reinstateTarget && <ReinstateBannerDialog open={!!reinstateTarget} onOpenChange={(open) => !open && setReinstateTarget(null)} slot={reinstateTarget} onSuccess={refetch} />}
      {previewTarget && <PreviewBannerDialog open={!!previewTarget} onOpenChange={(open) => !open && setPreviewTarget(null)} slot={previewTarget} />}
    </TooltipProvider>
  );
}
