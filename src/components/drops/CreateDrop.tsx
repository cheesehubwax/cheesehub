import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useWax } from "@/context/WaxContext";
import { buildDropCreationActions, validateDropFormData, fetchCollectionRamBalance, fetchCollectionActiveDropsClaims, type DropFormData, type RamBalance } from "@/lib/drops";
import { closeWharfkitModals, getTransactPlugins } from "@/lib/wharfKit";
import { toast } from "sonner";
import { Loader2, Plus, Wallet, Info, Calendar, Image as ImageIcon, Package, Zap, Check, Coins, X, HardDrive, AlertTriangle } from "lucide-react";
import { ManageRamDialog } from "./ManageRamDialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { OpenMojiIcon } from "@/components/OpenMojiIcon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchUserCollections, fetchTemplateById } from "@/services/atomicApi";
import { useQuery } from "@tanstack/react-query";
import { TokenPriceInput } from "./TokenPriceInput";
import { PremintNFTPicker } from "./PremintNFTPicker";

const IPFS_GATEWAY = 'https://ipfs.io/ipfs/';

export function CreateDrop() {
  const { session, isConnected, login } = useWax();
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [templatePreview, setTemplatePreview] = useState<{
    name: string;
    image: string;
    maxSupply: number;
    issuedSupply: number;
  } | null>(null);
  
  const accountName = session?.actor?.toString() || '';

  const { data: userCollections = [] } = useQuery({
    queryKey: ['userCollections', accountName],
    queryFn: () => fetchUserCollections(accountName),
    enabled: !!accountName,
  });

  const [formData, setFormData] = useState<DropFormData>({
    dropType: 'mint-on-demand',
    collectionName: "",
    templateId: "",
    name: "",
    description: "",
    prices: [{ token: 'CHEESE', amount: 0 }],
    maxClaimable: 0,
    accountLimit: 1,
    startTime: new Date(),
    endTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    isHidden: false,
    priceRecipient: "",
    assetIds: [],
    tokensToBack: [],
  });

  const [ramBalance, setRamBalance] = useState<RamBalance | null>(null);
  const [loadingRamBalance, setLoadingRamBalance] = useState(false);
  const [existingClaims, setExistingClaims] = useState<{ totalRemaining: number; dropCount: number } | null>(null);

  const BYTES_PER_NFT = 151;
  const WAX_PER_KB = 0.01;

  const fetchRamBalanceForCollection = useCallback(async (collectionName: string) => {
    if (!collectionName) { setRamBalance(null); setExistingClaims(null); return; }
    setLoadingRamBalance(true);
    try {
      const [balance, claims] = await Promise.all([
        fetchCollectionRamBalance(collectionName),
        fetchCollectionActiveDropsClaims(collectionName),
      ]);
      setRamBalance(balance);
      setExistingClaims(claims);
    } catch { setRamBalance(null); setExistingClaims(null); }
    finally { setLoadingRamBalance(false); }
  }, []);

  useEffect(() => {
    if (formData.collectionName) {
      fetchRamBalanceForCollection(formData.collectionName);
    } else { setRamBalance(null); setExistingClaims(null); }
  }, [formData.collectionName, formData.dropType, fetchRamBalanceForCollection]);

  const ramShortage = (() => {
    const newClaimCount = formData.dropType === 'premint' ? formData.assetIds.length : formData.maxClaimable;
    if (newClaimCount <= 0) return null;
    const existingRemaining = existingClaims?.totalRemaining || 0;
    const totalClaims = newClaimCount + existingRemaining;
    const requiredBytes = totalClaims * BYTES_PER_NFT;
    const availableBytes = ramBalance?.bytes || 0;
    if (availableBytes >= requiredBytes) return null;
    const shortageBytes = requiredBytes - availableBytes;
    return {
      shortageBytes,
      availableNFTs: Math.floor(availableBytes / BYTES_PER_NFT),
      availableBytes,
      requiredBytes,
      estimatedWax: (shortageBytes / 1024 * WAX_PER_KB).toFixed(2),
      newClaimCount,
      existingRemaining,
      existingDropCount: existingClaims?.dropCount || 0,
      totalClaims,
    };
  })();

  const handleAssetSelectionChange = (assetIds: string[]) => {
    setFormData(prev => ({ ...prev, assetIds }));
  };

  useEffect(() => {
    const fetchTemplate = async () => {
      if (!formData.templateId || !formData.collectionName) { setTemplatePreview(null); return; }
      try {
        const template = await fetchTemplateById(formData.templateId, formData.collectionName);
        if (template) {
          setTemplatePreview(template);
          if (!formData.name && template.name) setFormData(prev => ({ ...prev, name: template.name }));
        } else { setTemplatePreview(null); }
      } catch { setTemplatePreview(null); }
    };
    const debounce = setTimeout(fetchTemplate, 500);
    return () => clearTimeout(debounce);
  }, [formData.templateId, formData.collectionName]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!session) { toast.error("Please connect your wallet first"); return; }
    const validationError = validateDropFormData(formData);
    if (validationError) { toast.error(validationError); return; }
    const submissionData = { ...formData, maxClaimable: formData.dropType === 'premint' ? formData.assetIds.length : formData.maxClaimable };
    setLoading(true);
    try {
      const actions = buildDropCreationActions(String(session.actor), submissionData);
      await session.transact({ actions }, { transactPlugins: getTransactPlugins(session) });
      toast.success("Drop created successfully!");
      setFormData({
        dropType: 'mint-on-demand', collectionName: "", templateId: "", name: "", description: "",
        prices: [{ token: 'CHEESE', amount: 0 }], maxClaimable: 0, accountLimit: 1,
        startTime: new Date(), endTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isHidden: false, priceRecipient: "", assetIds: [], tokensToBack: [],
      });
      setRamBalance(null); setTemplatePreview(null);
    } catch (error) {
      closeWharfkitModals();
      toast.error(error instanceof Error ? error.message : "Failed to create drop");
    } finally { closeWharfkitModals(); setTimeout(() => closeWharfkitModals(), 300); setLoading(false); }
  }

  if (!isConnected) {
    return (
      <Card className="max-w-2xl mx-auto bg-card/50 border-border/50">
        <CardContent className="py-12 text-center">
          <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Connect Your Wallet</h3>
          <p className="text-muted-foreground mb-6">You need to connect your WAX wallet to create a drop.</p>
          <Button onClick={login} className="bg-primary hover:bg-primary/90 text-primary-foreground">Connect Wallet</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto bg-card/50 border-border/50">
      <CardHeader>
        <div className="flex items-center gap-3 mb-2">
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Create a New Drop
          </CardTitle>
          <ManageRamDialog />
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="p-1.5 h-auto hover:bg-primary/10 flex items-center gap-1.5">
                <Info className="h-6 w-6 text-primary hover:text-primary/80 transition-colors" />
                <span className="text-xs text-primary font-medium">click me for help</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <Info className="h-5 w-5 text-primary" />
                  Drop Creation Guide
                </DialogTitle>
              </DialogHeader>
              <ScrollArea className="max-h-[65vh] pr-4">
                <Accordion type="multiple" defaultValue={["overview"]} className="space-y-2">
                  <AccordionItem value="overview" className="border border-border/50 rounded-lg px-4">
                    <AccordionTrigger className="text-sm font-medium hover:no-underline text-primary">What is a Drop?</AccordionTrigger>
                    <AccordionContent className="text-sm text-foreground space-y-2">
                      <p>A drop is a way to sell NFTs at a fixed price. Drops are powered by the <strong className="text-primary">nfthivedrops</strong> smart contract.</p>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="ram" className="border border-border/50 rounded-lg px-4">
                    <AccordionTrigger className="text-sm font-medium hover:no-underline text-primary">Mint-on-Demand vs Pre-mint</AccordionTrigger>
                    <AccordionContent className="text-sm text-foreground space-y-4">
                      <div>
                        <p className="font-medium text-primary">Mint-on-Demand (Recommended)</p>
                        <p className="text-xs mt-1">NFTs are created when buyers claim. Requires RAM.</p>
                      </div>
                      <div>
                        <p className="font-medium text-primary">Pre-mint</p>
                        <p className="text-xs mt-1">Use NFTs you've already minted. No RAM needed.</p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </div>
        <CardDescription>Create an NFT drop priced in CHEESE on NFT Hive.</CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleCreate} className="space-y-6">
          {/* Drop Type Selector */}
          <div className="space-y-3">
            <Label>Drop Type</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => setFormData(prev => ({ ...prev, dropType: 'mint-on-demand', assetIds: [] }))}
                className={cn("flex items-start gap-3 p-4 rounded-lg border-2 text-left transition-all",
                  formData.dropType === 'mint-on-demand' ? "border-primary bg-primary/10" : "border-border/50 hover:border-primary/50")}>
                <div className={cn("rounded-full p-2", formData.dropType === 'mint-on-demand' ? "bg-primary/20" : "bg-muted")}>
                  <Zap className={cn("h-5 w-5", formData.dropType === 'mint-on-demand' ? "text-primary" : "text-muted-foreground")} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Mint-on-Demand</span>
                    <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded">Recommended</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">NFTs are created when buyers claim.</p>
                </div>
                {formData.dropType === 'mint-on-demand' && <Check className="h-5 w-5 text-primary" />}
              </button>

              <div
                className="flex items-start gap-3 p-4 rounded-lg border-2 text-left opacity-50 cursor-not-allowed border-border/50 relative">
                <div className="rounded-full p-2 bg-muted">
                  <Package className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-muted-foreground">Pre-mint</span>
                    <span className="text-[10px] bg-destructive/20 text-destructive px-1.5 py-0.5 rounded font-semibold">Under Maintenance</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Use existing NFTs from your wallet.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Collection */}
          <div className="space-y-2">
            <Label>Collection Name *</Label>
            {userCollections.length > 0 ? (
              <Select value={formData.collectionName} onValueChange={(v) => setFormData(prev => ({ ...prev, collectionName: v, assetIds: [] }))}>
                <SelectTrigger><SelectValue placeholder="Select collection" /></SelectTrigger>
                <SelectContent>{userCollections.map((c: string) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            ) : formData.dropType === 'premint' ? (
              <div className="p-4 border border-dashed border-border/50 rounded-lg text-center">
                <AlertTriangle className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  You must be an authorized account on a collection to create a pre-mint drop.
                </p>
              </div>
            ) : (
              <Input placeholder="e.g. cheesenftwax" value={formData.collectionName} onChange={(e) => setFormData(prev => ({ ...prev, collectionName: e.target.value.toLowerCase(), assetIds: [] }))} />
            )}
          </div>

          {/* Template ID - Mint-on-Demand */}
          {formData.dropType === 'mint-on-demand' && (
            <>
              <div className="space-y-2">
                <Label>Template ID *</Label>
                <Input placeholder="e.g. 894299" value={formData.templateId} onChange={(e) => setFormData(prev => ({ ...prev, templateId: e.target.value.replace(/\D/g, '') }))} />
              </div>
              {templatePreview && (
                <div className="flex items-center gap-4 p-4 rounded-lg border border-primary/30 bg-primary/5">
                  <div className="relative h-20 w-20 rounded-lg overflow-hidden bg-muted">
                    <img src={templatePreview.image} alt={templatePreview.name} className="h-full w-full object-cover" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2"><ImageIcon className="h-4 w-4 text-primary" /><span className="font-medium">{templatePreview.name}</span></div>
                    <p className="text-sm text-muted-foreground mt-1">Supply: {templatePreview.issuedSupply} / {templatePreview.maxSupply === 0 ? '∞' : templatePreview.maxSupply}</p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* NFT Picker - Pre-mint */}
          {formData.dropType === 'premint' && (
            <div className="space-y-3">
              <Label>Select NFTs to Drop *</Label>
              <PremintNFTPicker collectionName={formData.collectionName} selectedAssetIds={formData.assetIds} onSelectionChange={handleAssetSelectionChange} />
            </div>
          )}

          {/* Name & Description */}
          <div className="space-y-2">
            <Label>Drop Name *</Label>
            <Input placeholder="e.g. Limited Edition Cheese Mug" value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea placeholder="Describe your drop..." value={formData.description} onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))} rows={3} />
          </div>

          {/* Pricing */}
          <TokenPriceInput prices={formData.prices} onChange={(prices) => setFormData(prev => ({ ...prev, prices }))} minPrices={1} maxPrices={10} />

          {/* RAM Status */}
          {formData.collectionName && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-primary" />
                Collection RAM Status
              </Label>
              {loadingRamBalance ? (
                <div className="flex items-center gap-2 p-3 rounded-lg border border-border/50 bg-muted/30 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking RAM balance for <strong>{formData.collectionName}</strong>...
                </div>
              ) : ramBalance ? (
                <div className={cn(
                  "p-3 rounded-lg border space-y-1",
                  ramShortage
                    ? "border-destructive/50 bg-destructive/10"
                    : "border-primary/50 bg-primary/10"
                )}>
                  <div className="flex items-start gap-2">
                    {ramShortage ? (
                      <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    ) : (
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-1 flex-1">
                      <p className={cn("text-sm font-medium", ramShortage ? "text-destructive" : "text-primary")}>
                        {ramShortage ? "Insufficient RAM" : "RAM Available"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Collection <strong className="text-foreground">{formData.collectionName}</strong> has <strong className="text-foreground">{(ramBalance.bytes || 0).toLocaleString()}</strong> bytes (~<strong className="text-foreground">{Math.floor((ramBalance.bytes || 0) / BYTES_PER_NFT)}</strong> NFTs worth)
                      </p>
                      {ramShortage && (
                        <>
                          <p className="text-xs text-muted-foreground">
                            You need RAM for <strong className="text-foreground">{ramShortage.totalClaims}</strong> total NFTs but only have enough for ~<strong className="text-foreground">{ramShortage.availableNFTs}</strong>.
                          </p>
                          {ramShortage.existingRemaining > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Breakdown: <strong className="text-foreground">{ramShortage.newClaimCount}</strong> from this drop + <strong className="text-foreground">{ramShortage.existingRemaining}</strong> from <strong className="text-foreground">{ramShortage.existingDropCount}</strong> existing drop{ramShortage.existingDropCount !== 1 ? 's' : ''}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Shortfall: <strong className="text-foreground">{ramShortage.shortageBytes.toLocaleString()}</strong> bytes (~<strong className="text-foreground">{ramShortage.estimatedWax} WAX</strong>)
                          </p>
                          <p className="text-xs text-primary font-medium mt-1">
                            Use the <strong>Manage RAM</strong> button at the top of this page to deposit more.
                          </p>
                        </>
                      )}
                      {!ramShortage && (formData.dropType === 'premint' ? formData.assetIds.length : formData.maxClaimable) > 0 && (
                        <p className="text-xs text-primary font-medium flex items-center gap-1">
                          <OpenMojiIcon emoji="✅" size={14} />
                          Enough RAM for {formData.dropType === 'premint' ? formData.assetIds.length : formData.maxClaimable} NFTs
                          {existingClaims && existingClaims.totalRemaining > 0 && (
                            <span className="text-muted-foreground font-normal"> (incl. {existingClaims.totalRemaining} from {existingClaims.dropCount} existing drop{existingClaims.dropCount !== 1 ? 's' : ''})</span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-3 rounded-lg border border-border/50 bg-muted/30 text-sm text-muted-foreground">
                  <AlertTriangle className="h-4 w-4" />
                  Could not fetch RAM balance for this collection.
                </div>
              )}
            </div>
          )}

          {/* Supply */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Max Claimable *</Label>
              <Input type="number" min="0" placeholder="e.g. 100"
                value={formData.dropType === 'premint' ? formData.assetIds.length : formData.maxClaimable}
                disabled={formData.dropType === 'premint'}
                onChange={(e) => setFormData(prev => ({ ...prev, maxClaimable: parseInt(e.target.value) || 0 }))} />
              {formData.dropType === 'premint' && (
                <p className="text-xs text-muted-foreground">Auto-set based on selected NFTs</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Account Limit *</Label>
              <Input type="number" min="1" placeholder="e.g. 1" value={formData.accountLimit}
                onChange={(e) => setFormData(prev => ({ ...prev, accountLimit: parseInt(e.target.value) || 1 }))} />
            </div>
          </div>

          {/* Date Pickers */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Start Date & Time *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !formData.startTime && "text-muted-foreground")}>
                    <Calendar className="mr-2 h-4 w-4" />
                    {formData.startTime ? format(formData.startTime, "PPP p") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent mode="single" selected={formData.startTime} onSelect={(date) => date && setFormData(prev => ({ ...prev, startTime: date }))} initialFocus className="pointer-events-auto" />
                  <div className="p-3 border-t">
                    <Input type="time" value={format(formData.startTime, "HH:mm")} onChange={(e) => {
                      const [hours, minutes] = e.target.value.split(':');
                      const newDate = new Date(formData.startTime);
                      newDate.setHours(parseInt(hours), parseInt(minutes));
                      setFormData(prev => ({ ...prev, startTime: newDate }));
                    }} />
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>End Date & Time *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !formData.endTime && "text-muted-foreground")}>
                    <Calendar className="mr-2 h-4 w-4" />
                    {formData.endTime ? format(formData.endTime, "PPP p") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent mode="single" selected={formData.endTime} onSelect={(date) => date && setFormData(prev => ({ ...prev, endTime: date }))} initialFocus className="pointer-events-auto" />
                  <div className="p-3 border-t">
                    <Input type="time" value={format(formData.endTime, "HH:mm")} onChange={(e) => {
                      const [hours, minutes] = e.target.value.split(':');
                      const newDate = new Date(formData.endTime);
                      newDate.setHours(parseInt(hours), parseInt(minutes));
                      setFormData(prev => ({ ...prev, endTime: newDate }));
                    }} />
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Advanced */}
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" type="button" className="w-full justify-between bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30">
                Advanced Settings
                <span className="text-xs">{showAdvanced ? '▲' : '▼'}</span>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Price Recipient</Label>
                <Input placeholder={`Leave empty to use ${accountName}`} value={formData.priceRecipient}
                  onChange={(e) => setFormData(prev => ({ ...prev, priceRecipient: e.target.value.toLowerCase() }))} />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/50 p-4">
                <div>
                  <Label>Hide from Listings</Label>
                  <p className="text-xs text-muted-foreground mt-1">Drop won't appear in public listings</p>
                </div>
                <Switch checked={formData.isHidden} onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isHidden: checked }))} />
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
            {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating Drop...</>) : (<><Plus className="mr-2 h-4 w-4" />Create Drop</>)}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            {formData.dropType === 'premint' 
              ? 'Your NFTs will be transferred to the drop contract.'
              : 'Creating a drop requires WAX for RAM.'}
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
