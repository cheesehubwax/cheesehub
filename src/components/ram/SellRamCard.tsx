import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { TermsDialog } from '@/components/shared/TermsDialog';
import { OpenMojiIcon } from '@/components/OpenMojiIcon';
import { formatBytes } from '@/components/wallet/WalletResources';
import { useWax } from '@/context/WaxContext';
import { useTransactionSuccess } from '@/context/TransactionSuccessContext';
import { closeWharfkitModals, getTransactPlugins, parseTransactError } from '@/lib/wharfKit';
import {
  CHEESE_RAM_CONTRACT,
  SELL_MEMO,
  estimateCheeseForBytes,
  resolveQuoteRate,
  type CheeseRamConfig,
  type ContractReserves,
} from '@/lib/cheeseRam';

interface SellRamCardProps {
  config: CheeseRamConfig | null | undefined;
  pricePerByte: number | null;
  /** Live Alcor CHEESE/WAX rate (WAX per CHEESE). */
  liveWaxPerCheese: number | null;
  reserves: ContractReserves | null | undefined;
  availableBytes: number;
  onComplete?: () => void;
}

export function SellRamCard({
  config,
  pricePerByte,
  liveWaxPerCheese,
  reserves,
  availableBytes,
  onComplete,
}: SellRamCardProps) {
  const { session, isConnected, login } = useWax();
  const { showSuccess } = useTransactionSuccess();
  const [bytesInput, setBytesInput] = useState('');
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [isTransacting, setIsTransacting] = useState(false);

  const bytes = parseInt(bytesInput, 10) || 0;
  const quoteRate = resolveQuoteRate(config, liveWaxPerCheese);
  const rate = quoteRate?.rate ?? null;
  const estimate = estimateCheeseForBytes(bytes, config, pricePerByte, rate);

  const minBytes = config?.minSellBytes ?? 0;
  const maxBytes = config?.maxSellBytes ?? 0;
  const sellDisabled = config ? !config.sellEnabled : false;

  const belowMin = bytes > 0 && minBytes > 0 && bytes < minBytes;
  const aboveMax = bytes > 0 && maxBytes > 0 && bytes > maxBytes;
  const exceedsAvailable = bytes > availableBytes;

  const poolTooLow =
    !!estimate && !!reserves && (reserves.cheesePool < estimate.cheese ||
      (config ? reserves.cheesePool < config.minCheesePool : false));

  const canSubmit =
    !isTransacting &&
    !sellDisabled &&
    termsAgreed &&
    bytes > 0 &&
    !belowMin &&
    !aboveMax &&
    !exceedsAvailable;

  const handleSell = async () => {
    if (!isConnected || !session) {
      await login();
      return;
    }
    if (!canSubmit) return;

    setIsTransacting(true);
    try {
      const action = {
        account: 'eosio',
        name: 'ramtransfer',
        authorization: [session.permissionLevel],
        data: {
          from: String(session.actor),
          to: CHEESE_RAM_CONTRACT,
          bytes,
          memo: SELL_MEMO,
        },
      };

      const result = await session.transact(
        { actions: [action] },
        { transactPlugins: getTransactPlugins(session) },
      );
      const txId = result.resolved?.transaction.id?.toString() ?? null;
      if (!txId) {
        toast.error('Transaction may not have confirmed', {
          description: 'Please check your account on waxblock.io.',
          duration: 10000,
        });
        return;
      }

      showSuccess(
        'RAM Sold!',
        `Sold ${formatBytes(bytes)} of RAM for ~${(estimate?.cheese ?? 0).toFixed(4)} CHEESE.`,
        txId,
      );
      setBytesInput('');
      setTermsAgreed(false);
      onComplete?.();
    } catch (error) {
      console.error('[CHEESERam] Sell failed:', error);
      const info = parseTransactError(error);
      if (info.type !== 'cancelled') {
        toast.error(info.title, { description: info.description, duration: info.duration });
      }
    } finally {
      setIsTransacting(false);
      closeWharfkitModals();
      setTimeout(() => closeWharfkitModals(), 300);
    }
  };

  return (
    <div className="rounded-2xl p-6 max-w-lg w-full bg-card border border-border/50 space-y-5">
      <div className="flex items-center gap-2">
        <OpenMojiIcon emoji="📤" size={22} />
        <h2 className="text-xl font-bold">
          <span className="text-cheese">Sell</span> <span className="text-foreground">RAM</span>
        </h2>
      </div>

      <div className="p-3 bg-muted/50 rounded-lg text-sm">
        <span className="text-muted-foreground">Your available RAM: </span>
        <span className="font-medium font-mono">{formatBytes(availableBytes)}</span>
        <span className="text-muted-foreground ml-1">({availableBytes.toLocaleString()} bytes)</span>
      </div>

      <div className="space-y-2">
        <Label htmlFor="sell-ram-bytes">Amount of bytes to sell</Label>
        <div className="flex gap-2">
          <Input
            id="sell-ram-bytes"
            type="number"
            min={0}
            step={1}
            placeholder="Bytes"
            value={bytesInput}
            onChange={(e) => setBytesInput(e.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() =>
              setBytesInput(String(Math.min(availableBytes, maxBytes || availableBytes)))
            }
          >
            Max
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Limits: {minBytes.toLocaleString()} – {maxBytes.toLocaleString()} bytes
        </p>
      </div>

      <div className="rounded-xl border border-border/50 bg-secondary/20 p-4 space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Estimated payout</span>
          <span className="font-mono font-bold text-primary">
            {estimate ? `${estimate.cheese.toFixed(4)} CHEESE` : '-'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">WAX value of RAM</span>
          <span className="font-mono text-foreground">
            {estimate ? `${estimate.waxValue.toFixed(8)} WAX` : '-'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Rate</span>
          <span className="font-mono text-foreground">
            {rate ? (
              <>
                1 CHEESE = {rate.toFixed(4)} WAX{' '}
                <span className="text-[10px] text-muted-foreground font-normal">
                  ({quoteRate?.live ? 'live' : 'contract'})
                </span>
              </>
            ) : (
              '-'
            )}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground pt-1">
          Estimate only — the contract calculates the final payout at execution time.
        </p>
      </div>

      {quoteRate?.stale && (
        <p className="text-xs text-amber-500">
          The contract's oracle rate has drifted more than{' '}
          {(config?.maxDeviationPct ?? 0).toFixed(0)}% from the live market — quoting at the
          contract rate instead.
        </p>
      )}


      {belowMin && (
        <p className="text-xs text-destructive">Minimum sale is {minBytes.toLocaleString()} bytes.</p>
      )}
      {aboveMax && (
        <p className="text-xs text-destructive">Maximum sale is {maxBytes.toLocaleString()} bytes.</p>
      )}
      {exceedsAvailable && (
        <p className="text-xs text-destructive">You only have {availableBytes.toLocaleString()} free bytes.</p>
      )}
      {poolTooLow && (
        <p className="text-xs text-amber-500">
          The contract CHEESE pool may be too low to service this sale right now — try a smaller amount.
        </p>
      )}
      {sellDisabled && (
        <p className="text-xs text-destructive">RAM sales are currently disabled by the contract.</p>
      )}

      <div className="flex items-start gap-2">
        <Checkbox
          id="terms-sell-ram"
          checked={termsAgreed}
          onCheckedChange={(v) => setTermsAgreed(v === true)}
          className="mt-0.5"
        />
        <label htmlFor="terms-sell-ram" className="text-xs text-muted-foreground leading-relaxed">
          I have read and agree to the <TermsDialog /> and understand my RAM is sent to the contract in exchange for CHEESE.
        </label>
      </div>

      <Button
        onClick={handleSell}
        disabled={isConnected && !canSubmit}
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
      >
        {isTransacting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Selling RAM...
          </>
        ) : !isConnected ? (
          'Connect Wallet'
        ) : (
          'Sell RAM for CHEESE'
        )}
      </Button>
    </div>
  );
}
