// CHEESEAir signing sequence and run lifecycle. All signing stays in useWaxTransaction.
import { useCallback, useRef, useState } from 'react';
import type { Session } from '@wharfkit/session';
import { useQueryClient } from '@tanstack/react-query';
import { useWaxTransaction } from '@/hooks/useWaxTransaction';
import { useTransactionSuccess } from '@/context/TransactionSuccessContext';
import { refreshResourceGauges } from '@/components/shared/ResourceGauges';
import { chunk, formatQuantity, formatUnits, type AirdropRecipient, type NftAssignment, type RamPurchase } from '@/lib/airdrop';
import { CHEESE_CONTRACT, CHEESE_CPU_CONTRACT, CHEESE_PRECISION, CHEESE_RAM_CONTRACT, CHEESE_SYMBOL, powerupMemo, ramMemo } from '@/lib/airdropCheese';
import { formatCheese, splitPurchases, type ResourcePricing } from '@/lib/airdropResources';
import type { CsvBatchItem } from '@/lib/airdropCsv';
import { cheeseBalanceUnits, cheeseBudgetUnits } from '@/lib/airdropBudget';
const ATOMICASSETS_CONTRACT = 'atomicassets';
export function shortError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return (msg.match(/"message":"([^"]+)"/)?.[1] ?? msg).slice(0, 300);
}
export interface PurchaseLogEntry { kind: 'cpu' | 'ram'; cheese: number; txId?: string; error?: string; }
export interface BatchLogEntry { batch: number; recipients: number; txId?: string; error?: string; items?: CsvBatchItem[]; }
interface RunnerInput {
  session: Session | null; actor: string | null; cheeseBalance: number | null;
  isRam: boolean; isNft: boolean; hasError: boolean;
  nftAssignments: NftAssignment[]; nftShortfall: number;
  recipients: AirdropRecipient[]; ramPurchases: RamPurchase[]; ramCheeseTotal: number;
  pricing: ResourcePricing | undefined;
  suggestedCpuCheese: number | null; requiredRamCheese: number | null;
  cpuPercent: number; batchSize: number; memo: string; sendContract: string; sendSymbol: string; precision: number;
  tokenStat: { precision: number; supply: string } | null;
  refetchResources: () => Promise<unknown>;
  refreshBalance: (() => Promise<void>) | undefined;
}
export function useAirdropRunner({ session, actor, cheeseBalance, isRam, isNft, hasError, nftAssignments, nftShortfall, recipients, ramPurchases, ramCheeseTotal, pricing, suggestedCpuCheese, requiredRamCheese, cpuPercent, batchSize, memo, sendContract, sendSymbol, precision, tokenStat, refetchResources, refreshBalance }: RunnerInput) {
  const { executeTransaction } = useWaxTransaction(session);
  const { showSuccess } = useTransactionSuccess();
  const queryClient = useQueryClient();
  // ---- Run state --------------------------------------------------------
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [runState, setRunState] = useState<'idle' | 'running' | 'done'>('idle');
  const [runError, setRunError] = useState<string | null>(null);
  const [purchaseLog, setPurchaseLog] = useState<PurchaseLogEntry[]>([]);
  const [batchLog, setBatchLog] = useState<BatchLogEntry[]>([]);
  const [cancelRequested, setCancelRequested] = useState(false);
  const cancelRef = useRef(false);
  const runLogRef = useRef<BatchLogEntry[]>([]);
  const inFlightRef = useRef(false);


  const refreshAccount = useCallback(async () => {
    await Promise.all([refetchResources(), refreshBalance?.()]);
    refreshResourceGauges();
  }, [refetchResources, refreshBalance]);

  /** Sign one or more CHEESE transfers to a resource contract. True on full success. */
  const buyWithCheese = useCallback(
    async (kind: 'cpu' | 'ram', amounts: number[]): Promise<boolean> => {
      if (!session || !actor || amounts.length === 0) return false;
      const to = kind === 'cpu' ? CHEESE_CPU_CONTRACT : CHEESE_RAM_CONTRACT;
      const memoText =
        kind === 'cpu' ? powerupMemo(actor, cpuPercent) : ramMemo(actor, true);
      setBusy(kind === 'cpu' ? 'buy-cpu' : 'buy-ram');
      let ok = true;
      try {
        for (let i = 0; i < amounts.length; i += 1) {
          const cheese = amounts[i];
          if (cheese === undefined || cheese <= 0) continue;
          const result = await executeTransaction(
            [
              {
                account: CHEESE_CONTRACT,
                name: 'transfer',
                authorization: [session.permissionLevel],
                data: {
                  from: actor,
                  to,
                  quantity: `${formatCheese(cheese)} ${CHEESE_SYMBOL}`,
                  memo: memoText,
                },
              },
            ],
            { showSuccessToast: false, showErrorToast: true, errorTitle: 'Resource purchase failed' },
          );
          if (result.success && result.txId) {
            setPurchaseLog((prev) => [...prev, { kind, cheese, txId: result.txId ?? undefined }]);
          } else {
            ok = false;
            setPurchaseLog((prev) => [
              ...prev,
              { kind, cheese, error: shortError(result.error ?? new Error('Transaction failed')) },
            ]);
            break;
          }
          if (i < amounts.length - 1) await new Promise((r) => setTimeout(r, 1200));
        }
      } finally {
        setBusy(null);
      }
      // Give the chain a moment to apply the powerup / RAM purchase, then re-read.
      await new Promise((r) => setTimeout(r, 3000));
      await refreshAccount();
      return ok;
    },
    [session, actor, cpuPercent, executeTransaction, refreshAccount],
  );

  const requestCancel = useCallback(() => {
    cancelRef.current = true;
    setCancelRequested(true);
  }, []);

  /** Record a batch result in both the ref (for the summary) and the visible log. */
  const appendBatch = useCallback((entry: BatchLogEntry) => {
    runLogRef.current = [...runLogRef.current, entry];
    setBatchLog((prev) => [...prev, entry]);
  }, []);

  /** Close out a run and show the standard CheeseHub transaction confirmation. */
  const finishRun = useCallback(
    (kind: 'token' | 'nft' | 'ram') => {
      setRunState('done');
      const entries = runLogRef.current;
      const confirmed = entries.filter((b) => b.txId);
      if (confirmed.length === 0) return;
      const delivered = confirmed.reduce((s, b) => s + b.recipients, 0);
      const noun = kind === 'nft' ? 'NFT transfer' : kind === 'ram' ? 'RAM purchase' : 'transfer';
      const failed = entries.length - confirmed.length;
      showSuccess(
        'Airdrop Complete!',
        `${delivered.toLocaleString()} ${noun}${delivered === 1 ? '' : 's'} sent across ${confirmed.length} transaction${confirmed.length === 1 ? '' : 's'}${failed > 0 ? ` · ${failed} batch${failed === 1 ? '' : 'es'} failed` : ''}.`,
        confirmed[confirmed.length - 1]?.txId ?? null,
      );
    },
    [showSuccess],
  );


  const canRun =
    !!session &&
    termsAccepted &&
    !hasError &&
    runState !== 'running' &&
    busy === null &&
    (isNft
      ? nftAssignments.length > 0 && nftShortfall === 0
      : isRam
        ? recipients.length > 0 && !!pricing?.ram.enabled
        : recipients.length > 0 && tokenStat !== null);

  const runAirdrop = useCallback(async () => {
    if (!canRun || inFlightRef.current) return;
    if (!session || !actor) return;
    if (isNft ? nftAssignments.length === 0 || nftShortfall > 0 : recipients.length === 0) return;
    inFlightRef.current = true;
    try {

    setBatchLog([]);
    setPurchaseLog([]);
    setRunError(null);

    // Every airdrop buys RAM with CHEESE first; CPU/NET only when short.
    if (!pricing) {
      setRunError(
        `${CHEESE_SYMBOL} resource pricing is unavailable right now, so the required RAM purchase cannot be made. Try again in a moment.`,
      );
      return;
    }
    if (!pricing.ram.enabled) {
      setRunError(
        `The ${CHEESE_RAM_CONTRACT} contract has RAM buying disabled right now, so RAM cannot be bought. Try again later.`,
      );
      return;
    }
    if (!isRam && requiredRamCheese === null) throw new Error('CHEESE RAM pricing is unavailable; try again later');
    // Validate the entire plan before the first paid CPU/RAM request.
    const ramTopups = isRam ? [] : splitPurchases(requiredRamCheese ?? 0, pricing.ram.minCheese, pricing.ram.maxCheese);
    const budget = cheeseBudgetUnits({ isRam, isNft, sendContract, sendSymbol, precision, recipients, ramPurchases, ramTopups, cpuCheese: suggestedCpuCheese });
    const available = cheeseBalanceUnits(cheeseBalance);
    if (available === null) throw new Error('Your CHEESE balance could not be safely verified. Refresh your wallet before sending.');
    if (available < budget) throw new Error(`This airdrop needs ${formatUnits(budget, CHEESE_PRECISION)} CHEESE for delivery and resources together, but your balance is ${formatUnits(available, CHEESE_PRECISION)} CHEESE.`);
    if (isRam) {
      // The drop itself is the RAM purchase: no sender RAM buy, only CPU/NET.
      const needed = ramCheeseTotal + (suggestedCpuCheese ?? 0);
      if (cheeseBalance !== null && cheeseBalance < needed) {
        setRunError(
          `This RAM airdrop needs ${formatCheese(needed)} ${CHEESE_SYMBOL} (including CPU/NET top-ups), but your balance is ${formatCheese(cheeseBalance)} ${CHEESE_SYMBOL}.`,
        );
        return;
      }
      if (suggestedCpuCheese) {
        const ok = await buyWithCheese('cpu', [suggestedCpuCheese]);
        if (!ok) return;
      }
    } else {
      if (requiredRamCheese === null) {
        setRunError(
          `${CHEESE_SYMBOL} resource pricing is unavailable right now, so the required RAM purchase cannot be made. Try again in a moment.`,
        );
        return;
      }
      const totalNeeded = requiredRamCheese + (suggestedCpuCheese ?? 0);
      if (cheeseBalance !== null && cheeseBalance < totalNeeded) {
        setRunError(
          `This airdrop requires ${formatCheese(totalNeeded)} ${CHEESE_SYMBOL} of resources (including the ${formatCheese(requiredRamCheese)} ${CHEESE_SYMBOL} RAM purchase), but your balance is ${formatCheese(cheeseBalance)} ${CHEESE_SYMBOL}.`,
        );
        return;
      }
      if (suggestedCpuCheese) {
        const ok = await buyWithCheese('cpu', [suggestedCpuCheese]);
        if (!ok) return;
      }
      const ramOk = await buyWithCheese(
        'ram',
        ramTopups,
      );
      if (!ramOk) return;
    }

    setRunState('running');
    setBatchLog([]);
    runLogRef.current = [];
    setCancelRequested(false);
    cancelRef.current = false;

    if (isRam) {
      // One CHEESE transfer per purchase: ram.chz buys RAM into the memo account.
      // A share above the per-purchase maximum is delivered as several purchases.
      const batches = chunk(ramPurchases, Math.max(1, batchSize));

      for (let i = 0; i < batches.length; i += 1) {
        if (cancelRef.current) {
          appendBatch({ batch: i + 1, recipients: 0, error: 'Cancelled by user' });
          break;
        }
        const batch = batches[i];
        if (!batch) continue;
        const result = await executeTransaction(
          batch.map((r) => ({
            account: CHEESE_CONTRACT,
            name: 'transfer',
            authorization: [session.permissionLevel],
            data: {
              from: actor,
              to: CHEESE_RAM_CONTRACT,
              quantity: formatQuantity(r.units, CHEESE_PRECISION, CHEESE_SYMBOL),
              memo: r.account === actor ? '' : r.account,
            },
          })),
          { showSuccessToast: false, showErrorToast: false },
        );
        appendBatch(
          result.success && result.txId
            ? {
                batch: i + 1,
                recipients: batch.length,
                txId: result.txId ?? undefined,
                items: batch.map((r) => ({ account: r.account, units: r.units })),
              }
            : {
                batch: i + 1,
                recipients: batch.length,
                error: shortError(result.error ?? new Error('Transaction failed')),
                items: batch.map((r) => ({ account: r.account, units: r.units })),
              },
        );
        if (i < batches.length - 1) await new Promise((r) => setTimeout(r, 1200));
      }
      finishRun('ram');
      void refreshAccount();
      return;
    }



    if (isNft) {
      const batches = chunk(nftAssignments, Math.max(1, batchSize));
      for (let i = 0; i < batches.length; i += 1) {
        if (cancelRef.current) {
          appendBatch({ batch: i + 1, recipients: 0, error: 'Cancelled by user' });
          break;
        }
        const batch = batches[i];
        if (!batch) continue;
        const result = await executeTransaction(
          batch.map((a) => ({
            account: ATOMICASSETS_CONTRACT,
            name: 'transfer',
            authorization: [session.permissionLevel],
            data: { from: actor, to: a.account, asset_ids: a.assetIds, memo },
          })),
          { showSuccessToast: false, showErrorToast: false },
        );
        appendBatch(
          result.success && result.txId
            ? {
                batch: i + 1,
                recipients: batch.length,
                txId: result.txId ?? undefined,
                items: batch.map((a) => ({ account: a.account, assetIds: a.assetIds })),
              }
            : {
                batch: i + 1,
                recipients: batch.length,
                error: shortError(result.error ?? new Error('Transaction failed')),
                items: batch.map((a) => ({ account: a.account, assetIds: a.assetIds })),
              },
        );
        if (i < batches.length - 1) await new Promise((r) => setTimeout(r, 1200));
      }
      finishRun('nft');
      void refreshAccount();
      void queryClient.invalidateQueries({ queryKey: ['air-inventory-assets'] });
      return;
    }

    const batches = chunk(recipients, Math.max(1, batchSize));
    for (let i = 0; i < batches.length; i += 1) {
      if (cancelRef.current) {
        appendBatch({ batch: i + 1, recipients: 0, error: 'Cancelled by user' });
        break;
      }
      const batch = batches[i];
      if (!batch) continue;
      const result = await executeTransaction(
        batch.map((r) => ({
          account: sendContract,
          name: 'transfer',
          authorization: [session.permissionLevel],
          data: {
            from: actor,
            to: r.account,
            quantity: formatQuantity(r.units, precision, sendSymbol.toUpperCase()),
            memo,
          },
        })),
        { showSuccessToast: false, showErrorToast: false },
      );
      appendBatch(
        result.success && result.txId
          ? {
              batch: i + 1,
              recipients: batch.length,
              txId: result.txId ?? undefined,
              items: batch.map((r) => ({ account: r.account, units: r.units })),
            }
          : {
              batch: i + 1,
              recipients: batch.length,
              error: shortError(result.error ?? new Error('Transaction failed')),
              items: batch.map((r) => ({ account: r.account, units: r.units })),
            },
      );
      if (i < batches.length - 1) await new Promise((r) => setTimeout(r, 1200));
    }

    finishRun('token');
    void refreshAccount();
    void queryClient.invalidateQueries({ queryKey: ['air-wallet-tokens'] });
    } catch (error) {
      setRunError(shortError(error));
      setRunState(runLogRef.current.length > 0 ? 'done' : 'idle');
    } finally {
      inFlightRef.current = false;
    }
  }, [
    canRun,
    appendBatch,
    finishRun,

    session,
    actor,
    isNft,
    isRam,
    ramCheeseTotal,

    nftAssignments,
    nftShortfall,
    recipients,
    ramPurchases,

    pricing,
    requiredRamCheese,
    suggestedCpuCheese,
    cheeseBalance,
    buyWithCheese,
    batchSize,
    executeTransaction,
    memo,
    sendContract,
    sendSymbol,
    precision,
    refreshAccount,
    queryClient,
  ]);

  return { termsAccepted, setTermsAccepted, busy, setBusy, runState, setRunState, runError, purchaseLog, batchLog, setBatchLog, cancelRequested, requestCancel, canRun, runAirdrop };
}
