import { memo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Loader2, ChevronDown, Check } from 'lucide-react';
import { TokenLogo } from '@/components/TokenLogo';
import type { AlcorPool } from '@/lib/alcorFarms';
import { formatFee } from './createFarm';

interface PoolPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isLoading: boolean;
  selectedPool: AlcorPool | null;
  pools: AlcorPool[];
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (pool: AlcorPool) => void;
}

/** Searchable Alcor pool selector for Create Alcor Farm. */
export const PoolPicker = memo(function PoolPicker({
  open,
  onOpenChange,
  isLoading,
  selectedPool,
  pools,
  search,
  onSearchChange,
  onSelect,
}: PoolPickerProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-12"
          disabled={isLoading}
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading pools...
            </div>
          ) : selectedPool ? (
            <div className="flex items-center gap-2">
              <div className="flex -space-x-1">
                <TokenLogo contract={selectedPool.tokenA.contract} symbol={selectedPool.tokenA.symbol} size="sm" />
                <TokenLogo contract={selectedPool.tokenB.contract} symbol={selectedPool.tokenB.symbol} size="sm" />
              </div>
              <span>{selectedPool.tokenA.symbol}/{selectedPool.tokenB.symbol}</span>
              <Badge variant="outline" className="ml-2 text-xs">
                {formatFee(selectedPool.fee)}
              </Badge>
            </div>
          ) : (
            <span className="text-muted-foreground">Select a pool...</span>
          )}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search pools by token..."
            value={search}
            onValueChange={onSearchChange}
          />
          <CommandList>
            <CommandEmpty>No pools found.</CommandEmpty>
            <CommandGroup>
              {pools.map(pool => (
                <CommandItem
                  key={pool.id}
                  value={`${pool.tokenA.symbol}-${pool.tokenB.symbol}-${pool.id}`}
                  onSelect={() => onSelect(pool)}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-1">
                      <TokenLogo contract={pool.tokenA.contract} symbol={pool.tokenA.symbol} size="sm" />
                      <TokenLogo contract={pool.tokenB.contract} symbol={pool.tokenB.symbol} size="sm" />
                    </div>
                    <div>
                      <div className="font-medium">{pool.tokenA.symbol}/{pool.tokenB.symbol}</div>
                      <div className="text-xs text-muted-foreground">Pool #{pool.id}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {formatFee(pool.fee)}
                    </Badge>
                    {selectedPool?.id === pool.id && (
                      <Check className="h-4 w-4 text-cheese" />
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
});
