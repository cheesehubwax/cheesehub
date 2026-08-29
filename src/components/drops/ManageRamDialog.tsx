import { useState, useEffect } from "react";
import { closeWharfkitModals, getTransactPlugins } from "@/lib/wharfKit";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWax } from "@/context/WaxContext";
import { toast } from "sonner";
import { HardDrive, Loader2, Download, Upload, RefreshCw } from "lucide-react";
import { fetchUserCollections } from "@/services/atomicApi";
import { useQuery } from "@tanstack/react-query";
import { buildDepositRamActions, buildWithdrawRamActions, fetchCollectionRamBalance, type RamBalance } from "@/lib/drops";
import { WAX_CHAIN } from "@/lib/waxConfig";

export function ManageRamDialog() {
  const { session, isConnected } = useWax();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawBytes, setWithdrawBytes] = useState("");
  const [ramBalance, setRamBalance] = useState<RamBalance | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [waxBalance, setWaxBalance] = useState<number | null>(null);

  const accountName = session?.actor?.toString() || '';

  const { data: userCollections = [] } = useQuery({
    queryKey: ['userCollections', accountName],
    queryFn: () => fetchUserCollections(accountName),
    enabled: !!accountName && open,
  });

  useEffect(() => { if (accountName && open) fetchWaxBalance(); }, [accountName, open]);
  useEffect(() => { if (selectedCollection && open) fetchRamBalance(); }, [selectedCollection, open]);

  async function fetchWaxBalance() {
    if (!accountName) return;
    try {
      const response = await fetch(`${WAX_CHAIN.url}/v1/chain/get_currency_balance`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'eosio.token', account: accountName, symbol: 'WAX' }),
      });
      const balances = await response.json();
      setWaxBalance(balances?.length > 0 ? parseFloat(balances[0].split(' ')[0]) : 0);
    } catch { setWaxBalance(null); }
  }

  async function fetchRamBalance() {
    if (!selectedCollection) return;
    setLoadingBalance(true);
    try { setRamBalance(await fetchCollectionRamBalance(selectedCollection)); }
    catch { setRamBalance(null); }
    finally { setLoadingBalance(false); }
  }

  async function handleDeposit() {
    if (!session || !selectedCollection || !depositAmount) { toast.error("Please fill in all fields"); return; }
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) { toast.error("Please enter a valid amount"); return; }
    setLoading(true);
    try {
      const actions = buildDepositRamActions(accountName, selectedCollection, amount);
      await session.transact({ actions }, { transactPlugins: getTransactPlugins(session) });
      toast.success(`Successfully deposited ${amount} WAX for RAM`);
      setDepositAmount(""); await fetchRamBalance();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Failed to deposit RAM"); }
    finally { setLoading(false); closeWharfkitModals(); setTimeout(() => closeWharfkitModals(), 300); }
  }

  async function handleWithdraw() {
    if (!session || !selectedCollection) { toast.error("Please select a collection"); return; }
    if (!ramBalance || ramBalance.bytes === 0) { toast.error("No RAM to withdraw"); return; }
    const bytes = parseInt(withdrawBytes);
    if (isNaN(bytes) || bytes <= 0) { toast.error("Please enter a valid byte amount"); return; }
    if (bytes > ramBalance.bytes) { toast.error("Cannot withdraw more than deposited"); return; }
    setLoading(true);
    try {
      const actions = buildWithdrawRamActions(accountName, selectedCollection, bytes);
      await session.transact({ actions }, { transactPlugins: getTransactPlugins(session) });
      toast.success(`Successfully withdrew ${bytes.toLocaleString()} bytes of RAM`);
      setWithdrawBytes(""); await fetchRamBalance();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Failed to withdraw RAM"); }
    finally { setLoading(false); closeWharfkitModals(); setTimeout(() => closeWharfkitModals(), 300); }
  }

  if (!isConnected) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="p-1.5 h-auto hover:bg-primary/10 flex items-center gap-1.5">
          <HardDrive className="h-6 w-6 text-primary hover:text-primary/80 transition-colors" />
          <span className="text-xs text-primary font-medium">Manage RAM</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <HardDrive className="h-5 w-5 text-primary" /> Manage Collection RAM
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Mint-on-demand drops require RAM deposited to the nfthivedrops contract.</p>
          <div className="space-y-2">
            <Label>Collection</Label>
            <Select value={selectedCollection} onValueChange={setSelectedCollection}>
              <SelectTrigger><SelectValue placeholder="Select a collection" /></SelectTrigger>
              <SelectContent>{userCollections.map((col: string) => <SelectItem key={col} value={col}>{col}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {selectedCollection && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Deposited RAM</span>
                <Button variant="ghost" size="sm" onClick={fetchRamBalance} disabled={loadingBalance} className="h-6 px-2">
                  <RefreshCw className={`h-3 w-3 ${loadingBalance ? 'animate-spin' : ''}`} />
                </Button>
              </div>
              {loadingBalance ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading...</div>
              ) : ramBalance ? (
                <div className="space-y-1">
                  <p className="text-lg font-bold text-primary">{ramBalance.bytes.toLocaleString()} bytes</p>
                  <p className="text-xs text-muted-foreground">≈ {Math.floor(ramBalance.bytes / 151)} NFTs mintable</p>
                </div>
              ) : <p className="text-sm text-muted-foreground">No RAM deposited</p>}
            </div>
          )}
          <Tabs defaultValue="deposit" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="deposit" className="flex items-center gap-1.5"><Download className="h-3.5 w-3.5" />Deposit</TabsTrigger>
              <TabsTrigger value="withdraw" className="flex items-center gap-1.5"><Upload className="h-3.5 w-3.5" />Withdraw</TabsTrigger>
            </TabsList>
            <TabsContent value="deposit" className="space-y-4 mt-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Amount (WAX)</Label>
                  {waxBalance !== null && <span className="text-xs text-muted-foreground">Balance: <span className="font-medium text-foreground">{waxBalance.toFixed(4)} WAX</span></span>}
                </div>
                <Input type="number" placeholder="e.g. 20" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} min="0" step="0.00000001" />
              </div>
              <Button onClick={handleDeposit} disabled={loading || !selectedCollection || !depositAmount} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Depositing...</> : <><Download className="h-4 w-4 mr-2" />Deposit RAM</>}
              </Button>
            </TabsContent>
            <TabsContent value="withdraw" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Bytes to Withdraw</Label>
                <div className="flex gap-2">
                  <Input type="number" placeholder="e.g. 10000" value={withdrawBytes} onChange={(e) => setWithdrawBytes(e.target.value)} className="flex-1" />
                  <Button type="button" variant="outline" size="sm" onClick={() => setWithdrawBytes(ramBalance?.bytes.toString() || "")} disabled={!ramBalance || ramBalance.bytes === 0} className="px-3">Max</Button>
                </div>
              </div>
              <Button onClick={handleWithdraw} disabled={loading || !selectedCollection || !withdrawBytes || !ramBalance || ramBalance.bytes === 0} variant="outline" className="w-full">
                {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Withdrawing...</> : <><Upload className="h-4 w-4 mr-2" />Withdraw RAM</>}
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
