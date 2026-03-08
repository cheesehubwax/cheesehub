import { useState, useEffect } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { RefreshCw, Loader2, Coins, Info, AlertCircle, CheckCircle2 } from "lucide-react";
import { useCheeseFeePricing } from "@/hooks/useCheeseFeePricing";
import { useWaxdaoFeePricing } from "@/hooks/useWaxdaoFeePricing";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { useWax } from "@/context/WaxContext";
import {
  CHEESE_FEE_ENABLED,
  PaymentMethod,
  WAX_FEE_AMOUNT,
  fetchContractWaxdaoBalance,
} from "@/lib/cheeseFees";
import cheeseLogo from "@/assets/cheese-logo.png";
import { CheeseSwapDialog } from "@/components/swap/CheeseSwapDialog";

const WAX_TOKEN = { symbol: "WAX", contract: "eosio.token", precision: 8, displayName: "WAX" };

interface FeePaymentSelectorProps {
  waxFee?: number;
  selectedMethod: PaymentMethod | null;
  onMethodChange: (method: PaymentMethod) => void;
  onCheeseAmountChange: (amount: string) => void;
  onWaxdaoAmountChange?: (amount: string) => void;
  disabled?: boolean;
  hideCheeseOption?: boolean;
}

export function FeePaymentSelector({
  waxFee = WAX_FEE_AMOUNT,
  selectedMethod,
  onMethodChange,
  onCheeseAmountChange,
  onWaxdaoAmountChange,
  disabled = false,
  hideCheeseOption = false,
}: FeePaymentSelectorProps) {
  const { session } = useWax();
  const accountName = session ? String(session.actor) : null;

  const cheesePricing = useCheeseFeePricing(waxFee);
  const waxdaoPricing = useWaxdaoFeePricing();
  const { balance: waxBalance, isLoading: waxBalanceLoading } = useTokenBalance(accountName, WAX_TOKEN);

  const [poolBalance, setPoolBalance] = useState<number | null>(null);
  const [isCheckingPool, setIsCheckingPool] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [showWaxFallback, setShowWaxFallback] = useState(false);

  const hasEnoughWax = waxBalance >= waxFee;

  useEffect(() => {
    if (cheesePricing.isAvailable && selectedMethod === "cheese") {
      onCheeseAmountChange(cheesePricing.formattedForTx);
    }
  }, [cheesePricing.formattedForTx, cheesePricing.isAvailable, selectedMethod, onCheeseAmountChange]);

  useEffect(() => {
    if (waxdaoPricing.isAvailable && onWaxdaoAmountChange && selectedMethod === "cheese") {
      onWaxdaoAmountChange(waxdaoPricing.formattedForTx);
    }
  }, [waxdaoPricing.formattedForTx, waxdaoPricing.isAvailable, selectedMethod, onWaxdaoAmountChange]);

  useEffect(() => {
    if (CHEESE_FEE_ENABLED && selectedMethod === "cheese") {
      cheesePricing.refetch();
      waxdaoPricing.refetch();
      checkPoolBalance();
    }
  }, [selectedMethod]);

  async function checkPoolBalance() {
    setIsCheckingPool(true);
    try {
      const balance = await fetchContractWaxdaoBalance();
      setPoolBalance(balance);
    } catch (error) {
      console.error("Failed to check pool balance:", error);
      setPoolBalance(null);
    } finally {
      setIsCheckingPool(false);
    }
  }

  const poolHasEnoughWaxdao = poolBalance !== null && waxdaoPricing.isAvailable && poolBalance >= waxdaoPricing.waxdaoAmount;

  useEffect(() => {
    if (poolBalance !== null && !isCheckingPool && waxdaoPricing.isAvailable && !poolHasEnoughWaxdao) {
      setShowWaxFallback(true);
    }
  }, [poolBalance, isCheckingPool, waxdaoPricing.isAvailable, poolHasEnoughWaxdao]);

  const isCheeseSelectable = CHEESE_FEE_ENABLED && cheesePricing.isAvailable;
  const showCheeseGlow = !hideCheeseOption && isCheeseSelectable && selectedMethod !== "cheese";

  return (
    <TooltipProvider>
      <div className="p-4 rounded-lg border border-cheese/30 bg-cheese/5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-cheese" />
            <h3 className="text-sm font-medium text-foreground">
              Creation Fee
            </h3>
            <span className="text-cheese/50">|</span>
            <button
              type="button"
              onClick={() => setSwapOpen(true)}
              className="text-sm text-cheese hover:text-cheese/80 hover:underline font-medium"
            >
              Buy CHEESE
            </button>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <Info className="h-4 w-4 text-muted-foreground" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>Pay with CHEESE and save 20% on creation fees!</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <RadioGroup
          value={selectedMethod ?? ""}
          onValueChange={(v) => onMethodChange(v as PaymentMethod)}
          className="space-y-3"
          disabled={disabled}
        >
          {!hideCheeseOption && (
            <div
              className={`relative flex items-start space-x-3 p-3 rounded-lg border transition-all cursor-pointer ${
                selectedMethod === "cheese"
                  ? "border-cheese/50 bg-cheese/10"
                  : showCheeseGlow
                  ? "border-cheese/40 bg-cheese/5 shadow-[0_0_12px_rgba(255,200,50,0.25)] hover:shadow-[0_0_16px_rgba(255,200,50,0.35)]"
                  : "border-border/50 hover:bg-muted/30"
              } ${!CHEESE_FEE_ENABLED ? "opacity-50 pointer-events-none" : ""}`}
            >
              <RadioGroupItem
                value="cheese"
                id="payment-cheese"
                disabled={!CHEESE_FEE_ENABLED || disabled}
                className="mt-1"
              />
              <Label htmlFor="payment-cheese" className={`flex-1 ${CHEESE_FEE_ENABLED ? "cursor-pointer" : "cursor-not-allowed"}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img src={cheeseLogo} alt="CHEESE" className="w-5 h-5" />
                    <span className="font-medium">Pay with CHEESE</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="bg-cheese/10 text-cheese border-cheese/30 text-xs">
                      Standard
                    </Badge>
                    <Badge className="bg-green-500/20 text-green-500 border-green-500/30 text-xs">
                      Save 20%
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-1">
                  {selectedMethod === "cheese" ? (
                    cheesePricing.isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      <span className="text-sm text-muted-foreground">{cheesePricing.displayAmount}</span>
                    )
                  ) : (
                    <span className="text-sm text-muted-foreground/70 italic">Select to see price</span>
                  )}
                </div>

                {selectedMethod === "cheese" && (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center gap-2 text-xs">
                      {isCheckingPool || waxdaoPricing.isLoading ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span className="text-muted-foreground">Checking pool...</span>
                        </>
                      ) : poolBalance !== null && waxdaoPricing.isAvailable ? (
                        poolHasEnoughWaxdao ? (
                          <>
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                            <span className="text-green-600">Contract ready</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-3 w-3 text-amber-500" />
                            <span className="text-amber-600">Pool low - WAX payment available below</span>
                          </>
                        )
                      ) : null}
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-cheese hover:text-cheese/80"
                      onClick={(e) => {
                        e.stopPropagation();
                        cheesePricing.refetch();
                        waxdaoPricing.refetch();
                        checkPoolBalance();
                      }}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Refresh price
                    </Button>
                  </div>
                )}
              </Label>
            </div>
          )}

          {showWaxFallback && (
            <div
              className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                selectedMethod === "wax"
                  ? "border-amber-500/50 bg-amber-500/10"
                  : "border-border/50 hover:bg-muted/30"
              }`}
            >
              <RadioGroupItem value="wax" id="payment-wax" disabled={disabled} className="mt-1" />
              <Label htmlFor="payment-wax" className="flex-1 cursor-pointer">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{waxFee} WAX</span>
                  <Badge variant="outline" className="text-xs text-amber-600 border-amber-500/30">
                    Fallback option
                  </Badge>
                </div>
                {selectedMethod === "wax" && (
                  <div className="flex items-center gap-2 text-xs mt-2">
                    {waxBalanceLoading ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span className="text-muted-foreground">Checking balance...</span>
                      </>
                    ) : hasEnoughWax ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        <span className="text-green-600">Balance: {waxBalance.toFixed(2)} WAX</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-3 w-3 text-destructive" />
                        <span className="text-destructive">Insufficient funds ({waxBalance.toFixed(2)} WAX)</span>
                      </>
                    )}
                  </div>
                )}
              </Label>
            </div>
          )}
        </RadioGroup>
      </div>

      <CheeseSwapDialog
        open={swapOpen}
        onOpenChange={setSwapOpen}
        inputToken="WAX"
      />
    </TooltipProvider>
  );
}
