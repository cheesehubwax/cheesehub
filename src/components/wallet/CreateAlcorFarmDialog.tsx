import { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Plus, AlertTriangle, Info } from 'lucide-react';
import { useWax } from '@/context/WaxContext';
import { toast } from 'sonner';
import { closeWharfkitModals, getTransactPlugins } from '@/lib/wharfKit';
import { cn } from '@/lib/utils';
import { fetchAllPools, buildCreateIncentiveActions, getNextIncentiveId, AlcorPool } from '@/lib/alcorFarms';
import { useAllTokenBalances } from '@/hooks/useAllTokenBalances';
import { DEFAULT_DURATION, DURATION_OPTIONS, RewardToken, formatFee, isCreateFarmValid, maxRewardAmount } from './alcor/createFarm';
import { PoolPicker } from './alcor/PoolPicker';
import { RewardTokenPicker } from './alcor/RewardTokenPicker';
import { RewardTokenRow } from './alcor/RewardTokenRow';

interface CreateAlcorFarmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTransactionSuccess?: (title: string, description: string, txId: string | null) => void;
  onTransactionComplete?: () => void;
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
  const [selectedDuration, setSelectedDuration] = useState(DEFAULT_DURATION);
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
    updateRewardAmount(id, maxRewardAmount(balance, precision));
  }, [updateRewardAmount]);

  const isValid = useMemo(() => isCreateFarmValid(selectedPool, rewardTokens), [selectedPool, rewardTokens]);

  const selectPool = useCallback((pool: AlcorPool) => {
    setSelectedPool(pool);
    setPoolSearchOpen(false);
    setPoolSearch('');
  }, []);

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
      setSelectedDuration(DEFAULT_DURATION);
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
      setSelectedDuration(DEFAULT_DURATION);
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
              <PoolPicker
                open={poolSearchOpen}
                onOpenChange={setPoolSearchOpen}
                isLoading={isLoading}
                selectedPool={selectedPool}
                pools={filteredPools}
                search={poolSearch}
                onSearchChange={setPoolSearch}
                onSelect={selectPool}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Reward Tokens</Label>
                <RewardTokenPicker
                  open={rewardTokenOpen}
                  onOpenChange={setRewardTokenOpen}
                  isLoading={balancesLoading}
                  tokens={filteredRewardTokens}
                  search={rewardTokenSearch}
                  onSearchChange={setRewardTokenSearch}
                  onSelect={addRewardToken}
                />
              </div>

              {rewardTokens.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm border border-dashed border-border rounded-lg">
                  Add reward tokens to incentivize liquidity providers
                </div>
              ) : (
                <div className="space-y-3">
                  {rewardTokens.map(rt => (
                    <RewardTokenRow
                      key={rt.id}
                      token={rt}
                      onRemove={removeRewardToken}
                      onAmountChange={updateRewardAmount}
                      onMax={setMaxAmount}
                    />
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

        <div className="pt-2">
        </div>
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
