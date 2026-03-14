import { useState } from "react";
import { Input } from "@/components/ui/input";
import { type SwapToken, getTokenLogoUrl, formatTokenAmount } from "@/lib/swapApi";
import { ChevronDown } from "lucide-react";

interface SwapTokenInputProps {
  label: string;
  token: SwapToken | null;
  amount: string;
  onAmountChange?: (val: string) => void;
  onTokenClick: () => void;
  balance?: string;
  readOnly?: boolean;
  loading?: boolean;
  precision?: number;
}

const PERCENT_BUTTONS = [25, 50, 75, 100] as const;

export function SwapTokenInput({
  label,
  token,
  amount,
  onAmountChange,
  onTokenClick,
  balance,
  readOnly = false,
  loading = false,
}: SwapTokenInputProps) {
  const [imgError, setImgError] = useState(false);

  const handlePercentClick = (pct: number) => {
    if (!balance || !onAmountChange) return;
    const val = parseFloat(balance) * (pct / 100);
    onAmountChange(formatTokenAmount(val, token?.precision ?? 4));
  };

  return (
    <div className="rounded-xl bg-secondary/50 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
        {balance && (
          <span className="text-xs text-muted-foreground">
            Balance:{" "}
            <span className="text-foreground font-medium">
              {parseFloat(balance).toLocaleString(undefined, { maximumFractionDigits: 4 })}
            </span>
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onTokenClick}
          className="flex items-center gap-2 bg-background/80 hover:bg-background rounded-lg px-3 py-2 transition-colors shrink-0"
        >
          {token ? (
            <>
              {!imgError ? (
                <img
                  src={getTokenLogoUrl(token.contract, token.ticker)}
                  alt={token.ticker}
                  className="w-6 h-6 rounded-full"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-cheese/20 flex items-center justify-center text-xs font-bold text-cheese">
                  {token.ticker.charAt(0)}
                </div>
              )}
              <span className="font-semibold text-sm text-foreground">{token.ticker}</span>
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </>
          ) : (
            <>
              <span className="text-sm text-muted-foreground">Select</span>
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </>
          )}
        </button>

        <div className="flex-1">
          {loading ? (
            <div className="h-8 flex items-center justify-end">
              <div className="w-20 h-5 bg-muted-foreground/20 rounded animate-pulse" />
            </div>
          ) : (
            <Input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => onAmountChange?.(e.target.value)}
              readOnly={readOnly}
              className="bg-transparent border-none text-right text-2xl font-mono font-semibold text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:outline-none focus:outline-none p-0 h-auto [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          )}
        </div>
      </div>

      {!readOnly && balance && onAmountChange && (
        <div className="flex gap-1.5 justify-end">
          {PERCENT_BUTTONS.map((pct) => (
            <button
              key={pct}
              onClick={() => handlePercentClick(pct)}
              className="px-2.5 py-1 text-xs font-medium rounded-md bg-background/80 text-muted-foreground hover:text-foreground hover:bg-cheese/10 hover:text-cheese transition-colors"
            >
              {pct === 100 ? "Max" : `${pct}%`}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
