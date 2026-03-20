import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import { WAX_TOKENS, getTokenConfig } from "@/lib/tokenRegistry";
import { TokenLogo } from "@/components/TokenLogo";
import { Plus, X, ChevronDown, Check, Coins } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PriceOption {
  token: string;
  amount: number;
}

interface TokenPriceInputProps {
  prices: PriceOption[];
  onChange: (prices: PriceOption[]) => void;
  minPrices?: number;
  maxPrices?: number;
}

export function TokenPriceInput({ 
  prices, 
  onChange, 
  minPrices = 1, 
  maxPrices = 10 
}: TokenPriceInputProps) {
  const [openTokenIndex, setOpenTokenIndex] = useState<number | null>(null);

  const handleAddPrice = () => {
    if (prices.length >= maxPrices) return;
    const usedTokens = new Set(prices.map(p => p.token));
    const availableToken = WAX_TOKENS.find(t => !usedTokens.has(t.symbol));
    onChange([...prices, { token: availableToken?.symbol || 'WAX', amount: 0 }]);
  };

  const handleRemovePrice = (index: number) => {
    if (prices.length <= minPrices) return;
    onChange(prices.filter((_, i) => i !== index));
  };

  const handleTokenChange = (index: number, token: string) => {
    const updated = [...prices];
    updated[index] = { ...updated[index], token };
    onChange(updated);
    setOpenTokenIndex(null);
  };

  const handleAmountChange = (index: number, amount: number) => {
    const updated = [...prices];
    updated[index] = { ...updated[index], amount };
    onChange(updated);
  };

  const getAvailableTokens = (currentToken: string) => {
    const usedTokens = new Set(prices.map(p => p.token).filter(t => t !== currentToken));
    return WAX_TOKENS.filter(t => !usedTokens.has(t.symbol));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-primary" />
          Listing Prices *
        </Label>
        {prices.length < maxPrices && (
          <Button type="button" variant="outline" size="sm" onClick={handleAddPrice} className="h-7 text-xs">
            <Plus className="h-3 w-3 mr-1" />
            Add Price Option
          </Button>
        )}
      </div>
      
      <p className="text-xs text-muted-foreground">
        Add multiple price options to let buyers pay with different tokens.
      </p>

      <div className="space-y-2">
        {prices.map((price, index) => {
          const tokenConfig = getTokenConfig(price.token);
          const availableTokens = getAvailableTokens(price.token);

          return (
            <div key={index} className="flex items-center gap-2">
              <Popover 
                open={openTokenIndex === index} 
                onOpenChange={(open) => setOpenTokenIndex(open ? index : null)}
              >
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" role="combobox" className="w-36 justify-between font-medium">
                    <div className="flex items-center gap-2">
                      <TokenLogo contract={tokenConfig?.contract || ''} symbol={price.token} size="sm" />
                      {price.token}
                    </div>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search tokens..." />
                    <CommandList>
                      <CommandEmpty>No token found.</CommandEmpty>
                      <CommandGroup>
                        <ScrollArea className="h-64">
                          {availableTokens.map((token) => (
                            <CommandItem
                              key={token.symbol}
                              value={token.symbol}
                              onSelect={() => handleTokenChange(index, token.symbol)}
                              className="cursor-pointer"
                            >
                              <Check className={cn("mr-2 h-4 w-4", price.token === token.symbol ? "opacity-100" : "opacity-0")} />
                              <TokenLogo contract={token.contract} symbol={token.symbol} size="sm" />
                              <span className="font-medium ml-2">{token.symbol}</span>
                              <span className="ml-auto text-xs text-muted-foreground">{token.precision}dp</span>
                            </CommandItem>
                          ))}
                        </ScrollArea>
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              <Input
                type="number"
                min="0"
                step={tokenConfig ? Math.pow(10, -tokenConfig.precision) : 0.0001}
                placeholder={`Amount (${tokenConfig?.precision || 4} decimals)`}
                value={price.amount || ''}
                onChange={(e) => handleAmountChange(index, parseFloat(e.target.value) || 0)}
                className="flex-1"
              />

              {prices.length > minPrices && (
                <Button type="button" variant="ghost" size="sm" onClick={() => handleRemovePrice(index)} className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {prices.length > 0 && prices.some(p => p.amount > 0) && (
        <div className="text-xs bg-primary/10 text-primary p-2 rounded">
          Buyers can pay: {prices
            .filter(p => p.amount > 0)
            .map(p => {
              const config = getTokenConfig(p.token);
              return `${p.amount.toFixed(config?.precision || 4)} ${p.token}`;
            })
            .join(' OR ')}
        </div>
      )}
    </div>
  );
}
