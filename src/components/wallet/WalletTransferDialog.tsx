import { useState, useCallback, useMemo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWax } from "@/context/WaxContext";
import { useWaxPrice } from "@/hooks/useWaxPrice";
import { useAllTokenBalances, TokenWithBalance } from "@/hooks/useAllTokenBalances";
import { useAlcorTokenPrices } from "@/hooks/useAlcorTokenPrices";
import { WalletResources, AccountDetailsSection, StakedResourcesSection, AccountResources } from "./WalletResources";
import { NFTSendManager } from "./NFTSendManager";
import { StakeManager } from "./StakeManager";
import { RentResourcesManager } from "./RentResourcesManager";
import { RamManager } from "./RamManager";
import { VoteManager } from "./VoteManager";
import { VoteRewardsManager } from "./VoteRewardsManager";
import { CreateAccountManager } from "./CreateAccountManager";
import { AlcorFarmManager } from "./AlcorFarmManager";
import { TransactionSuccessDialog } from "./TransactionSuccessDialog";
import { TokenLogo } from "@/components/TokenLogo";
import { closeWharfkitModals } from "@/lib/wharfKit";
import cheeseLogo from "@/assets/cheese-logo.png";
import {
  Wallet,
  Send,
  Image,
  Landmark,
  Zap,
  HardDrive,
  Vote,
  Gift,
  UserPlus,
  Sprout,
  X,
  Search,
  ExternalLink,
  Loader2,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface WalletTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type WalletSection =
  | "account"
  | "send-tokens"
  | "send-nfts"
  | "stake"
  | "rent"
  | "ram"
  | "governance"
  | "vote-rewards"
  | "create-account"
  | "alcor-farms";

const SIDEBAR_ITEMS: { id: WalletSection; label: string; icon: React.ElementType; bottom?: boolean }[] = [
  { id: "account", label: "Account", icon: Wallet },
  { id: "send-tokens", label: "Send Tokens", icon: Send },
  { id: "send-nfts", label: "Send NFTs", icon: Image },
  { id: "stake", label: "Stake CPU/NET", icon: Landmark },
  { id: "rent", label: "Rent CPU/NET", icon: Zap },
  { id: "ram", label: "Trade RAM", icon: HardDrive },
  { id: "governance", label: "Governance", icon: Vote },
  { id: "vote-rewards", label: "Vote Rewards", icon: Gift },
  { id: "create-account", label: "Create Account", icon: UserPlus },
  { id: "alcor-farms", label: "Manage Alcor Farms", icon: Sprout, bottom: true },
];

function isValidWaxAccount(account: string): boolean {
  if (!account || account.length < 1 || account.length > 12) return false;
  return /^[a-z1-5.]+$/.test(account);
}

export function WalletTransferDialog({ open, onOpenChange }: WalletTransferDialogProps) {
  const { accountName, transferToken } = useWax();
  const { data: waxPrice = 0 } = useWaxPrice();
  const { tokens: balances, isUsingFallback, refetch: refetchBalances } = useAllTokenBalances(accountName || undefined);
  const { data: tokenPrices } = useAlcorTokenPrices();
  const [activeSection, setActiveSection] = useState<WalletSection>("account");
  const [resources, setResources] = useState<AccountResources | null>(null);
  const [resourcesKey, setResourcesKey] = useState(0);

  // Inline send tokens state
  const [tokenSearch, setTokenSearch] = useState("");
  const [selectedToken, setSelectedToken] = useState<TokenWithBalance | null>(null);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Transaction success dialog
  const [txSuccess, setTxSuccess] = useState<{
    open: boolean;
    title: string;
    description: string;
    txId: string | null;
  }>({ open: false, title: "", description: "", txId: null });

  const handleTransactionSuccess = useCallback(
    (title: string, description: string, txId: string | null) => {
      setTxSuccess({ open: true, title, description, txId });
      setResourcesKey((k) => k + 1);
      refetchBalances();
    },
    [refetchBalances]
  );

  const handleTransactionComplete = useCallback(() => {
    setResourcesKey((k) => k + 1);
    refetchBalances();
  }, [refetchBalances]);

  const handleClose = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        closeWharfkitModals();
      }
      onOpenChange(newOpen);
    },
    [onOpenChange]
  );

  // Portfolio value calculation (non-WAX tokens only, valued in WAX)
  const portfolioValue = useMemo(() => {
    let totalWax = 0;
    balances.forEach((b) => {
      if (b.symbol === "WAX" && (b.contract === "eosio.token" || !b.contract)) {
        return; // Skip WAX itself
      }
      if (tokenPrices) {
        const key = `${b.contract}:${b.symbol}`;
        const priceInWax = tokenPrices.get(key);
        if (priceInWax) totalWax += b.balance * priceInWax;
      }
    });
    return { totalWax, totalUsd: totalWax * waxPrice };
  }, [balances, tokenPrices, waxPrice]);

  // Token balances for account page
  const waxBalance = balances.find((b) => b.symbol === "WAX");
  const totalWaxUsd = waxBalance ? waxBalance.balance * waxPrice : 0;

  // Send tokens: filtered token list
  const filteredTokens = useMemo(() => {
    if (!tokenSearch) return balances;
    const q = tokenSearch.toLowerCase();
    return balances.filter(
      (b) =>
        b.symbol.toLowerCase().includes(q) ||
        b.contract.toLowerCase().includes(q)
    );
  }, [balances, tokenSearch]);

  const isValidRecipient = recipient.length > 0 && isValidWaxAccount(recipient);
  const canSend =
    isValidRecipient &&
    parseFloat(amount) > 0 &&
    selectedToken &&
    parseFloat(amount) <= selectedToken.balance &&
    !isSending;

  const handleSend = async () => {
    if (!canSend || !selectedToken) return;
    setIsSending(true);
    try {
      const txId = await transferToken(
        selectedToken.contract,
        selectedToken.symbol,
        selectedToken.precision,
        recipient,
        parseFloat(amount),
        memo
      );
      if (txId) {
        handleTransactionSuccess(
          "Transfer Successful! 🧀",
          `Sent ${amount} ${selectedToken.symbol} to ${recipient}`,
          txId
        );
        setAmount("");
        setRecipient("");
        setMemo("");
        setSelectedToken(null);
      }
    } catch (error: any) {
      closeWharfkitModals();
      const msg = error?.message || "Transfer failed";
      if (!msg.toLowerCase().includes("cancel")) {
        toast.error(msg);
      }
    } finally {
      setIsSending(false);
      setTimeout(() => closeWharfkitModals(), 100);
    }
  };

  const topItems = SIDEBAR_ITEMS.filter((i) => !i.bottom);
  const bottomItems = SIDEBAR_ITEMS.filter((i) => i.bottom);

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent
          hideClose
          className="sm:max-w-[1050px] max-h-[min(85vh,700px)] p-0 gap-0 overflow-hidden bg-card border-border"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <img src={cheeseLogo} alt="CHEESE" className="h-5 w-5" />
              <span className="font-bold text-foreground">
                CHEESE<span className="text-primary">Wallet</span>
              </span>
              {accountName && (
                <span className="text-xs text-muted-foreground ml-2">
                  {accountName}
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => handleClose(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex h-[calc(85vh-52px)] min-h-[500px]">
            {/* Sidebar */}
            <div className="w-[180px] shrink-0 border-r border-border flex flex-col">
              <nav className="flex-1 py-2 space-y-1.5">
                {topItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveSection(item.id)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors text-left",
                        isActive
                          ? "bg-primary/20 text-primary border-r-2 border-primary font-medium"
                          : "text-foreground hover:bg-muted/50"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </nav>
              {bottomItems.length > 0 && (
                <div className="border-t border-border py-2">
                  {bottomItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeSection === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveSection(item.id)}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors text-left",
                          isActive
                            ? "bg-primary/20 text-primary border-r-2 border-primary font-medium"
                            : "text-foreground hover:bg-muted/50"
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Main Content */}
            <ScrollArea className="flex-1">
              <div className="p-5">
                {/* Persistent header across all tabs */}
                <div className="space-y-6 mb-6">
                  <WalletResources
                    key={resourcesKey}
                    onResourcesUpdate={setResources}
                    showTotalWaxBalance
                    waxUsdPrice={waxPrice}
                  />
                  <AccountDetailsSection resources={resources} />
                </div>

                {activeSection === "account" && (
                  <div className="space-y-6">
                    <StakedResourcesSection resources={resources} />

                    {/* Token Balances */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium">Token Balances</h3>
                        {portfolioValue.totalWax > 0 && (
                          <span className="text-sm">
                            <span className="font-medium text-primary">
                              {portfolioValue.totalWax.toLocaleString(undefined, { maximumFractionDigits: 4 })} WAX
                            </span>
                            {waxPrice > 0 && (
                              <span className="text-muted-foreground ml-1.5">
                                (${portfolioValue.totalUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })})
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                      {isUsingFallback && (
                        <div className="p-2 bg-primary/5 border border-primary/20 rounded-lg text-xs text-primary/70">
                          Using backup data source. Some tokens may not appear.
                        </div>
                      )}
                      {balances.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2">
                          {balances.map((b) => (
                            <a
                              key={`${b.contract}:${b.symbol}`}
                              href={`https://waxblock.io/account/${b.contract}?action=tables&table=accounts&scope=${accountName}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 text-sm hover:bg-muted/50 transition-colors group"
                            >
                              <TokenLogo contract={b.contract} symbol={b.symbol} size="sm" />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate flex items-center gap-1">
                                  {b.symbol}
                                  <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                                <div className="text-xs text-muted-foreground truncate">
                                  {b.balance.toLocaleString()}
                                </div>
                              </div>
                            </a>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No token balances found.</p>
                      )}
                    </div>
                  </div>
                )}

                {activeSection === "send-tokens" && (
                  <div className="space-y-5">
                    {/* Recipient */}
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Recipient</Label>
                      <Input
                        placeholder="Enter WAX account"
                        value={recipient}
                        onChange={(e) => setRecipient(e.target.value.toLowerCase())}
                      />
                    </div>

                    {/* Token Select */}
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Token</Label>
                      <Select
                        value={selectedToken ? `${selectedToken.contract}:${selectedToken.symbol}` : ""}
                        onValueChange={(val) => {
                          const token = balances.find(b => `${b.contract}:${b.symbol}` === val);
                          if (token) setSelectedToken(token);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a token">
                            {selectedToken && (
                              <span className="flex items-center gap-2">
                                <TokenLogo contract={selectedToken.contract} symbol={selectedToken.symbol} size="sm" />
                                <span className="font-medium">{selectedToken.symbol}</span>
                                <span className="text-muted-foreground">({selectedToken.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: selectedToken.precision })})</span>
                              </span>
                            )}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {balances.map((b) => (
                            <SelectItem key={`${b.contract}:${b.symbol}`} value={`${b.contract}:${b.symbol}`}>
                              <span className="flex items-center gap-2">
                                <TokenLogo contract={b.contract} symbol={b.symbol} size="sm" />
                                <span className="font-medium">{b.symbol}</span>
                                <span className="text-muted-foreground ml-1">({b.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: b.precision })})</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Amount */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold">Amount</Label>
                        {selectedToken && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            Balance: <TokenLogo contract={selectedToken.contract} symbol={selectedToken.symbol} size="sm" />
                            <span>{selectedToken.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: selectedToken.precision })} {selectedToken.symbol}</span>
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          min={0}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            if (selectedToken) {
                              setAmount(selectedToken.balance.toFixed(selectedToken.precision));
                            }
                          }}
                          disabled={!selectedToken}
                          className="shrink-0 font-semibold"
                        >
                          Max
                        </Button>
                      </div>
                    </div>

                    {/* Memo */}
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Memo (optional)</Label>
                      <Input
                        placeholder="Enter memo"
                        value={memo}
                        onChange={(e) => setMemo(e.target.value)}
                      />
                    </div>

                    <Button
                      onClick={handleSend}
                      disabled={!canSend}
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      {isSending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" />
                          Send {selectedToken?.symbol || "Tokens"}
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {activeSection === "send-nfts" && (
                  <NFTSendManager onTransactionSuccess={handleTransactionSuccess} />
                )}

                {activeSection === "stake" && (
                  <StakeManager
                    resources={resources}
                    onTransactionComplete={handleTransactionComplete}
                    onTransactionSuccess={handleTransactionSuccess}
                  />
                )}

                {activeSection === "rent" && (
                  <RentResourcesManager
                    onTransactionComplete={handleTransactionComplete}
                    onTransactionSuccess={handleTransactionSuccess}
                  />
                )}

                {activeSection === "ram" && (
                  <RamManager
                    resources={resources}
                    onTransactionComplete={handleTransactionComplete}
                    onTransactionSuccess={handleTransactionSuccess}
                  />
                )}

                {activeSection === "governance" && (
                  <VoteManager
                    onTransactionComplete={handleTransactionComplete}
                    onTransactionSuccess={handleTransactionSuccess}
                  />
                )}

                {activeSection === "vote-rewards" && (
                  <VoteRewardsManager
                    onTransactionComplete={handleTransactionComplete}
                    onTransactionSuccess={handleTransactionSuccess}
                  />
                )}

                {activeSection === "create-account" && (
                  <CreateAccountManager
                    onTransactionComplete={handleTransactionComplete}
                    onTransactionSuccess={handleTransactionSuccess}
                  />
                )}

                {activeSection === "alcor-farms" && (
                  <AlcorFarmManager
                    onTransactionComplete={handleTransactionComplete}
                    onTransactionSuccess={handleTransactionSuccess}
                  />
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      <TransactionSuccessDialog
        open={txSuccess.open}
        onOpenChange={(o) => setTxSuccess((prev) => ({ ...prev, open: o }))}
        title={txSuccess.title}
        description={txSuccess.description}
        txId={txSuccess.txId}
      />
    </>
  );
}
