import { useState, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWax } from "@/context/WaxContext";
import { useWaxPrice } from "@/hooks/useWaxPrice";
import { useAllTokenBalances } from "@/hooks/useAllTokenBalances";
import { WalletResources, AccountDetailsSection, StakedResourcesSection, AccountResources } from "./WalletResources";
import { TokenSendManager } from "./TokenSendManager";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

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

export function WalletTransferDialog({ open, onOpenChange }: WalletTransferDialogProps) {
  const { accountName } = useWax();
  const { waxPrice } = useWaxPrice();
  const { tokens: balances } = useAllTokenBalances(accountName || undefined);
  const [activeSection, setActiveSection] = useState<WalletSection>("account");
  const [resources, setResources] = useState<AccountResources | null>(null);

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
    },
    []
  );

  const handleTransactionComplete = useCallback(() => {
    // Could trigger balance refresh here
  }, []);

  // Token balances summary for Account page
  const waxBalance = balances.find((b) => b.symbol === "WAX");
  const totalWaxUsd = waxBalance ? waxBalance.amount * waxPrice : 0;

  const topItems = SIDEBAR_ITEMS.filter((i) => !i.bottom);
  const bottomItems = SIDEBAR_ITEMS.filter((i) => i.bottom);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[900px] max-h-[85vh] p-0 gap-0 overflow-hidden bg-card border-border">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <img src={cheeseLogo} alt="CHEESE" className="h-5 w-5" />
              <span className="font-bold text-foreground">
                CHEESE<span className="text-primary">Wallet</span>
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex h-[calc(85vh-52px)] min-h-[500px]">
            {/* Sidebar */}
            <div className="w-[180px] shrink-0 border-r border-border flex flex-col">
              <nav className="flex-1 py-2 space-y-0.5">
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
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
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
                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
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
                {activeSection === "account" && (
                  <div className="space-y-6">
                    <WalletResources
                      onResourcesUpdate={setResources}
                      showTotalWaxBalance
                      waxUsdPrice={waxPrice}
                    />
                    <AccountDetailsSection resources={resources} />
                    <StakedResourcesSection resources={resources} />

                    {/* Token Balances */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium">Token Balances</h3>
                        {waxBalance && (
                          <span className="text-sm">
                            <span className="font-medium text-primary">
                              {waxBalance.amount.toFixed(4)} WAX
                            </span>
                            {waxPrice > 0 && (
                              <span className="text-muted-foreground ml-1.5">
                                (${totalWaxUsd.toFixed(2)})
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                      {balances.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2">
                          {balances.map((b) => (
                            <div
                              key={`${b.contract}:${b.symbol}`}
                              className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 text-sm"
                            >
                              <TokenLogo
                                contract={b.contract}
                                symbol={b.symbol}
                                size="sm"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">
                                  {b.symbol}
                                </div>
                                <div className="text-xs text-muted-foreground truncate">
                                  {b.amount.toLocaleString()}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg text-sm text-primary/70">
                          Using backup data source. Some tokens may not appear.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeSection === "send-tokens" && (
                  <TokenSendManager
                    onTransactionSuccess={handleTransactionSuccess}
                  />
                )}

                {activeSection === "send-nfts" && (
                  <NFTSendManager
                    onTransactionSuccess={handleTransactionSuccess}
                  />
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
        onOpenChange={(open) => setTxSuccess((prev) => ({ ...prev, open }))}
        title={txSuccess.title}
        description={txSuccess.description}
        txId={txSuccess.txId}
      />
    </>
  );
}
