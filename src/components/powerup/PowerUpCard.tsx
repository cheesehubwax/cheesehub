import { useState, useEffect } from "react";
import { Session } from "@wharfkit/session";
import { Button } from "@/components/ui/button";
import { CheeseInput } from "./CheeseInput";
import { ResourceEstimate } from "./ResourceEstimate";
import { RecipientInput } from "./RecipientInput";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { usePowerupEstimate } from "@/hooks/usePowerupEstimate";
import { useCheesePriceData } from "@/hooks/useCheesePriceData";
import { closeWharfkitModals, getTransactPlugins, parseTransactError } from "@/lib/wharfKit";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { OpenMojiIcon } from '@/components/OpenMojiIcon';
import { TokenLogo } from "@/components/TokenLogo";
import cheeseUpOrb from "@/assets/cheeseup.png";
import waxCoin from "@/assets/wax-coin.png";

interface SuccessDetails {
  cpuMs: number;
  netBytes: number;
  total: number;
  asset: "CHEESE" | "WAX";
  recipient: string;
}

interface PowerUpCardProps {
  walletConnected: boolean;
  onConnectWallet: () => void;
  session: Session | null;
  accountName: string | null;
  cheeseBalance: number;
  onBalanceRefresh?: () => void;
  onStatsRefresh?: () => void;
}

export const PowerUpCard = ({
  walletConnected,
  onConnectWallet,
  session,
  accountName,
  cheeseBalance,
  onBalanceRefresh,
  onStatsRefresh
}: PowerUpCardProps) => {
  const [cpuAmount, setCpuAmount] = useState("0");
  const [netAmount, setNetAmount] = useState("0");
  const [waxCpuAmount, setWaxCpuAmount] = useState("");
  const [waxNetAmount, setWaxNetAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState<"cheese" | "wax">("cheese");
  const [recipient, setRecipient] = useState(accountName || "");
  const [isTransacting, setIsTransacting] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [successDetails, setSuccessDetails] = useState<SuccessDetails | null>(null);

  const formatBytes = (bytes: number) => {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${bytes.toFixed(0)} bytes`;
  };

  const cpuNumeric = parseFloat(cpuAmount) || 0;
  const netNumeric = parseFloat(netAmount) || 0;
  const totalCheese = cpuNumeric + netNumeric;

  const waxCpuNumeric = parseFloat(waxCpuAmount) || 0;
  const waxNetNumeric = parseFloat(waxNetAmount) || 0;
  const totalWax = waxCpuNumeric + waxNetNumeric;

  const isWaxMode = paymentMode === "wax";

  const { data: cheesePriceData } = useCheesePriceData();
  const { estimate, isLoading: isEstimateLoading, error: estimateError, refetch } = usePowerupEstimate(
    isWaxMode ? waxCpuNumeric : cpuNumeric,
    isWaxMode ? waxNetNumeric : netNumeric,
    isWaxMode,
    cheesePriceData ? { priceInWax: cheesePriceData.waxPrice, usdPrice: cheesePriceData.usdPrice } : undefined
  );

  useEffect(() => {
    if (accountName) {
      setRecipient(accountName);
    }
  }, [accountName]);

  const isValidRecipient = (account: string) => {
    if (!account || account.length === 0 || account.length > 12) return false;
    return /^[a-z1-5.]+$/.test(account);
  };

  const handlePowerUp = async () => {
    if (!walletConnected) {
      onConnectWallet();
      return;
    }

    if (!session) {
      toast.error("Wallet session not found");
      return;
    }

    const targetRecipient = recipient || accountName;
    if (!targetRecipient || !isValidRecipient(targetRecipient)) {
      toast.error("Please enter a valid recipient account");
      return;
    }

    if (isWaxMode) {
      if (totalWax <= 0) {
        toast.error("Please enter an amount of WAX for CPU or NET");
        return;
      }
    } else {
      if (totalCheese <= 0) {
        toast.error("Please enter an amount of CHEESE for CPU or NET");
        return;
      }
      if (totalCheese > cheeseBalance) {
        toast.error("Insufficient CHEESE balance");
        return;
      }
    }

    setIsTransacting(true);

    try {
      let action;
      if (isWaxMode) {
        action = {
          account: "eosio",
          name: "powerup",
          authorization: [session.permissionLevel],
          data: {
            payer: String(session.actor),
            receiver: targetRecipient,
            days: 1,
            net_frac: waxNetNumeric > 0 ? Math.floor(waxNetNumeric * 10000) : 0,
            cpu_frac: waxCpuNumeric > 0 ? Math.floor(waxCpuNumeric * 10000) : 0,
            max_payment: `${totalWax.toFixed(8)} WAX`,
          },
        };
      } else {
        let memo: string;
        if (cpuNumeric > 0 && netNumeric > 0) {
          const cpuPercent = Math.round((cpuNumeric / totalCheese) * 100);
          const netPercent = 100 - cpuPercent;
          memo = `cpu:${cpuPercent},net:${netPercent}:${targetRecipient}`;
        } else if (netNumeric > 0) {
          memo = `net:${targetRecipient}`;
        } else {
          memo = targetRecipient;
        }
        action = {
          account: "cheeseburger",
          name: "transfer",
          authorization: [session.permissionLevel],
          data: {
            from: String(session.actor),
            to: "cheesepowerz",
            quantity: `${totalCheese.toFixed(4)} CHEESE`,
            memo,
          },
        };
      }

      const plugins = getTransactPlugins(session);
      console.log('[CHEESEUp] Transacting with plugins:', plugins.length, 'wallet:', session.walletPlugin?.id);

      const result = await session.transact({ actions: [action] }, { transactPlugins: plugins });

      console.log("[CHEESEUp] Transaction result:", result);
      console.log("[CHEESEUp] Resolved tx id:", result.resolved?.transaction.id?.toString());

      const txId = result.resolved?.transaction.id?.toString();
      if (!txId) {
        toast.error("Transaction may not have confirmed", {
          description: "The wallet signed the transaction but it may not have been broadcast. Please check your account on waxblock.io.",
          duration: 10000,
        });
        return;
      }

      setSuccessDetails({
        cpuMs: estimate?.estimatedCpuMs || 0,
        netBytes: estimate?.estimatedNetBytes || 0,
        total: isWaxMode ? totalWax : totalCheese,
        asset: isWaxMode ? "WAX" : "CHEESE",
        recipient: targetRecipient,
      });
      setShowSuccessDialog(true);

      onBalanceRefresh?.();
      onStatsRefresh?.();

      if (isWaxMode) {
        setWaxCpuAmount("");
        setWaxNetAmount("");
      } else {
        setCpuAmount("0");
        setNetAmount("0");
      }
    } catch (error) {
      closeWharfkitModals();
      console.error("[CHEESEUp] Transaction failed:", error);

      const errorInfo = parseTransactError(error);

      if (errorInfo.type === 'cancelled') {
        // Silent - user intentionally cancelled
        console.log('[CHEESEUp] User cancelled transaction');
      } else {
        toast.error(errorInfo.title, {
          description: errorInfo.description,
          duration: errorInfo.duration,
        });
      }
    } finally {
      closeWharfkitModals();
      setTimeout(() => closeWharfkitModals(), 300);
      setIsTransacting(false);
    }
  };

  const validRecipient = isValidRecipient(recipient || accountName || "");
  const canPowerUpCheese = walletConnected && totalCheese > 0 && totalCheese <= cheeseBalance && validRecipient;
  const canPowerUpWax = walletConnected && totalWax > 0 && validRecipient;
  const canPowerUp = isWaxMode ? canPowerUpWax : canPowerUpCheese;

  return (
    <div className="rounded-xl p-6 space-y-6 max-w-lg w-full bg-card border border-border/50">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-foreground">Power Up Resources</h2>
        <p className="text-muted-foreground text-sm">
          Rent CPU and NET using CHEESE or WAX
        </p>
      </div>

      {walletConnected && (
        <RecipientInput
          value={recipient}
          onChange={setRecipient}
          defaultAccount={accountName || ""}
          disabled={isTransacting}
        />
      )}

      <Tabs value={paymentMode} onValueChange={(v) => setPaymentMode(v as "cheese" | "wax")} className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="cheese" className="flex-1 gap-2">
            <OpenMojiIcon emoji="" size={18} />
            CHEESEUp
          </TabsTrigger>
          <TabsTrigger value="wax" className="flex-1 gap-2">
            <OpenMojiIcon emoji="" size={18} />
            WAX PowerUp
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cheese" className="space-y-4 mt-4">
          <CheeseInput
            value={cpuAmount}
            onChange={setCpuAmount}
            balance={walletConnected ? cheeseBalance : 0}
            label="CPU Power"
            icon={<OpenMojiIcon emoji="" size={18} className="text-lg" />}
            accentColor="cpu"
          />

          <CheeseInput
            value={netAmount}
            onChange={setNetAmount}
            balance={walletConnected ? cheeseBalance : 0}
            label="NET Bandwidth"
            icon={<OpenMojiIcon emoji="" size={18} className="text-lg" />}
            accentColor="net"
          />
        </TabsContent>

        <TabsContent value="wax" className="space-y-4 mt-4">
          <CheeseInput
            value={waxCpuAmount}
            onChange={setWaxCpuAmount}
            label="CPU Power"
            icon={<OpenMojiIcon emoji="" size={18} className="text-lg" />}
            accentColor="cpu"
            tokenSymbol="WAX"
            tokenLogo={waxCoin}
            showBalance={false}
          />

          <CheeseInput
            value={waxNetAmount}
            onChange={setWaxNetAmount}
            label="NET Bandwidth"
            icon={<OpenMojiIcon emoji="" size={18} className="text-lg" />}
            accentColor="net"
            tokenSymbol="WAX"
            tokenLogo={waxCoin}
            showBalance={false}
          />
        </TabsContent>
      </Tabs>

      <ResourceEstimate
        estimate={estimate}
        isLoading={isEstimateLoading}
        error={estimateError}
        onRefresh={refetch}
      />

      <Button
        className="w-full h-12 text-base font-semibold"
        onClick={handlePowerUp}
        disabled={(walletConnected && !canPowerUp) || isTransacting}
      >
        {isTransacting ? (
          <>
            <OpenMojiIcon emoji="" size={18} className="animate-spin inline-block" />
            Processing...
          </>
        ) : (
          <>
            <OpenMojiIcon emoji="" size={18} />
            {!walletConnected
              ? "Connect Wallet"
              : canPowerUp
                ? (isWaxMode ? "PowerUp with WAX" : "Power Up Now")
                : "Enter Amount"}
          </>
        )}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Resources are rented for 24 hours • Greymass Fuel sponsorship attempted but not guaranteed
      </p>

      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <img src={cheeseUpOrb} alt="CHEESEUp" className="w-8 h-8 object-contain" />
              CHEESEUp Successful!
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-center py-2">
            <img src={cheeseUpOrb} alt="CHEESEUp" className="w-20 h-20 object-contain" />
          </div>
          <div className="space-y-4">
            <p className="text-muted-foreground">
              PowerUp transaction sent for{" "}
              <span className="text-foreground font-semibold">{successDetails?.recipient}</span>
            </p>
            <div className="space-y-3">
              {successDetails && successDetails.cpuMs > 0 && (
                <div className="flex items-center gap-3 text-foreground bg-amber-500/10 p-3 rounded-lg">
                  <OpenMojiIcon emoji="" size={20} className="text-xl" />
                  <span>~{successDetails.cpuMs.toFixed(2)} ms CPU (estimate)</span>
                </div>
              )}
              {successDetails && successDetails.netBytes > 0 && (
                <div className="flex items-center gap-3 text-foreground bg-orange-400/10 p-3 rounded-lg">
                  <OpenMojiIcon emoji="" size={20} className="text-xl" />
                  <span>~{formatBytes(successDetails.netBytes)} NET (estimate)</span>
                </div>
              )}
            </div>
            <p className="text-muted-foreground text-sm">
              {successDetails?.asset === "CHEESE" && (
                <TokenLogo contract="cheeseburger" symbol="CHEESE" size="sm" className="inline" />
              )}
              {' '}{successDetails?.total.toLocaleString(undefined, { maximumFractionDigits: 8 })} {successDetails?.asset} spent • Resources active for 24 hours
            </p>
            <p className="text-xs text-muted-foreground">
              Actual resources may vary based on network conditions at transaction time.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowSuccessDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
