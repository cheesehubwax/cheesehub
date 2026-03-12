import { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Plus, Trash2, AlertTriangle, Info, Search, ChevronDown, Check } from 'lucide-react';
import { useWax } from '@/context/WaxContext';
import { toast } from 'sonner';
import { closeWharfkitModals, getTransactPlugins } from '@/lib/wharfKit';
import { TokenLogo } from '@/components/TokenLogo';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { fetchAllPools, buildCreateIncentiveActions, getNextIncentiveId, AlcorPool } from '@/lib/alcorFarms';
import { useAllTokenBalances, TokenWithBalance } from '@/hooks/useAllTokenBalances';

interface CreateAlcorFarmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTransactionSuccess?: (title: string, description: string, txId: string | null) => void;
  onTransactionComplete?: () => void;
}

interface RewardToken {
  id: string;
  contract: string;
  symbol: string;
  precision: number;
  amount: string;
  balance: number;
}

const DURATION_OPTIONS = [
  { label: '1 Day', days: 1, seconds: 86400 },
  { label: '7 Days', days: 7, seconds: 604800 },
  { label: '30 Days', days: 30, seconds: 2592000 },
  { label: '60 Days', days: 60, seconds: 5184000 },
  { label: '90 Days', days: 90, seconds: 7776000 },
  { label: '180 Days', days: 180, seconds: 15552000 },
  { label: '240 Days', days: 240, seconds: 20736000 },
  { label: '360 Days', days: 360, seconds: 31104000 },
];

function formatFee(fee: number): string {
  return `${(fee / 10000).toFixed(2)}%`;
}

export function CreateAlcorFarmDialog({
  open,
  onOpenChange,
  onTransactionSuccess,
  onTransactionComplete,
}: CreateAlcorFarmDialogProps) {
  const { session, accountName } = useWax();
  const { tokens: balances, isLoading: balancesLoading } = useAllTokenBalances(accountName);

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pools, setPools] = useState<AlcorPool[]>([]);
  const [selectedPool, setSelectedPool] = useState<AlcorPool | null>(null);
  const [poolSearchOpen, setPoolSearchOpen] = useState(false);
  const [poolSearch, setPoolSearch] = useState('');
  const [rewardTokens, setRewardTokens] = useState<RewardToken[]>([]);
  const [selectedDuration, setSelectedDuration] = useState(DURATION_OPTIONS[2]);
  const [rewardTokenOpen, setRewardTokenOpen] = useState(false);
  const [rewardTokenSearch, setRewardTokenSearch] = useState('');

  useEffect(() => {
    if (open) {
      setIsLoading(true);
      fetchAllPools()
        .then(setPools)
        .catch((err) => {
          console.error('Failed to fetch pools:', err);
          toast.error('Failed to load pools');
        })
        .finally(() => setIsLoading(false));
    }
  }, [open]);

  const filteredPools = useMemo(() => {
    if (!poolSearch) return pools.slice(0, 50);
    const search = poolSearch.toLowerCase();
    return pools.filter(pool =>
      pool.tokenA.symbol.toLowerCase().includes(search) ||
      pool.tokenB.symbol.toLowerCase().includes(search) ||
      pool.tokenA.contract.toLowerCase().includes(search) ||
      pool.tokenB.contract.toLowerCase().includes(search)
    ).slice(0, 50);
  }, [pools, poolSearch]);

  const availableRewardTokens = useMemo(() => {
    if (!balances) return [];
    return balances.map(b => ({
      contract: b.contract,
      symbol: b.symbol,
      precision: b.precision,
      balance: b.balance,
    })).filter(t => t.balance > 0);
  }, [balances]);

  const filteredRewardTokens = useMemo(() => {
    if (!rewardTokenSearch) return availableRewardTokens.slice(0, 30);
    const search = rewardTokenSearch.toLowerCase();
    return availableRewardTokens.filter(t =>
      t.symbol.toLowerCase().includes(search) ||
      t.contract.toLowerCase().includes(search)
    ).slice(0, 30);
  }, [availableRewardTokens, rewardTokenSearch]);

  const addRewardToken = useCallback((token: { contract: string; symbol: string; precision: number; balance: number }) => {
    if (rewardTokens.some(rt => rt.contract === token.contract && rt.symbol === token.symbol)) {
      toast.error('This token is already added');
      return;
    }

    setRewardTokens(prev => [...prev, {
      id: `${token.contract}-${token.symbol}-${Date.now()}`,
      contract: token.contract,
      symbol: token.symbol,
      precision: token.precision,
      amount: '',
      balance: token.balance,
    }]);
    setRewardTokenOpen(false);
    setRewardTokenSearch('');
  }, [rewardTokens]);

  const removeRewardToken = useCallback((id: string) => {
    setRewardTokens(prev => prev.filter(rt => rt.id !== id));
  }, []);

  const updateRewardAmount = useCallback((id: string, amount: string) => {
    setRewardTokens(prev => prev.map(rt =>
      rt.id === id ? { ...rt, amount } : rt
    ));
  }, []);

  const setMaxAmount = useCallback((id: string, balance: number, precision: number) => {
    const maxAmount = (balance * 0.9999).toFixed(precision);
    updateRewardAmount(id, maxAmount);
  }, [updateRewardAmount]);

  const isValid = useMemo(() => {
    if (!selectedPool) return false;
    if (rewardTokens.length === 0) return false;

    for (const rt of rewardTokens) {
      const amount = parseFloat(rt.amount);
      if (isNaN(amount) || amount <= 0) return false;
      if (amount > rt.balance) return false;
    }

    return true;
  }, [selectedPool, rewardTokens]);

  const handleSubmit = async () => {
    if (!session || !accountName || !selectedPool || !isValid) return;

    setIsSubmitting(true);
    try {
      const nextIncentiveId = await getNextIncentiveId();

      const rewards = rewardTokens.map(rt => ({
        contract: rt.contract,
        symbol: rt.symbol,
        precision: rt.precision,
        amount: parseFloat(rt.amount),
      }));

      const actions = buildCreateIncentiveActions(
        accountName,
        selectedPool.id,
        selectedDuration.seconds,
        rewards,
        nextIncentiveId
      );

      const result = await session.transact({ actions }, { transactPlugins: getTransactPlugins(session) });
      const txId = result.resolved?.transaction.id?.toString() || null;

      onTransactionSuccess?.(
        'Farm Created!',
        `Created ${rewardTokens.length} incentive(s) for ${selectedPool.tokenA.symbol}/${selectedPool.tokenB.symbol} pool`,
        txId
      );

      setSelectedPool(null);
      setRewardTokens([]);
      setSelectedDuration(DURATION_OPTIONS[2]);
      onOpenChange(false);
      onTransactionComplete?.();
    } catch (error: any) {
      console.error('Create farm error:', error);
      toast.error(error?.message?.substring(0, 100) || 'Failed to create farm');
    } finally {
      setIsSubmitting(false);
      closeWharfkitModals();
      setTimeout(() => closeWharfkitModals(), 300);
    }
  };

  useEffect(() => {
    if (!open) {
      setSelectedPool(null);
      setRewardTokens([]);
      setSelectedDuration(DURATION_OPTIONS[2]);
      setPoolSearch('');
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-cheese" />
            Create Alcor Farm
          </DialogTitle>
          <DialogDescription>
            Create a new incentive farm for an Alcor liquidity pool
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-4">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
              <div className="text-sm text-amber-200">
                <span className="font-medium">Note:</span> You need to be the issuer of one of the tokens in the pool to create a farm incentive.
              </div>
            </div>

            <div className="space-y-2">
              <Label>Select Pool</Label>
              <Popover open={poolSearchOpen} onOpenChange={setPoolSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={poolSearchOpen}
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
                      value={poolSearch}
                      onValueChange={setPoolSearch}
                    />
                    <CommandList>
                      <CommandEmpty>No pools found.</CommandEmpty>
                      <CommandGroup>
                        {filteredPools.map(pool => (
                          <CommandItem
                            key={pool.id}
                            value={`${pool.tokenA.symbol}-${pool.tokenB.symbol}-${pool.id}`}
                            onSelect={() => {
                              setSelectedPool(pool);
                              setPoolSearchOpen(false);
                              setPoolSearch('');
                            }}
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
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Reward Tokens</Label>
                <Popover open={rewardTokenOpen} onOpenChange={setRewardTokenOpen}>
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
                        value={rewardTokenSearch}
                        onValueChange={setRewardTokenSearch}
                      />
                      <CommandList>
                        {balancesLoading ? (
                          <div className="flex items-center justify-center py-6">
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </div>
                        ) : (
                          <>
                            <CommandEmpty>No tokens found.</CommandEmpty>
                            <CommandGroup>
                              {filteredRewardTokens.map(token => (
                                <CommandItem
                                  key={`${token.contract}-${token.symbol}`}
                                  value={`${token.contract}-${token.symbol}`}
                                  onSelect={() => addRewardToken(token)}
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
              </div>

              {rewardTokens.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm border border-dashed border-border rounded-lg">
                  Add reward tokens to incentivize liquidity providers
                </div>
              ) : (
                <div className="space-y-3">
                  {rewardTokens.map(rt => (
                    <div
                      key={rt.id}
                      className="p-3 rounded-lg bg-muted/30 border border-border/50 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <TokenLogo contract={rt.contract} symbol={rt.symbol} size="sm" />
                          <span className="font-medium">{rt.symbol}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeRewardToken(rt.id)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          placeholder="0.0000"
                          value={rt.amount}
                          onChange={(e) => updateRewardAmount(rt.id, e.target.value)}
                          className="flex-1"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setMaxAmount(rt.id, rt.balance, rt.precision)}
                          className="h-9"
                        >
                          Max
                        </Button>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Balance: {rt.balance.toFixed(Math.min(4, rt.precision))} {rt.symbol}</span>
                        {parseFloat(rt.amount) > rt.balance && (
                          <span className="text-red-500">Insufficient balance</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Farm Duration</Label>
              <div className="grid grid-cols-4 gap-2">
                {DURATION_OPTIONS.map(option => (
                  <Button
                    key={option.days}
                    variant={selectedDuration.days === option.days ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedDuration(option)}
                    className={cn(
                      "h-10",
                      selectedDuration.days === option.days && "bg-cheese hover:bg-cheese-dark text-primary-foreground"
                    )}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            {selectedPool && rewardTokens.length > 0 && (
              <div className="p-3 rounded-lg bg-muted/30 border border-border/50 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Info className="h-4 w-4 text-cheese" />
                  Summary
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <div>Pool: {selectedPool.tokenA.symbol}/{selectedPool.tokenB.symbol} ({formatFee(selectedPool.fee)})</div>
                  <div>Duration: {selectedDuration.label}</div>
                  <div>Rewards: {rewardTokens.map(rt => `${rt.amount || '0'} ${rt.symbol}`).join(', ')}</div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting}
            className="bg-cheese hover:bg-cheese-dark text-primary-foreground gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Create Farm
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
