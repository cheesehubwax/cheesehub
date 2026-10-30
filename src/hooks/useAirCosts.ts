// CHEESEAir cost and resource estimates, separate from allocation and signing.
import { useMemo } from 'react';
import { estimateNftResources, estimateRamAirdropResources, estimateResources, resourceWarnings, RAM_BYTES_PER_NFT, type ResourceWarning } from '@/lib/airdrop';
import { CHEESE_SYMBOL, CHEESE_RAM_CONTRACT, MIN_RAM_PURCHASE_CHEESE } from '@/lib/airdropCheese';
import { bytesPerCheese, ceilCheese, cheeseForBytes, cheeseForCpuUs, cpuUsPerCheese, formatCheese, weightCalibration, type ResourcePricing } from '@/lib/airdropResources';
import type { AccountResources, RamPrice } from '@/lib/airdropChain';
import type { useAirAllocation } from './useAirAllocation';
export const RAM_BYTES_PER_ROW = 276;
interface CostInput extends ReturnType<typeof useAirAllocation> {
  isRam: boolean; isNft: boolean; batchSize: number;
  ramPrice: RamPrice | undefined; pricing: ResourcePricing | undefined;
  resources: AccountResources | undefined; cheeseBalance: number | null;
  rowStats: { existing: number; checked: number; newRows: number; complete: boolean };
  mode: 'fixed' | 'equal' | 'prorata'; precision: number; sendSymbol: string; cpuPercent: number;
}
export function useAirCosts({ isRam, isNft, ramPurchases, batchSize, nftAssignments, recipients, ramPrice, rowStats, pricing, cheeseBalance, ramCheeseTotal, ramPoolWax, ramExcluded, ramLimits, mode, nftShortfall, nftAllocation, nftPoolSize, senderBalanceUnits, total, precision, sendSymbol, resources, cpuPercent }: CostInput) {
  /** RAM mode: every contract purchase is one action, so slices count too. */
  const ramPurchaseCount = ramPurchases.length;

  const estimate = useMemo(
    () =>
      isRam
        ? estimateRamAirdropResources(ramPurchaseCount, Math.max(1, batchSize))
        : isNft
          ? estimateNftResources(
              nftAssignments.length,
              Math.max(1, batchSize),
              ramPrice?.waxPerKb ?? 0.1,
            )
          : estimateResources(
              recipients.length,
              Math.max(1, batchSize),
              ramPrice?.waxPerNewRow ?? 0.028,
              rowStats.checked > 0 ? rowStats.newRows : null,
            ),
    [
      isRam,
      isNft,
      nftAssignments.length,
      recipients.length,
      ramPurchaseCount,
      batchSize,
      ramPrice,
      rowStats,
    ],
  );


  const warnings = useMemo(() => {
    if (isRam) {
      // RAM lands directly in each recipient's account, so the sender only
      // needs enough CHEESE — plus every purchase must obey the contract limits.
      const out: ResourceWarning[] = [];
      if (!pricing) {
        out.push({
          level: 'warn',
          message: `${CHEESE_SYMBOL} RAM pricing is unavailable right now, so amounts and costs cannot be quoted yet.`,
        });
      } else if (!pricing.ram.enabled) {
        out.push({
          level: 'error',
          message: `The ${CHEESE_RAM_CONTRACT} contract has RAM buying disabled right now, so RAM cannot be airdropped.`,
        });
      }
      if (cheeseBalance !== null && ramCheeseTotal > 0 && cheeseBalance < ramCheeseTotal) {
        out.push({
          level: 'error',
          message: `This RAM airdrop spends ${formatCheese(ramCheeseTotal)} ${CHEESE_SYMBOL} but your balance is ${formatCheese(cheeseBalance)} ${CHEESE_SYMBOL} (CPU/NET top-ups are extra).`,
        });
      }
      if (ramPoolWax && ramPoolWax.overBy > 0) {
        out.push({
          level: 'error',
          message: `This RAM airdrop needs about ${ramPoolWax.needed.toFixed(4)} WAX from the ${CHEESE_RAM_CONTRACT} pool, which can currently spend about ${ramPoolWax.spendable.toFixed(4)} WAX. Lower the amount or wait for the pool to refill.`,
        });
      }
      if (ramExcluded.belowMin > 0 && ramLimits) {
        out.push({
          level: 'warn',
          message: `${ramExcluded.belowMin} recipient${ramExcluded.belowMin === 1 ? '' : 's'} skipped: their share is below the ${formatCheese(ramLimits.minCheese)} ${CHEESE_SYMBOL} minimum per purchase. Raise the amount or deselect holders.`,
        });
      }

      if (ramExcluded.split > 0 && ramLimits) {
        out.push({
          level: 'warn',
          message: `${ramExcluded.split} recipient${ramExcluded.split === 1 ? '' : 's'} get more than the ${formatCheese(ramLimits.maxCheese)} ${CHEESE_SYMBOL} maximum per purchase, so their share is sent as several purchases (${ramPurchaseCount} purchases in total).`,
        });
      }

      return out;
    }
    if (isNft) {
      // NFTs come out of your own inventory: the only blocker is pool coverage.
      const out: ResourceWarning[] = [];
      if (nftAssignments.length === 0) {
        out.push({
          level: 'error',
          message:
            mode === 'fixed'
              ? 'Nobody is receiving an NFT yet. Pick a template you own, select recipients, and set how many NFTs each one gets.'
              : 'Nobody is receiving an NFT yet. Pick a template you own, select recipients, and enter the total number of NFTs to send.',
        });
        return out;
      }
      if (nftShortfall > 0) {
        out.push({
          level: 'error',
          message: `You need ${nftShortfall} more NFT${nftShortfall === 1 ? '' : 's'} of this template to give every selected recipient their share. Lower the amount per holder, deselect recipients, or pick a template you own more of.`,
        });
      }
      if (nftAllocation.capped) {
        out.push({
          level: 'warn',
          message: `You asked to send more NFTs than you hold, so the drop was capped at your ${nftPoolSize.toLocaleString()} NFT${nftPoolSize === 1 ? '' : 's'} of this template.`,
        });
      }
      if (nftAllocation.skipped > 0) {
        out.push({
          level: 'warn',
          message: `${nftAllocation.skipped.toLocaleString()} selected holder${nftAllocation.skipped === 1 ? '' : 's'} get no NFT because their share rounds down to zero. Raise the total or select fewer holders.`,
        });
      }
      return out;
    }
    // Resource shortfalls are handled with CHEESE top-ups, so only the token
    // balance is validated here.
    return resourceWarnings(
      estimate,
      null,
      senderBalanceUnits,
      total,
      precision,
      sendSymbol.toUpperCase(),
    );
  }, [
    isRam,
    pricing,
    cheeseBalance,
    ramCheeseTotal,
    ramExcluded,
    ramPurchaseCount,

    ramLimits,
    isNft,
    mode,
    ramPoolWax,
    nftShortfall,


    nftAssignments.length,
    nftAllocation.capped,
    nftAllocation.skipped,
    nftPoolSize,
    estimate,
    senderBalanceUnits,
    total,
    precision,
    sendSymbol,
  ]);
  const hasError = warnings.some((w) => w.level === 'error');

  // ---- CHEESE resource purchases ---------------------------------------
  const calibration = useMemo(
    () =>
      resources
        ? weightCalibration(resources)
        : { cpuUsPerWeightUnit: null, netBytesPerWeightUnit: null },
    [resources],
  );

  const recipientCount = isNft ? nftAssignments.length : recipients.length;

  /** CPU needed for one batch plus 20% headroom. */
  const cpuNeededUs = estimate.cpuPerTxUs * 1.2;
  const ramNeededBytes = estimate.maxNewRows * (isNft ? RAM_BYTES_PER_NFT : RAM_BYTES_PER_ROW);

  const cpuShortUs =
    resources && recipientCount > 0 ? Math.max(0, cpuNeededUs - resources.cpuAvailableUs) : 0;
  const ramShortBytes =
    resources && recipientCount > 0 ? Math.max(0, ramNeededBytes - resources.ramAvailableBytes) : 0;

  const suggestedCpuCheese = useMemo(
    () =>
      pricing && cpuShortUs > 0
        ? cheeseForCpuUs(cpuShortUs, pricing, calibration, cpuPercent)
        : null,
    [pricing, cpuShortUs, calibration, cpuPercent],
  );

  /** RAM is always purchased: at least the minimum, more when the drop needs it. */
  const requiredRamCheese = useMemo(() => {
    // In RAM mode the drop itself buys RAM for the recipients; the sender's own
    // account needs no extra RAM.
    if (isRam || !pricing) return null;
    const needed = ramShortBytes > 0 ? cheeseForBytes(ramShortBytes, pricing) : 0;
    return ceilCheese(Math.max(MIN_RAM_PURCHASE_CHEESE, needed ?? 0, pricing.ram.minCheese));
  }, [isRam, pricing, ramShortBytes]);


  const cheesePerCpuMs = useMemo(() => {
    if (!pricing) return null;
    const per = cpuUsPerCheese(pricing, calibration, cpuPercent);
    if (!per || per <= 0) return null;
    return 1000 / per;
  }, [pricing, calibration, cpuPercent]);

  const cheesePerRamKb = useMemo(() => {
    if (!pricing) return null;
    const per = bytesPerCheese(pricing);
    if (!per || per <= 0) return null;
    return 1024 / per;
  }, [pricing]);

  const estCpuCheese = useMemo(
    () =>
      pricing && recipientCount > 0
        ? cheeseForCpuUs(cpuNeededUs, pricing, calibration, cpuPercent)
        : null,
    [pricing, cpuNeededUs, calibration, cpuPercent, recipientCount],
  );
  const estRamCheese = useMemo(
    () => (pricing && ramNeededBytes > 0 ? cheeseForBytes(ramNeededBytes, pricing) : null),
    [pricing, ramNeededBytes],
  );

  return { ramPurchaseCount, estimate, warnings, hasError, recipientCount, suggestedCpuCheese, requiredRamCheese, cheesePerCpuMs, cheesePerRamKb, estCpuCheese, estRamCheese };
}
