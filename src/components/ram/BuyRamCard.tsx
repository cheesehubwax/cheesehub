import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheeseInput } from '@/components/powerup/CheeseInput';
import { RecipientInput } from '@/components/powerup/RecipientInput';
import { TermsDialog } from '@/components/shared/TermsDialog';
import { OpenMojiIcon } from '@/components/OpenMojiIcon';
import { formatBytes } from '@/components/wallet/WalletResources';
import { useWax } from '@/context/WaxContext';
import { useTransactionSuccess } from '@/context/TransactionSuccessContext';
import { closeWharfkitModals, getTransactPlugins, parseTransactError } from '@/lib/wharfKit';
import {
  CHEESE_RAM_CONTRACT,
  CHEESE_TOKEN_CONTRACT,
  estimateBytesForCheese,
  estimateCheeseForTargetBytes,
  type CheeseRamConfig,
} from '@/lib/cheeseRam';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface BuyRamCardProps {
  config: CheeseRamConfig | null | undefined;
  pricePerByte: number | null;
  onComplete?: () => void;
}

type BuyMode = 'cheese' | 'bytes';

const isValidAccount = (account: string) =>
  !!account && account.length <= 12 && /^[a-z1-5.]+$/.test(account);

export function BuyRamCard({ config, pricePerByte, onComplete }: BuyRamCardProps) {
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

  const desiredBytes = Math.floor(parseFloat(bytesInput) || 0);

  // In bytes mode the CHEESE spend is derived from the target byte amount
  // (rounded up to token precision so the contract can cover the request).
  const cheese = useMemo(() => {
    if (mode === 'cheese') return parseFloat(amount) || 0;
    const derived = estimateCheeseForTargetBytes(desiredBytes, config, pricePerByte);
    if (!derived) return 0;
    return Math.ceil(derived.cheese * 10000) / 10000;
  }, [mode, amount, desiredBytes, config, pricePerByte]);

  const estimate = estimateBytesForCheese(cheese, config, pricePerByte);
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
    <div className="rounded-2xl p-6 max-w-2xl w-full bg-card border border-border/50 space-y-5">
      <div className="flex items-center gap-2">
        <OpenMojiIcon emoji="💾" size={22} />
        <h2 className="text-xl font-bold">
          <span className="text-cheese">Buy</span> <span className="text-foreground">RAM</span>
        </h2>
      </div>

      <CheeseInput
        value={amount}
        onChange={setAmount}
        balance={cheeseBalance}
        label="You spend"
      />

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          Limits: {minCheese.toFixed(4)} – {maxCheese.toFixed(4)} CHEESE
        </span>
        <button
          type="button"
          onClick={() => setAmount(Math.min(cheeseBalance, maxCheese || cheeseBalance).toFixed(4))}
          className="text-primary hover:underline font-medium"
        >
          Max
        </button>
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
        <p className="text-[11px] text-muted-foreground pt-1">
          Estimate only — the contract calculates the final amount at execution time.
        </p>
      </div>

      {belowMin && (
        <p className="text-xs text-destructive">Minimum purchase is {minCheese.toFixed(4)} CHEESE.</p>
      )}
      {aboveMax && (
        <p className="text-xs text-destructive">Maximum purchase is {maxCheese.toFixed(4)} CHEESE.</p>
      )}
      {insufficient && <p className="text-xs text-destructive">Insufficient CHEESE balance.</p>}
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
          I have read and agree to the <TermsDialog /> and understand the CHEESE I spend is nulled forever.
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
