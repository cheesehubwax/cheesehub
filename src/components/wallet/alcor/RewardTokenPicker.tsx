import { memo } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Loader2, Plus } from 'lucide-react';
import { TokenLogo } from '@/components/TokenLogo';

export interface RewardTokenOption {
  contract: string;
  symbol: string;
  precision: number;
  balance: number;
}

interface RewardTokenPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isLoading: boolean;
  tokens: RewardTokenOption[];
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (token: RewardTokenOption) => void;
}

/** "Add Token" popover listing wallet tokens that can fund a farm. */
export const RewardTokenPicker = memo(function RewardTokenPicker({
  open,
  onOpenChange,
  isLoading,
  tokens,
  search,
  onSearchChange,
  onSelect,
}: RewardTokenPickerProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 gap-1">
          <Plus className="h-3 w-3" />
          Add Token
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="end">
        <Command>
          <CommandInput
            placeholder="Search tokens..."
            value={search}
            onValueChange={onSearchChange}
          />
          <CommandList>
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : (
              <>
                <CommandEmpty>No tokens found.</CommandEmpty>
                <CommandGroup>
                  {tokens.map(token => (
                    <CommandItem
                      key={`${token.contract}-${token.symbol}`}
                      value={`${token.contract}-${token.symbol}`}
                      onSelect={() => onSelect(token)}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <TokenLogo contract={token.contract} symbol={token.symbol} size="sm" />
                        <span>{token.symbol}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {token.balance.toFixed(Math.min(4, token.precision))}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
});
