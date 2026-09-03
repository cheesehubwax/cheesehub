// Optional mini CHEESERam sell box for CHEESEAir — sell leftover RAM back for $CHEESE.
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TermsCheckbox } from '@/components/shared/TermsCheckbox';
import { OpenMojiIcon } from '@/components/OpenMojiIcon';
import { formatBytes } from '@/components/wallet/WalletResources';
import { refreshResourceGauges } from '@/components/shared/ResourceGauges';
import { useWax } from '@/context/WaxContext';
import { useTransactionSuccess } from '@/context/TransactionSuccessContext';
import { closeWharfkitModals, getTransactPlugins, parseTransactError } from '@/lib/wharfKit';
import {
  useAccountRam,
  useCheeseRamConfig,
  useCheeseRamReserves,
  useRamPrice,
} from '@/hooks/useCheeseRam';
import { useCheesePriceData } from '@/hooks/useCheesePriceData';
import {
  CHEESE_RAM_CONTRACT,
  SELL_MEMO,
  estimateCheeseForBytes,
  findRecentSell,
  pollForConfirmation,
  resolveQuoteRate,
} from '@/lib/cheeseRam';
import { UnconfirmedNotice, type UnconfirmedState } from '@/components/ram/UnconfirmedNotice';

const BYTES_PER_KB = 1024;

export function AirSellRamCard() {
  const { session, isConnected, accountName, login, refreshBalance } = useWax();
  const { showSuccess } = useTransactionSuccess();

  const { data: config } = useCheeseRamConfig();
  const { data: reserves, refetch: refetchReserves } = useCheeseRamReserves();
  const { pricePerByte, cheesePerKb, refetch: refetchRamPrice } = useRamPrice();
  const { data: accountRam, refetch: refetchAccountRam } = useAccountRam(accountName);
  const { data: cheesePrice } = useCheesePriceData();

  const [kbInput, setKbInput] = useState('');
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [isTransacting, setIsTransacting] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState<UnconfirmedState | null>(null);

  const timersRef = useRef<number[]>([]);
  useEffect(
    () => () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current = [];
    },
    [],
  );

  const liveWaxPerCheese =
    cheesePrice?.waxPrice && cheesePrice.waxPrice > 0 ? cheesePrice.waxPrice : null;
  const availableBytes = accountRam ? Math.max(0, accountRam.quota - accountRam.usage) : 0;
  const availableKb = availableBytes / BYTES_PER_KB;

  const kb = parseFloat(kbInput);
  const bytes = Number.isFinite(kb) && kb > 0 ? Math.floor(kb * BYTES_PER_KB) : 0;

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
    !!estimate &&
    !!reserves &&
    (reserves.cheesePool < estimate.cheese ||
      (config ? reserves.cheesePool < config.minCheesePool : false));

  const canSubmit =
    !isTransacting &&
    !unconfirmed &&
    !sellDisabled &&
    termsAgreed &&
    bytes > 0 &&
    !belowMin &&
    !aboveMax &&
    !exceedsAvailable;

  const refreshAll = useCallback(() => {
    refetchAccountRam();
    refetchReserves();
    refetchRamPrice();
    refreshBalance?.();
    refreshResourceGauges();
  }, [refetchAccountRam, refetchReserves, refetchRamPrice, refreshBalance]);

  const refreshStaggered = useCallback(() => {
    refreshAll();
    [1500, 4000, 8000].forEach((delay) => {
      const id = window.setTimeout(refreshAll, delay);
      timersRef.current.push(id);
    });
  }, [refreshAll]);

  const finishSuccess = (txId: string, soldBytes: number) => {
    showSuccess(
      'RAM Sold!',
      `Sold ${formatBytes(soldBytes)} of RAM for ~${(estimate?.cheese ?? 0).toFixed(4)} CHEESE.`,
      txId,
    );
    setKbInput('');
    setTermsAgreed(false);
    setUnconfirmed(null);
    refreshStaggered();
  };

  /** Verify on-chain before letting the user retry an ambiguous sale. */
  const resolveUnconfirmed = async (
    account: string,
    soldBytes: number,
    startedAt: number,
    knownTxId: string | null,
  ) => {
    const detail = `You signed a transfer of ${soldBytes.toLocaleString()} bytes of RAM to ${CHEESE_RAM_CONTRACT}.`;
    setUnconfirmed({ checking: true, account, detail });

    const match = knownTxId
      ? { txId: knownTxId, timestamp: startedAt }
      : await pollForConfirmation(() => findRecentSell(account, soldBytes, startedAt));

    if (match) {
      finishSuccess(match.txId, soldBytes);
      return;
    }

    setUnconfirmed({ checking: false, account, detail });
    refreshStaggered();
  };

  const handleSell = async () => {
    if (!isConnected || !session) {
      await login();
      return;
    }
    if (!canSubmit) return;

    const account = String(session.actor);
    const soldBytes = bytes;
    const startedAt = Date.now();

    setIsTransacting(true);
    try {
      const action = {
        account: 'eosio',
        name: 'ramtransfer',
        authorization: [session.permissionLevel],
        data: {
          from: account,
          to: CHEESE_RAM_CONTRACT,
          bytes: soldBytes,
          memo: SELL_MEMO,
        },
      };

      const result = await session.transact(
        { actions: [action] },
        { transactPlugins: getTransactPlugins(session) },
      );
      const txId = result.resolved?.transaction.id?.toString() ?? null;
      if (!txId) {
        await resolveUnconfirmed(account, soldBytes, startedAt, null);
        return;
      }

      finishSuccess(txId, soldBytes);
    } catch (error) {
      console.error('[CHEESEAir] Sell RAM failed:', error);
      const info = parseTransactError(error);
      if (info.type === 'unconfirmed') {
        await resolveUnconfirmed(account, soldBytes, startedAt, info.txId ?? null);
        return;
      }
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
    <div className="rounded-2xl p-6 w-full bg-card border border-border/50 space-y-5">
      <div className="flex items-center gap-2">
        <OpenMojiIcon emoji="📤" size={22} />
        <h2 className="text-xl font-bold">
          <span className="text-cheese">Sell</span>{' '}
          <span className="text-foreground">RAM for CHEESE</span>
        </h2>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/50 leading-none">
          OPTIONAL
        </span>
      </div>

      <p className="text-xs text-muted-foreground">
        Left over with unused RAM after your airdrop? Sell it straight back to the{' '}
        <a
          href={`https://waxblock.io/account/${CHEESE_RAM_CONTRACT}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-cheese hover:underline"
        >
          {CHEESE_RAM_CONTRACT}
        </a>{' '}
        contract for $CHEESE — same pricing as CHEESERam.
      </p>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="p-3 bg-muted/50 rounded-lg">
          <p className="text-xs text-muted-foreground">Your free RAM</p>
          <p className="font-mono font-medium">
            {isConnected ? `${availableKb.toFixed(2)} KB` : '—'}
          </p>
          {isConnected && (
            <p className="text-[11px] text-muted-foreground font-mono">
              {availableBytes.toLocaleString()} bytes
            </p>
          )}
        </div>
        <div className="p-3 bg-muted/50 rounded-lg">
          <p className="text-xs text-muted-foreground">Current price</p>
          <p className="font-mono font-medium">
            {cheesePerKb !== null ? `${cheesePerKb.toFixed(4)} CHEESE / KB` : '—'}
          </p>
          <p className="text-[11px] text-muted-foreground font-mono">
            {rate ? `1 CHEESE = ${rate.toFixed(4)} WAX (${quoteRate?.live ? 'live' : 'contract'})` : '—'}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="air-sell-ram-kb">Amount of RAM to sell (KB)</Label>
        <div className="flex gap-2">
          <Input
            id="air-sell-ram-kb"
            type="number"
            min={0}
            step="0.01"
            placeholder="KB"
            value={kbInput}
            onChange={(e) => setKbInput(e.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => {
              const capBytes = Math.min(availableBytes, maxBytes || availableBytes);
              setKbInput((Math.floor(capBytes) / BYTES_PER_KB).toFixed(2));
            }}
            disabled={!isConnected || availableBytes <= 0}
          >
            Max
          </Button>
        </div>
        {(minBytes > 0 || maxBytes > 0) && (
          <p className="text-xs text-muted-foreground">
            Limits: {(minBytes / BYTES_PER_KB).toFixed(2)} – {(maxBytes / BYTES_PER_KB).toFixed(2)} KB
            {bytes > 0 && <> · selling {bytes.toLocaleString()} bytes</>}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-border/50 bg-secondary/20 p-4 space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Estimated return</span>
          <span className="font-mono font-bold text-primary">
            {estimate ? `${estimate.cheese.toFixed(4)} CHEESE` : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">WAX value of RAM</span>
          <span className="font-mono text-foreground">
            {estimate ? `${estimate.waxValue.toFixed(8)} WAX` : '—'}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground pt-1">
          Estimate only — the contract calculates the final payout at execution time.
        </p>
      </div>

      {quoteRate?.stale && (
        <p className="text-xs text-amber-500">
          The contract's oracle rate has drifted more than{' '}
          {(config?.maxDeviationPct ?? 0).toFixed(0)}% from the live market — quoting at the contract
          rate instead.
        </p>
      )}
      {belowMin && (
        <p className="text-xs text-destructive">
          Minimum sale is {(minBytes / BYTES_PER_KB).toFixed(2)} KB.
        </p>
      )}
      {aboveMax && (
        <p className="text-xs text-destructive">
          Maximum sale is {(maxBytes / BYTES_PER_KB).toFixed(2)} KB.
        </p>
      )}
      {exceedsAvailable && (
        <p className="text-xs text-destructive">
          You only have {availableKb.toFixed(2)} KB of free RAM.
        </p>
      )}
      {poolTooLow && (
        <p className="text-xs text-amber-500">
          The contract CHEESE pool may be too low to service this sale right now — try a smaller
          amount.
        </p>
      )}
      {sellDisabled && (
        <p className="text-xs text-destructive">RAM sales are currently disabled by the contract.</p>
      )}

      {unconfirmed && (
        <UnconfirmedNotice state={unconfirmed} onAcknowledge={() => setUnconfirmed(null)} />
      )}

      <TermsCheckbox
        id="air-terms-sell-ram"
        checked={termsAgreed}
        onCheckedChange={setTermsAgreed}
      />

      <Button
        onClick={handleSell}
        disabled={isConnected && !canSubmit}
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
      >
        {isTransacting || unconfirmed?.checking ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {unconfirmed?.checking ? 'Verifying…' : 'Selling RAM...'}
          </>
        ) : unconfirmed ? (
          'Awaiting your check'
        ) : !isConnected ? (
          'Connect Wallet'
        ) : (
          'Sell RAM for CHEESE'
        )}
      </Button>
    </div>
  );
}
