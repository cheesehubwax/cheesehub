import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheeseInput } from '@/components/powerup/CheeseInput';
import { RecipientInput } from '@/components/powerup/RecipientInput';
import { TermsDialog } from '@/components/shared/TermsDialog';
import { formatBytes } from '@/components/wallet/WalletResources';
import { useWax } from '@/context/WaxContext';
import { useTransactionSuccess } from '@/context/TransactionSuccessContext';
import { closeWharfkitModals, getTransactPlugins, parseTransactError } from '@/lib/wharfKit';
import {
  CHEESE_RAM_CONTRACT,
  CHEESE_TOKEN_CONTRACT,
  estimateBytesForCheese,
  estimateCheeseForTargetBytes,
  findRecentBuy,
  pollForConfirmation,
  resolveQuoteRate,
  type CheeseRamConfig,
} from '@/lib/cheeseRam';
import { UnconfirmedNotice, type UnconfirmedState } from '@/components/ram/UnconfirmedNotice';
import { cn } from '@/lib/utils';
import ramStickAsset from '@/assets/ram-stick.png';
import { Loader2 } from 'lucide-react';


interface BuyRamCardProps {
  config: CheeseRamConfig | null | undefined;
  pricePerByte: number | null;
  /** Live Alcor CHEESE/WAX rate (WAX per CHEESE). */
  liveWaxPerCheese: number | null;
  onComplete?: () => void;
}

type BuyMode = 'cheese' | 'bytes';

const isValidAccount = (account: string) =>
  !!account && account.length <= 12 && /^[a-z1-5.]+$/.test(account);

export function BuyRamCard({ config, pricePerByte, liveWaxPerCheese, onComplete }: BuyRamCardProps) {
  const { session, isConnected, accountName, cheeseBalance, login, refreshBalance } = useWax();
  const { showSuccess } = useTransactionSuccess();
  const [mode, setMode] = useState<BuyMode>('cheese');
  const [amount, setAmount] = useState('');
  const [bytesInput, setBytesInput] = useState('');
  const [recipient, setRecipient] = useState(accountName || '');
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [isTransacting, setIsTransacting] = useState(false);

  useEffect(() => {
    if (accountName) setRecipient(accountName);
  }, [accountName]);

  const quoteRate = resolveQuoteRate(config, liveWaxPerCheese);
  const rate = quoteRate?.rate ?? null;
  const desiredBytes = Math.floor(parseFloat(bytesInput) || 0);

  // In bytes mode the CHEESE spend is derived from the target byte amount
  // (rounded up to token precision so the contract can cover the request).
  const cheese = useMemo(() => {
    if (mode === 'cheese') return parseFloat(amount) || 0;
    const derived = estimateCheeseForTargetBytes(desiredBytes, config, pricePerByte, rate);
    if (!derived) return 0;
    return Math.ceil(derived.cheese * 10000) / 10000;
  }, [mode, amount, desiredBytes, config, pricePerByte, rate]);

  const estimate = estimateBytesForCheese(cheese, config, pricePerByte, rate);
  const minCheese = config?.minCheese ?? 0;
  const maxCheese = config?.maxCheese ?? 0;
  const belowMin = cheese > 0 && minCheese > 0 && cheese < minCheese;
  const aboveMax = cheese > 0 && maxCheese > 0 && cheese > maxCheese;
  const insufficient = cheese > cheeseBalance;
  const buyDisabled = config ? !config.enabled : false;
  const missingPrice = mode === 'bytes' && desiredBytes > 0 && cheese === 0;

  const canSubmit =
    !isTransacting &&
    !buyDisabled &&
    termsAgreed &&
    cheese > 0 &&
    !belowMin &&
    !aboveMax &&
    !insufficient &&
    isValidAccount(recipient);



  const handleBuy = async () => {
    if (!isConnected || !session) {
      await login();
      return;
    }
    if (!canSubmit) return;

    setIsTransacting(true);
    try {
      const action = {
        account: CHEESE_TOKEN_CONTRACT,
        name: 'transfer',
        authorization: [session.permissionLevel],
        data: {
          from: String(session.actor),
          to: CHEESE_RAM_CONTRACT,
          quantity: `${cheese.toFixed(4)} CHEESE`,
          memo: recipient === accountName ? '' : recipient,
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
        'RAM Purchased!',
        `Sent ${cheese.toFixed(4)} CHEESE for ~${formatBytes(estimate?.bytes ?? 0)} of RAM to ${recipient}. The CHEESE has been nulled.`,
        txId,
      );
      setAmount('');
      setBytesInput('');
      setTermsAgreed(false);
      refreshBalance?.();
      onComplete?.();
    } catch (error) {
      console.error('[CHEESERam] Buy failed:', error);
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
        <img src={ramStickAsset} alt="RAM" className="h-5 w-auto object-contain" />
        <h2 className="text-xl font-bold">
          <span className="text-cheese">Buy</span> <span className="text-foreground">RAM</span>
        </h2>
      </div>

      {/* Input mode switch — spend CHEESE, or target a byte amount */}
      <div className="inline-flex rounded-lg border border-border/50 bg-secondary/20 p-1 text-xs font-medium">
        {([
          { key: 'cheese' as BuyMode, label: 'Spend CHEESE' },
          { key: 'bytes' as BuyMode, label: 'Target bytes' },
        ]).map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setMode(opt.key)}
            className={cn(
              'px-3 py-1.5 rounded-md transition-colors',
              mode === opt.key
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {mode === 'cheese' ? (
        <CheeseInput
          value={amount}
          onChange={setAmount}
          balance={cheeseBalance}
          label="You spend"
        />
      ) : (
        <div className="rounded-xl p-4 bg-card border border-border/50 space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="ram-target-bytes" className="text-sm font-medium">
              RAM you want (bytes)
            </Label>
            <span className="text-sm text-muted-foreground">
              Balance:{' '}
              <span className="text-foreground font-mono">
                {cheeseBalance.toLocaleString(undefined, {
                  minimumFractionDigits: 4,
                  maximumFractionDigits: 4,
                })}
              </span>{' '}
              CHEESE
            </span>
          </div>
          <Input
            id="ram-target-bytes"
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            placeholder="e.g. 10240"
            value={bytesInput}
            onChange={(e) => setBytesInput(e.target.value)}
            className="font-mono"
          />
          <div className="flex flex-wrap gap-2">
            {[1024, 10240, 102400, 1048576].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setBytesInput(String(preset))}
                className="px-2 py-1 rounded-md border border-border/50 text-[11px] text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
              >
                {formatBytes(preset)}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">CHEESE required</span>
            <span className="font-mono font-bold text-primary">
              {cheese > 0 ? `${cheese.toFixed(4)} CHEESE` : '-'}
            </span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          Limits: {minCheese.toFixed(4)} – {maxCheese.toFixed(4)} CHEESE
        </span>
        {mode === 'cheese' && (
          <button
            type="button"
            onClick={() => setAmount(Math.min(cheeseBalance, maxCheese || cheeseBalance).toFixed(4))}
            className="text-primary hover:underline font-medium"
          >
            Max
          </button>
        )}
      </div>


      <RecipientInput value={recipient} onChange={setRecipient} defaultAccount={accountName || ''} />

      <div className="rounded-xl border border-border/50 bg-secondary/20 p-4 space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Estimated RAM</span>
          <span className="font-mono font-bold text-primary">
            {estimate ? formatBytes(estimate.bytes) : '-'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">WAX value used</span>
          <span className="font-mono text-foreground">
            {estimate ? `${estimate.waxValue.toFixed(8)} WAX` : '-'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Bytes</span>
          <span className="font-mono text-foreground">
            {estimate ? estimate.bytes.toLocaleString() : '-'}
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
          Estimate only — the contract calculates the final amount at execution time.
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
        <p className="text-xs text-destructive">Minimum purchase is {minCheese.toFixed(4)} CHEESE.</p>
      )}
      {aboveMax && (
        <p className="text-xs text-destructive">Maximum purchase is {maxCheese.toFixed(4)} CHEESE.</p>
      )}
      {insufficient && <p className="text-xs text-destructive">Insufficient CHEESE balance.</p>}
      {missingPrice && (
        <p className="text-xs text-destructive">Waiting for live RAM pricing — try again in a moment.</p>
      )}

      {buyDisabled && (
        <p className="text-xs text-destructive">RAM purchases are currently disabled by the contract.</p>
      )}

      <div className="flex items-start gap-2">
        <Checkbox
          id="terms-buy-ram"
          checked={termsAgreed}
          onCheckedChange={(v) => setTermsAgreed(v === true)}
          className="mt-0.5"
        />
        <label htmlFor="terms-buy-ram" className="text-xs text-muted-foreground leading-relaxed">
          I have read and agree to the <TermsDialog />
        </label>
      </div>

      <Button
        onClick={handleBuy}
        disabled={isConnected && !canSubmit}
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
      >
        {isTransacting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Buying RAM...
          </>
        ) : !isConnected ? (
          'Connect Wallet'
        ) : (
          'Buy RAM with CHEESE'
        )}
      </Button>
    </div>
  );
}
