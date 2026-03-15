import { useState, useCallback, useEffect } from "react";
import { ArrowDownUp, Settings, ChevronDown, Loader2, AlertCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SwapTokenInput } from "./SwapTokenInput";
import { TokenSelector } from "./TokenSelector";
import { useSwapTokens } from "@/hooks/useSwapTokens";
import { useSwapRoute, type TradeType } from "@/hooks/useSwapRoute";
import { useSwapTokenBalance } from "@/hooks/useSwapTokenBalance";
import { useWax } from "@/context/WaxContext";
import { type SwapToken, formatTokenAmount, normalizeRouteActions, PREFERRED_CONTRACTS } from "@/lib/swapApi";
import { getTransactPlugins } from "@/lib/wharfKit";
import { toast } from "sonner";

interface CheeseSwapWidgetProps {
  defaultInputTicker?: string;
  defaultOutputTicker?: string;
}

const SLIPPAGE_PRESETS = [0.5, 1, 3];

export function CheeseSwapWidget({
  defaultInputTicker = "WAX",
  defaultOutputTicker = "CHEESE",
}: CheeseSwapWidgetProps) {
  const { tokens } = useSwapTokens();
  const { session, accountName, login } = useWax();
  const queryClient = useQueryClient();

  const [tokenIn, setTokenIn] = useState<SwapToken | null>(null);
  const [tokenOut, setTokenOut] = useState<SwapToken | null>(null);
  const [amountIn, setAmountIn] = useState("");
  const [amountOut, setAmountOut] = useState("");
  const [activeField, setActiveField] = useState<"in" | "out">("in");
  const [slippage, setSlippage] = useState(() => {
    const saved = localStorage.getItem("cheese-swap-slippage");
    return saved ? parseFloat(saved) : 1;
  });
  const [customSlippage, setCustomSlippage] = useState("");
  const [selectorSide, setSelectorSide] = useState<"in" | "out" | null>(null);
  const [showRouteDetails, setShowRouteDetails] = useState(true);
  const [isSwapping, setIsSwapping] = useState(false);

  // Set defaults when tokens load
  useEffect(() => {
    if (tokens.length > 0 && !tokenIn) {
      const findToken = (ticker: string) => {
        const preferred = PREFERRED_CONTRACTS[ticker];
        if (preferred) {
          const exact = tokens.find((t) => t.ticker === ticker && t.contract === preferred);
          if (exact) return exact;
        }
        return tokens.find((t) => t.ticker === ticker);
      };
      const defaultIn = findToken(defaultInputTicker);
      const defaultOut = findToken(defaultOutputTicker);
      if (defaultIn) setTokenIn(defaultIn);
      if (defaultOut) setTokenOut(defaultOut);
    }
  }, [tokens, defaultInputTicker, defaultOutputTicker, tokenIn]);

  // Persist slippage
  useEffect(() => {
    localStorage.setItem("cheese-swap-slippage", slippage.toString());
  }, [slippage]);

  const balanceIn = useSwapTokenBalance(accountName, tokenIn?.contract, tokenIn?.ticker);
  const balanceOut = useSwapTokenBalance(accountName, tokenOut?.contract, tokenOut?.ticker);

  const tradeType: TradeType = activeField === "in" ? "EXACT_INPUT" : "EXACT_OUTPUT";
  const routeAmount = activeField === "in" ? amountIn : amountOut;

  const { route, isFetching: routeLoading, error: routeError, noRoute } = useSwapRoute(
    tokenIn,
    tokenOut,
    routeAmount,
    slippage,
    accountName || "placeholder111",
    tradeType
  );

  // Derive the non-active field from route
  const displayAmountIn = activeField === "in"
    ? amountIn
    : (route?.input ? formatTokenAmount(route.input, tokenIn?.precision ?? 8) : "");
  const displayAmountOut = activeField === "out"
    ? amountOut
    : (route?.output ? formatTokenAmount(route.output, tokenOut?.precision ?? 8) : "");

  const handleAmountInChange = (val: string) => {
    setAmountIn(val);
    setActiveField("in");
    if (!val || parseFloat(val) <= 0) setAmountOut("");
  };

  const handleAmountOutChange = (val: string) => {
    setAmountOut(val);
    setActiveField("out");
    if (!val || parseFloat(val) <= 0) setAmountIn("");
  };

  const handleFlip = useCallback(() => {
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
    setAmountIn("");
    setAmountOut("");
    setActiveField("in");
  }, [tokenIn, tokenOut]);

  const handleSlippageChange = (val: number) => {
    setSlippage(val);
    setCustomSlippage("");
  };

  const handleCustomSlippage = (val: string) => {
    setCustomSlippage(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0 && num <= 50) {
      setSlippage(num);
    }
  };

  // For swap action, we always need the input amount
  const swapAmountIn = activeField === "in"
    ? amountIn
    : (route?.input ? formatTokenAmount(route.input, tokenIn?.precision ?? 8) : "");

  const handleSwap = async () => {
    if (!route || !session || !accountName || !tokenIn) return;
    setIsSwapping(true);
    try {
      const actions = normalizeRouteActions(route, accountName, tokenIn.contract, swapAmountIn, tokenIn);
      await session.transact({ actions }, { transactPlugins: getTransactPlugins(session) });
      toast.success("Swap successful!", {
        description: `Swapped ${swapAmountIn} ${tokenIn?.ticker} → ${displayAmountOut} ${tokenOut?.ticker}`,
      });
      setAmountIn("");
      setAmountOut("");
      setActiveField("in");
      // Refresh balances after swap
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["swap-token-balance"] });
        queryClient.invalidateQueries({ queryKey: ["swap-token-balances"] });
      }, 1500);
    } catch (e: any) {
      const msg = e?.message || "Swap failed";
      if (!msg.includes("cancel") && !msg.includes("reject")) {
        toast.error("Swap failed", { description: msg });
      }
    } finally {
      setIsSwapping(false);
    }
  };

  const hasAmount = parseFloat(routeAmount) > 0;
  const canSwap = !!route && !!route.memo && !!accountName && hasAmount && !routeLoading;

  const handleTokenSelect = useCallback((token: SwapToken) => {
    if (selectorSide === "in") setTokenIn(token);
    else if (selectorSide === "out") setTokenOut(token);
  }, [selectorSide]);

  const isLoading = routeLoading && hasAmount;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <h3 className="text-base font-bold text-foreground">Swap</h3>
        <Popover>
          <PopoverTrigger asChild>
            <button className="p-2 rounded-lg hover:bg-secondary/80 transition-colors text-muted-foreground hover:text-foreground">
              <Settings className="w-4 h-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 bg-background border-border" align="end">
            <p className="text-xs text-muted-foreground mb-2 font-medium">Slippage Tolerance</p>
            <div className="flex gap-1.5">
              {SLIPPAGE_PRESETS.map((val) => (
                <button
                  key={val}
                  onClick={() => handleSlippageChange(val)}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    slippage === val && !customSlippage
                      ? "bg-cheese text-cheese-foreground"
                      : "bg-secondary hover:bg-secondary/80 text-muted-foreground"
                  }`}
                >
                  {val}%
                </button>
              ))}
              <input
                type="number"
                placeholder="Custom"
                value={customSlippage}
                onChange={(e) => handleCustomSlippage(e.target.value)}
                className="flex-1 bg-secondary rounded-lg text-center text-sm text-foreground placeholder:text-muted-foreground border-none outline-none focus:ring-1 focus:ring-cheese px-2"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">Current: {slippage}%</p>
          </PopoverContent>
        </Popover>
      </div>

      {/* Swap panels */}
      <div className="space-y-1 relative">
        <SwapTokenInput
          label="You pay"
          token={tokenIn}
          amount={displayAmountIn}
          onAmountChange={handleAmountInChange}
          onTokenClick={() => setSelectorSide("in")}
          balance={balanceIn ?? undefined}
          loading={activeField === "out" && isLoading}
        />

        {/* Flip button */}
        <div className="flex justify-center -my-3 relative z-10">
          <button
            onClick={handleFlip}
            className="p-2 rounded-full bg-background border border-border hover:bg-cheese/10 hover:border-cheese/30 transition-colors"
          >
            <ArrowDownUp className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <SwapTokenInput
          label="You receive"
          token={tokenOut}
          amount={displayAmountOut}
          onAmountChange={handleAmountOutChange}
          onTokenClick={() => setSelectorSide("out")}
          balance={balanceOut ?? undefined}
          loading={activeField === "in" && isLoading}
        />
      </div>

      {/* Route error */}
      {routeError && hasAmount && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{(routeError as Error)?.message || "Unable to find a route for this swap"}</span>
        </div>
      )}

      {/* Route details */}
      {route && (
        <div className="space-y-1">
          <button
            onClick={() => setShowRouteDetails(!showRouteDetails)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/50 hover:bg-secondary/80 transition-colors text-sm"
          >
            <span className="text-muted-foreground">
              1 {tokenIn?.ticker} ≈{" "}
              <span className="text-foreground font-medium">
                {route.output && swapAmountIn && parseFloat(swapAmountIn) > 0
                  ? formatTokenAmount(
                      route.output / parseFloat(swapAmountIn),
                      tokenOut?.precision ?? 8
                    )
                  : "—"}{" "}
                {tokenOut?.ticker}
              </span>
            </span>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showRouteDetails ? "rotate-180" : ""}`} />
          </button>
          {showRouteDetails && (
            <div className="px-3 py-2 rounded-lg bg-secondary/30 space-y-1 text-sm">
              {route.priceImpact !== undefined && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Price Impact</span>
                  <span className={
                    route.priceImpact > 5
                      ? "text-destructive"
                      : route.priceImpact > 2
                      ? "text-yellow-500"
                      : "text-green-500"
                  }>
                    {route.priceImpact.toFixed(2)}%
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Slippage</span>
                <span className="text-foreground">{slippage}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Min. Received</span>
                <span className="text-foreground">
                  {formatTokenAmount(route.minReceived, tokenOut?.precision ?? 8)} {tokenOut?.ticker}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Swap / Connect button */}
      <button
        onClick={canSwap ? handleSwap : !accountName ? login : undefined}
        disabled={!!accountName && !canSwap}
        className={`w-full py-3 rounded-xl font-bold text-base transition-colors ${
          canSwap
            ? "bg-cheese text-cheese-foreground hover:bg-cheese/90"
            : !accountName
            ? "bg-cheese text-cheese-foreground hover:bg-cheese/90"
            : "bg-secondary text-muted-foreground cursor-not-allowed"
        }`}
      >
        {isSwapping ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Swapping...
          </span>
        ) : !accountName ? (
          "Connect Wallet"
        ) : !tokenIn || !tokenOut ? (
          "Select tokens"
        ) : !hasAmount ? (
          "Enter amount"
        ) : routeLoading ? (
          "Finding best route..."
        ) : routeError || noRoute ? (
          "No route available"
        ) : !route ? (
          "Enter amount"
        ) : (
          "Swap"
        )}
      </button>

      {/* Token selector */}
      {selectorSide && (
        <TokenSelector
          open={!!selectorSide}
          onClose={() => setSelectorSide(null)}
          onSelect={handleTokenSelect}
          selectedToken={selectorSide === "in" ? tokenIn : tokenOut}
        />
      )}
    </div>
  );
}
