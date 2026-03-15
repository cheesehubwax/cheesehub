import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSwapTokens } from "@/hooks/useSwapTokens";
import { useSwapTokenBalances } from "@/hooks/useSwapTokenBalances";
import { useAlcorTokenPrices } from "@/hooks/useAlcorTokenPrices";
import { useWax } from "@/context/WaxContext";
import { type SwapToken, getTokenLogoUrl } from "@/lib/swapApi";

interface TokenSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelect: (token: SwapToken) => void;
  selectedToken?: SwapToken | null;
}

export function TokenSelector({ open, onClose, onSelect, selectedToken }: TokenSelectorProps) {
  const { filteredTokens, popularTokens, tokens, isLoading, search, setSearch } = useSwapTokens();
  const { accountName } = useWax();
  const [balanceFetchEnabled, setBalanceFetchEnabled] = useState(false);
  const balances = useSwapTokenBalances(accountName, tokens, balanceFetchEnabled);
  const { data: tokenPrices } = useAlcorTokenPrices();
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set());

  const tokenKey = (t: SwapToken) => `${t.ticker}_${t.contract}`;

  useEffect(() => {
    if (open) {
      const id = window.setTimeout(() => setBalanceFetchEnabled(true), 80);
      return () => window.clearTimeout(id);
    }
    setBalanceFetchEnabled(false);
  }, [open]);

  const sortedFilteredTokens = useMemo(() => {
    return [...filteredTokens].sort((a, b) => {
      const balA = parseFloat(balances.get(tokenKey(a)) ?? "0");
      const balB = parseFloat(balances.get(tokenKey(b)) ?? "0");
      if (balA > 0 && balB <= 0) return -1;
      if (balB > 0 && balA <= 0) return 1;
      return 0;
    });
  }, [filteredTokens, balances]);

  const handleSelect = (token: SwapToken) => {
    onSelect(token);
    onClose();
    setSearch("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[420px] bg-background border-border">
        <DialogHeader>
          <DialogTitle>Select Token</DialogTitle>
          <DialogDescription>Search and select a token to swap</DialogDescription>
        </DialogHeader>
        <Input
          placeholder="Search by name or contract..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-secondary/50 border-border"
          autoFocus
        />

        {/* Popular tokens */}
        {!search && popularTokens.length > 0 && (
          <div className="flex flex-wrap gap-2 py-2">
            {popularTokens.map((t) => (
              <button
                key={tokenKey(t)}
                onClick={() => handleSelect(t)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selectedToken && tokenKey(selectedToken) === tokenKey(t)
                    ? "bg-cheese/20 text-cheese border border-cheese/30"
                    : "bg-secondary hover:bg-secondary/80 text-foreground"
                }`}
              >
                <TokenLogo token={t} imgErrors={imgErrors} setImgErrors={setImgErrors} size={18} />
                {t.ticker}
              </button>
            ))}
          </div>
        )}

        <ScrollArea className="h-[320px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <span className="text-muted-foreground text-sm">Loading tokens...</span>
            </div>
          ) : filteredTokens.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <span className="text-muted-foreground text-sm">No tokens found</span>
            </div>
          ) : (
            <div className="space-y-0.5">
              {sortedFilteredTokens.map((t) => {
                const isSelected = selectedToken && tokenKey(selectedToken) === tokenKey(t);
                const bal = balances.get(tokenKey(t));
                const numBal = parseFloat(bal ?? "0");
                return (
                  <button
                    key={tokenKey(t)}
                    onClick={() => handleSelect(t)}
                    disabled={!!isSelected}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                      isSelected
                        ? "bg-cheese/10 cursor-default"
                        : "hover:bg-secondary/80"
                    }`}
                  >
                    <TokenLogo token={t} imgErrors={imgErrors} setImgErrors={setImgErrors} size={32} />
                    <div className="flex flex-col items-start flex-1 min-w-0">
                      <span className="font-semibold text-sm text-foreground">{t.ticker}</span>
                      <span className="text-xs text-muted-foreground truncate">{t.contract}</span>
                    </div>
                    {accountName && numBal > 0 && (
                      <span className="text-sm text-muted-foreground font-medium">
                        {numBal.toLocaleString(undefined, { maximumFractionDigits: t.precision ?? 8 })}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function TokenLogo({
  token,
  imgErrors,
  setImgErrors,
  size,
}: {
  token: SwapToken;
  imgErrors: Set<string>;
  setImgErrors: React.Dispatch<React.SetStateAction<Set<string>>>;
  size: number;
}) {
  const key = `${token.ticker}_${token.contract}`;
  const hasError = imgErrors.has(key);

  return hasError ? (
    <div
      className="rounded-full bg-cheese/20 flex items-center justify-center text-cheese font-bold"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {token.ticker.charAt(0)}
    </div>
  ) : (
    <img
      src={getTokenLogoUrl(token.contract, token.ticker)}
      alt={token.ticker}
      className="rounded-full"
      style={{ width: size, height: size }}
      onError={() => setImgErrors((prev) => new Set(prev).add(key))}
    />
  );
}
