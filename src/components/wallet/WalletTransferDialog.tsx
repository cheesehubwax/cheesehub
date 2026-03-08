import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Cpu, HardDrive, Vote, Image } from "lucide-react";
import { useWax } from "@/context/WaxContext";
import { useWaxTransaction } from "@/hooks/useWaxTransaction";
import { useAllTokenBalances } from "@/hooks/useAllTokenBalances";
import { useUserNFTs } from "@/hooks/useUserNFTs";
import { useToast } from "@/hooks/use-toast";
import cheeseLogo from "@/assets/cheese-logo.png";

interface WalletTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WalletTransferDialog({ open, onOpenChange }: WalletTransferDialogProps) {
  const { accountName, isConnected, session, cheeseBalance, transferToken, transferNFTs } = useWax();
  const { transact, loading: txLoading } = useWaxTransaction();
  const { balances } = useAllTokenBalances(accountName || undefined);
  const { nfts } = useUserNFTs(accountName || undefined);
  const { toast } = useToast();

  // Transfer state
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedToken, setSelectedToken] = useState("CHEESE");
  const [memo, setMemo] = useState("");

  // Resource state
  const [stakeAmount, setStakeAmount] = useState("");
  const [resourceType, setResourceType] = useState<"cpu" | "net">("cpu");
  const [ramAmount, setRamAmount] = useState("");

  // NFT state
  const [selectedNFTs, setSelectedNFTs] = useState<string[]>([]);
  const [nftRecipient, setNftRecipient] = useState("");

  // Vote state
  const [proxyAccount, setProxyAccount] = useState("");

  const selectedBalance = balances.find(b => b.symbol === selectedToken);

  const handleTransfer = async () => {
    if (!recipient || !amount || !selectedBalance) return;
    const result = await transferToken(
      selectedBalance.contract,
      selectedBalance.symbol,
      selectedBalance.precision,
      recipient,
      parseFloat(amount),
      memo
    );
    if (result) {
      toast({ title: "Transfer Successful! 🧀", description: `Sent ${amount} ${selectedToken} to ${recipient}` });
      setAmount("");
      setRecipient("");
      setMemo("");
    }
  };

  const handleStake = async () => {
    if (!accountName || !stakeAmount) return;
    const formatted = `${parseFloat(stakeAmount).toFixed(8)} WAX`;
    const action = {
      account: "eosio",
      name: "delegatebw",
      authorization: [{ actor: accountName, permission: "active" }],
      data: {
        from: accountName,
        receiver: accountName,
        stake_net_quantity: resourceType === "net" ? formatted : "0.00000000 WAX",
        stake_cpu_quantity: resourceType === "cpu" ? formatted : "0.00000000 WAX",
        transfer: false,
      },
    };
    const result = await transact(action);
    if (result.success) {
      toast({ title: "Staked!", description: `Staked ${stakeAmount} WAX for ${resourceType.toUpperCase()}` });
      setStakeAmount("");
    }
  };

  const handleBuyRam = async () => {
    if (!accountName || !ramAmount) return;
    const action = {
      account: "eosio",
      name: "buyram",
      authorization: [{ actor: accountName, permission: "active" }],
      data: {
        payer: accountName,
        receiver: accountName,
        quant: `${parseFloat(ramAmount).toFixed(8)} WAX`,
      },
    };
    const result = await transact(action);
    if (result.success) {
      toast({ title: "RAM Purchased!", description: `Bought RAM with ${ramAmount} WAX` });
      setRamAmount("");
    }
  };

  const handleSendNFTs = async () => {
    if (!nftRecipient || selectedNFTs.length === 0) return;
    const result = await transferNFTs(nftRecipient, selectedNFTs, "CHEESEHub transfer");
    if (result) {
      toast({ title: "NFTs Sent!", description: `Sent ${selectedNFTs.length} NFTs to ${nftRecipient}` });
      setSelectedNFTs([]);
      setNftRecipient("");
    }
  };

  const handleVoteProxy = async () => {
    if (!accountName || !proxyAccount) return;
    const action = {
      account: "eosio",
      name: "voteproducer",
      authorization: [{ actor: accountName, permission: "active" }],
      data: {
        voter: accountName,
        proxy: proxyAccount,
        producers: [],
      },
    };
    const result = await transact(action);
    if (result.success) {
      toast({ title: "Vote Proxy Set!", description: `Voting through ${proxyAccount}` });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <img src={cheeseLogo} alt="CHEESE" className="h-5 w-5" />
            CHEESEWallet
          </DialogTitle>
          <DialogDescription>
            {accountName ? `${accountName} • ${cheeseBalance.toLocaleString()} CHEESE` : "Connect wallet to continue"}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="transfer" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="transfer"><Send className="h-3 w-3 mr-1" /> Send</TabsTrigger>
            <TabsTrigger value="resources"><Cpu className="h-3 w-3 mr-1" /> Resources</TabsTrigger>
            <TabsTrigger value="nfts"><Image className="h-3 w-3 mr-1" /> NFTs</TabsTrigger>
            <TabsTrigger value="vote"><Vote className="h-3 w-3 mr-1" /> Vote</TabsTrigger>
          </TabsList>

          {/* Send Tokens Tab */}
          <TabsContent value="transfer" className="space-y-4 mt-4">
            <div>
              <Label>Token</Label>
              <Select value={selectedToken} onValueChange={setSelectedToken}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {balances.map(b => (
                    <SelectItem key={`${b.contract}:${b.symbol}`} value={b.symbol}>
                      {b.symbol} ({b.amount.toLocaleString()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Recipient</Label>
              <Input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="waxaccount" />
            </div>
            <div>
              <Label>Amount</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.0000" />
            </div>
            <div>
              <Label>Memo (optional)</Label>
              <Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="memo" />
            </div>
            <Button onClick={handleTransfer} disabled={txLoading || !recipient || !amount} className="w-full bg-primary text-primary-foreground">
              {txLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Send {selectedToken}
            </Button>
          </TabsContent>

          {/* Resources Tab */}
          <TabsContent value="resources" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2"><Cpu className="h-4 w-4" /> Stake CPU/NET</h4>
                <Select value={resourceType} onValueChange={(v) => setResourceType(v as "cpu" | "net")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cpu">CPU</SelectItem>
                    <SelectItem value="net">NET</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="number" value={stakeAmount} onChange={(e) => setStakeAmount(e.target.value)} placeholder="WAX amount" />
                <Button onClick={handleStake} disabled={txLoading || !stakeAmount} className="w-full" variant="outline">
                  Stake WAX
                </Button>
              </div>
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2"><HardDrive className="h-4 w-4" /> Buy RAM</h4>
                <Input type="number" value={ramAmount} onChange={(e) => setRamAmount(e.target.value)} placeholder="WAX amount" />
                <Button onClick={handleBuyRam} disabled={txLoading || !ramAmount} className="w-full" variant="outline">
                  Buy RAM
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* NFTs Tab */}
          <TabsContent value="nfts" className="space-y-4 mt-4">
            <div>
              <Label>Recipient</Label>
              <Input value={nftRecipient} onChange={(e) => setNftRecipient(e.target.value)} placeholder="waxaccount" />
            </div>
            <div>
              <Label>Select NFTs ({selectedNFTs.length} selected)</Label>
              <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto mt-2">
                {nfts.slice(0, 40).map(nft => (
                  <div
                    key={nft.assetId}
                    className={`relative rounded-lg border p-1 cursor-pointer transition-all ${
                      selectedNFTs.includes(nft.assetId) ? "border-primary bg-primary/10" : "border-border/50 hover:border-primary/30"
                    }`}
                    onClick={() => setSelectedNFTs(prev =>
                      prev.includes(nft.assetId) ? prev.filter(id => id !== nft.assetId) : [...prev, nft.assetId]
                    )}
                  >
                    <img src={nft.image} alt={nft.name} className="w-full aspect-square object-cover rounded" />
                    <p className="text-[9px] text-center truncate mt-0.5">{nft.name}</p>
                  </div>
                ))}
                {nfts.length === 0 && <p className="col-span-4 text-center text-muted-foreground py-4 text-sm">No NFTs found</p>}
              </div>
            </div>
            <Button onClick={handleSendNFTs} disabled={txLoading || selectedNFTs.length === 0 || !nftRecipient} className="w-full bg-primary text-primary-foreground">
              Send {selectedNFTs.length} NFT(s)
            </Button>
          </TabsContent>

          {/* Vote Tab */}
          <TabsContent value="vote" className="space-y-4 mt-4">
            <div>
              <Label>Vote Proxy</Label>
              <Input value={proxyAccount} onChange={(e) => setProxyAccount(e.target.value)} placeholder="proxy account" />
              <p className="text-xs text-muted-foreground mt-1">Delegate your vote to a proxy account</p>
            </div>
            <Button onClick={handleVoteProxy} disabled={txLoading || !proxyAccount} className="w-full" variant="outline">
              Set Vote Proxy
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
