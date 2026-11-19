import { isValidWaxAccount } from '@/lib/walletResources';
import { useState, useCallback, useMemo, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { WojakUnboxManager } from "./WojakUnboxManager";
import { TransactionSuccessDialog } from "./TransactionSuccessDialog";
import { WalletSidebarNav, type WalletSection } from "./transfer/WalletSidebarNav";
import { TokenBalancesGrid } from "./transfer/TokenBalancesGrid";
import { SendTokensForm } from "./transfer/SendTokensForm";
import { openAlcorBridge } from "@/components/bridge/AlcorBridgeDialog";
import { closeWharfkitModals } from "@/lib/wharfKit";
import cheeseLogo from "@/assets/cheese-logo.png";
import alcorIconUrl from "@/assets/alcor-icon.svg";
import { X } from "lucide-react";
import { toast } from "sonner";

interface WalletTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WalletTransferDialog({ open, onOpenChange }: WalletTransferDialogProps) {
  const { accountName, transferToken } = useWax();
  const { data: waxPrice = 0 } = useWaxPrice();
  const { tokens: balances, isUsingFallback, refetch: refetchBalances } = useAllTokenBalances(accountName || undefined);
  const { data: tokenPrices } = useAlcorTokenPrices();

  // Refetch balances whenever the wallet dialog opens
  useEffect(() => {
    if (open && accountName) {
      refetchBalances();
    }
  }, [open, accountName, refetchBalances]);
  const [activeSection, setActiveSection] = useState<WalletSection>("account");
  const [resources, setResources] = useState<AccountResources | null>(null);
  const [resourcesKey, setResourcesKey] = useState(0);

  // Inline send tokens state
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

  // Token balances for account page, sorted by USD value descending
  const waxBalance = balances.find((b) => b.symbol === "WAX");
  const totalWaxUsd = waxBalance ? waxBalance.balance * waxPrice : 0;

  const sortedBalances = useMemo(() => {
    const getUsdValue = (t: TokenWithBalance) => {
      if (t.symbol === "WAX" && (t.contract === "eosio.token" || !t.contract)) {
        return t.balance * waxPrice;
      }
      const key = `${t.contract}:${t.symbol}`;
      const priceInWax = tokenPrices?.get(key) || 0;
      return t.balance * priceInWax * waxPrice;
    };
    return [...balances]
      .filter((t) => {
        if (t.balance <= 0) return false;
        // Always keep WAX and CHEESE visible regardless of USD value
        if (t.symbol === "WAX" && (t.contract === "eosio.token" || !t.contract)) return true;
        if (t.symbol === "CHEESE" && t.contract === "cheeseburger") return true;
        if (t.symbol === "WAXWETH") return true;
        return getUsdValue(t) > 0.01;
      })
      .sort((a, b) => getUsdValue(b) - getUsdValue(a));
  }, [balances, tokenPrices, waxPrice]);


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
          "Transfer Successful! ",
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

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent
          hideClose
          className="sm:max-w-[1000px] h-[90vh] p-0 gap-0 overflow-hidden bg-card border-border flex flex-col"
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
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={openAlcorBridge}>
                <img src={alcorIconUrl} alt="" aria-hidden="true" className="mr-1.5 h-4 w-4 shrink-0 object-contain" /> Bridge In
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleClose(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex flex-1 min-h-0">
            <WalletSidebarNav activeSection={activeSection} onSelect={setActiveSection} />

            {/* Main Content */}
            <ScrollArea className="flex-1">
              <div className="p-5">
                {/* Persistent header across all tabs (hidden on send-nfts for max space) */}
                {activeSection !== "send-nfts" && (
                  <div className="space-y-6 mb-6">
                    <WalletResources
                      key={resourcesKey}
                      onResourcesUpdate={setResources}
                      showTotalWaxBalance
                      waxUsdPrice={waxPrice}
                    />
                    <AccountDetailsSection resources={resources} />
                  </div>
                )}

                {activeSection === "account" && (
                  <div className="space-y-6">
                    <StakedResourcesSection resources={resources} />

                    <TokenBalancesGrid
                      hasBalances={balances.length > 0}
                      sortedBalances={sortedBalances}
                      portfolioWax={portfolioValue.totalWax}
                      portfolioUsd={portfolioValue.totalUsd}
                      waxPrice={waxPrice}
                      isUsingFallback={isUsingFallback}
                    />
                  </div>
                )}

                {activeSection === "send-tokens" && (
                  <SendTokensForm
                    balances={balances}
                    recipient={recipient}
                    setRecipient={setRecipient}
                    selectedToken={selectedToken}
                    setSelectedToken={setSelectedToken}
                    amount={amount}
                    setAmount={setAmount}
                    memo={memo}
                    setMemo={setMemo}
                    canSend={!!canSend}
                    isSending={isSending}
                    handleSend={handleSend}
                  />
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

                {activeSection === "unbox-wojak" && (
                  <WojakUnboxManager
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
