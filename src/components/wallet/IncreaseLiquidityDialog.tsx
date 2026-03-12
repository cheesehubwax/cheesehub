import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, AlertCircle } from 'lucide-react';
import { useWax } from '@/context/WaxContext';
import { useAllTokenBalances } from '@/hooks/useAllTokenBalances';
import { buildIncreaseLiquidityAction, AlcorFarmPosition } from '@/lib/alcorFarms';
import { TokenLogo } from '@/components/TokenLogo';

import { closeWharfkitModals, getTransactPlugins } from '@/lib/wharfKit';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface IncreaseLiquidityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  position: AlcorFarmPosition | null;
  onSuccess: (title: string, description: string, txId: string | null) => void;
}

export function IncreaseLiquidityDialog({
  open,
  onOpenChange,
  position,
  onSuccess,
}: IncreaseLiquidityDialogProps) {
  const { session, accountName } = useWax();
  const { tokens, refetch: refetchBalances } = useAllTokenBalances(accountName);
  const [tokenAAmount, setTokenAAmount] = useState('');
  const [tokenBAmount, setTokenBAmount] = useState('');
  const [lastEditedToken, setLastEditedToken] = useState<'A' | 'B' | null>(null);
  const [isTransacting, setIsTransacting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const tokenABalance = useMemo(() => {
    if (!position) return null;
    return tokens.find(t =>
      t.contract === position.tokenA.contract &&
      t.symbol === position.tokenA.symbol
    );
  }, [tokens, position]);

  const tokenBBalance = useMemo(() => {
    if (!position) return null;
    return tokens.find(t =>
      t.contract === position.tokenB.contract &&
      t.symbol === position.tokenB.symbol
    );
  }, [tokens, position]);

  const positionRatio = useMemo(() => {
    if (!position || position.tokenA.amount === 0) return 1;
    return position.tokenB.amount / position.tokenA.amount;
  }, [position]);

  const handleTokenAChange = (value: string) => {
    setTokenAAmount(value);
    setLastEditedToken('A');
    if (!value || isNaN(parseFloat(value))) {
      setTokenBAmount('');
      return;
    }
    const amountA = parseFloat(value);
    const amountB = amountA * positionRatio;
    setTokenBAmount(amountB.toFixed(tokenBBalance?.precision || 8));
  };

  const handleTokenBChange = (value: string) => {
    setTokenBAmount(value);
    setLastEditedToken('B');
    if (!value || isNaN(parseFloat(value)) || positionRatio === 0) {
      setTokenAAmount('');
      return;
    }
    const amountB = parseFloat(value);
    const amountA = amountB / positionRatio;
    setTokenAAmount(amountA.toFixed(tokenABalance?.precision || 4));
  };

  useEffect(() => {
    if (open) {
      setTokenAAmount('');
      setTokenBAmount('');
      setLastEditedToken(null);
      setSubmitError(null);
      refetchBalances();
    }
  }, [open, refetchBalances]);

  const handleMaxA = () => {
    if (!tokenABalance) return;

    const balanceA = tokenABalance.balance;
    const balanceB = tokenBBalance?.balance || 0;

    let maxAFromB = positionRatio > 0 ? balanceB / positionRatio : Infinity;
    maxAFromB = maxAFromB * 0.9999;

    const maxA = Math.min(balanceA, maxAFromB);

    if (maxA > 0) {
      handleTokenAChange(maxA.toFixed(tokenABalance.precision));
    }
  };

  const handleSubmit = async () => {
    if (!session || !accountName || !position) return;
    setSubmitError(null);

    if (position.tickLower === 0 && position.tickUpper === 0) {
      setSubmitError('Position tick data is missing. Please use Alcor directly.');
      return;
    }

    const amountA = parseFloat(tokenAAmount);
    const amountB = parseFloat(tokenBAmount);

    if (!amountA || !amountB || amountA <= 0 || amountB <= 0) {
      setSubmitError('Enter valid amounts for both tokens');
      return;
    }

    if (tokenABalance && amountA > tokenABalance.balance) {
      setSubmitError(`Insufficient ${position.tokenA.symbol} balance`);
      return;
    }

    if (tokenBBalance && amountB > tokenBBalance.balance) {
      setSubmitError(`Insufficient ${position.tokenB.symbol} balance`);
      return;
    }

    const precisionA = tokenABalance?.precision || 8;
    const precisionB = tokenBBalance?.precision || 8;

    const quantityA = `${amountA.toFixed(precisionA)} ${position.tokenA.symbol}`;
    const quantityB = `${amountB.toFixed(precisionB)} ${position.tokenB.symbol}`;

    const actions = buildIncreaseLiquidityAction(
      accountName,
      position.positionId,
      position.poolId,
      position.tickLower,
      position.tickUpper,
      position.tokenA.contract,
      quantityA,
      position.tokenB.contract,
      quantityB
    );

    setIsTransacting(true);
    try {
      let lastError: any = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          if (attempt > 0) await new Promise(r => setTimeout(r, 1500));
          const result = await session.transact({ actions }, { transactPlugins: getTransactPlugins(session) });
          const txId = result.resolved?.transaction.id?.toString() || null;

          setTimeout(() => { refetchBalances(); }, 2000);

          onSuccess(
            'Liquidity Added!',
            `Added ${quantityA} and ${quantityB} to your ${position.tokenA.symbol}/${position.tokenB.symbol} position`,
            txId
          );
          return;
        } catch (err: any) {
          lastError = err;
          const isNetworkError =
            err?.message?.toLowerCase().includes('failed to fetch') ||
            err?.message?.toLowerCase().includes('networkerror');
          if (!isNetworkError) break;
        }
      }
      throw lastError;
    } catch (error: any) {
      console.error('Add liquidity error:', error);
      const msg = error?.message || 'Failed to add liquidity';
      const isNetworkError = msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('networkerror');
      setSubmitError(
        isNetworkError
          ? 'Network error: Could not reach WAX node. Please try again.'
          : msg
      );
    } finally {
      setIsTransacting(false);
      closeWharfkitModals();
      setTimeout(() => closeWharfkitModals(), 300);
    }
  };

  if (!position) return null;

  const canSubmit =
    parseFloat(tokenAAmount) > 0 &&
    parseFloat(tokenBAmount) > 0 &&
    (!tokenABalance || parseFloat(tokenAAmount) <= tokenABalance.balance) &&
    (!tokenBBalance || parseFloat(tokenBAmount) <= tokenBBalance.balance) &&
    !isTransacting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[425px]"
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex -space-x-1">
              <TokenLogo contract={position.tokenA.contract} symbol={position.tokenA.symbol} size="sm" />
              <TokenLogo contract={position.tokenB.contract} symbol={position.tokenB.symbol} size="sm" />
            </div>
            Increase Position
          </DialogTitle>
          <DialogDescription>
            Add more liquidity to your {position.tokenA.symbol}/{position.tokenB.symbol} position #{position.positionId}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current Stake:</span>
              <div className="text-right font-mono">
                <div>{position.tokenA.amount.toFixed(4)} {position.tokenA.symbol}</div>
                <div>{position.tokenB.amount.toFixed(4)} {position.tokenB.symbol}</div>
              </div>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground pt-1 border-t border-border/50">
              <span>Tick Range:</span>
              <span className="font-mono">{position.tickLower} → {position.tickUpper}</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <TokenLogo contract={position.tokenA.contract} symbol={position.tokenA.symbol} size="sm" className="h-4 w-4" />
                {position.tokenA.symbol}
              </Label>
              <span className="text-xs text-muted-foreground">
                Balance: {tokenABalance?.balance.toFixed(tokenABalance.precision) || '0'}
              </span>
            </div>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="0.0"
                value={tokenAAmount}
                onChange={(e) => handleTokenAChange(e.target.value)}
                min={0}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleMaxA}
                className="shrink-0"
              >
                Max
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <TokenLogo contract={position.tokenB.contract} symbol={position.tokenB.symbol} size="sm" className="h-4 w-4" />
                {position.tokenB.symbol}
              </Label>
              <span className="text-xs text-muted-foreground">
                Balance: {tokenBBalance?.balance.toFixed(tokenBBalance.precision) || '0'}
              </span>
            </div>
            <Input
              type="number"
              placeholder="0.0"
              value={tokenBAmount}
              onChange={(e) => handleTokenBChange(e.target.value)}
              min={0}
            />
            <p className="text-xs text-muted-foreground">
              Edit either token - the other adjusts automatically
            </p>
          </div>

          {tokenBBalance && parseFloat(tokenBAmount) > tokenBBalance.balance && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Insufficient {position.tokenB.symbol} balance
              </AlertDescription>
            </Alert>
          )}

          {submitError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="break-all text-xs">{submitError}</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full bg-cheese hover:bg-cheese-dark text-primary-foreground"
          >
            {isTransacting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding Liquidity...
              </>
            ) : (
              'Add Liquidity'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
