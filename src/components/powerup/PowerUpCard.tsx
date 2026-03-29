import { useState, useEffect } from "react";
import { Session } from "@wharfkit/session";
import { Button } from "@/components/ui/button";
import { CheeseInput } from "./CheeseInput";
import { ResourceEstimate } from "./ResourceEstimate";
import { RecipientInput } from "./RecipientInput";
import { toast } from "sonner";
import { usePowerupEstimate } from "@/hooks/usePowerupEstimate";
import { useCheesePriceData } from "@/hooks/useCheesePriceData";
import { closeWharfkitModals, getTransactPlugins } from "@/lib/wharfKit";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { TokenLogo } from "@/components/TokenLogo";
import cheeseUpOrb from "@/assets/cheeseup.png";

interface SuccessDetails {
  cpuMs: number;
  netBytes: number;
  totalCheese: number;
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

  const { data: cheesePriceData } = useCheesePriceData();
  const { estimate, isLoading: isEstimateLoading, error: estimateError, refetch } = usePowerupEstimate(
    cpuNumeric,
    netNumeric,
    false,
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

    if (totalCheese <= 0) {
      toast.error("Please enter an amount of CHEESE for CPU or NET");
      return;
    }

    if (totalCheese > cheeseBalance) {
      toast.error("Insufficient CHEESE balance");
      return;
    }

    const targetRecipient = recipient || accountName;
    if (!targetRecipient || !isValidRecipient(targetRecipient)) {
      toast.error("Please enter a valid recipient account");
      return;
    }

    setIsTransacting(true);

    try {
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

      const action = {
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

      const result = await session.transact({ actions: [action] }, { transactPlugins: getTransactPlugins(session) });

      setSuccessDetails({
        cpuMs: estimate?.estimatedCpuMs || 0,
        netBytes: estimate?.estimatedNetBytes || 0,
        totalCheese,
        recipient: targetRecipient,
      });
      setShowSuccessDialog(true);

      onBalanceRefresh?.();
      onStatsRefresh?.();

      setCpuAmount("0");
      setNetAmount("0");

      console.log("Transaction result:", result);
    } catch (error) {
      closeWharfkitModals();
      console.error("Transaction failed:", error);
      const errorMessage = error instanceof Error ? error.message : "Transaction failed";

      const isCpuError = errorMessage.toLowerCase().includes("cpu") ||
                         errorMessage.toLowerCase().includes("billed") ||
                         errorMessage.toLowerCase().includes("net usage") ||
                         errorMessage.toLowerCase().includes("deadline exceeded");

      if (isCpuError) {
        toast.error("Transaction failed - resource sponsorship unavailable", {
          description: "Greymass Fuel may be temporarily unavailable or at daily limit. Try again in a moment, or ask someone to send you a small amount of CPU first.",
          duration: 10000,
        });
      } else {
        toast.error("PowerUp failed", {
          description: errorMessage,
        });
      }
    } finally {
      closeWharfkitModals();
      setTimeout(() => closeWharfkitModals(), 300);
      setIsTransacting(false);
    }
  };

  const canPowerUp = walletConnected && totalCheese > 0 && totalCheese <= cheeseBalance && isValidRecipient(recipient || accountName || "");

  return (
    <div className="rounded-xl p-6 space-y-6 max-w-lg w-full bg-card border border-border/50">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-foreground">Power Up Resources</h2>
        <p className="text-muted-foreground text-sm">
          Rent CPU and NET using CHEESE tokens
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

      <div className="space-y-4">
        <CheeseInput
          value={cpuAmount}
          onChange={setCpuAmount}
          balance={walletConnected ? cheeseBalance : 0}
          label="CPU Power"
          icon={<span className="text-lg">🖥️</span>}
          accentColor="cpu"
        />

        <CheeseInput
          value={netAmount}
          onChange={setNetAmount}
          balance={walletConnected ? cheeseBalance : 0}
          label="NET Bandwidth"
          icon={<span className="text-lg">📡</span>}
          accentColor="net"
        />
      </div>

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
            <span className="animate-spin inline-block">⏳</span>
            Processing...
          </>
        ) : (
          <>
            <span>⚡</span>
            {!walletConnected ? "Connect Wallet" : canPowerUp ? "Power Up Now" : "Enter Amount"}
          </>
        )}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Resources are rented for 24 hours from the PowerUp pool
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
                  <span className="text-xl">🖥️</span>
                  <span>~{successDetails.cpuMs.toFixed(2)} ms CPU (estimate)</span>
                </div>
              )}
              {successDetails && successDetails.netBytes > 0 && (
                <div className="flex items-center gap-3 text-foreground bg-orange-400/10 p-3 rounded-lg">
                  <span className="text-xl">📡</span>
                  <span>~{formatBytes(successDetails.netBytes)} NET (estimate)</span>
                </div>
              )}
            </div>
            <p className="text-muted-foreground text-sm">
              <TokenLogo contract="cheeseburger" symbol="CHEESE" size="sm" className="inline" />
              {' '}{successDetails?.totalCheese.toLocaleString()} CHEESE spent • Resources active for 24 hours
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
