// CHEESEAir allocation state derived without network or transaction side effects.
import { useCallback, useMemo } from 'react';
import { allocateAssets, computeAmounts, planRamPurchases, totalUnits, type AirdropRecipient, type DistributionMode, type NftAssignment, type RamPurchase } from '@/lib/airdrop';
import { CHEESE_PRECISION } from '@/lib/airdropCheese';
import { bytesPerCheese, ceilCheese, cheeseForBytes, formatCheese, maxCheeseForPool, spendableWax, waxCostForCheese, RAM_MARGIN, type ResourcePricing } from '@/lib/airdropResources';
import type { Holder, HolderSnapshot } from '@/lib/airdropChain';

interface AllocationInput {
  actor: string | null;
  tokenStat: { precision: number; supply: string } | null;
  walletTokens: Array<{ contract: string; symbol: string; amount: number; precision: number }>;
  sendContract: string; sendSymbol: string; precision: number;
  pricing: ResourcePricing | undefined;
  ramUnit: 'cheese' | 'kb'; amountText: string;
  isRam: boolean; isNft: boolean;
  filteredHolders: Holder[]; selected: Set<string>;
  snapshot: HolderSnapshot | null; mode: DistributionMode; nftPool: string[];
  setAmountText: (value: string) => void;
}

export function useAirAllocation({ actor, tokenStat, walletTokens, sendContract, sendSymbol, precision, pricing, ramUnit, amountText, isRam, isNft, filteredHolders, selected, snapshot, mode, nftPool, setAmountText }: AllocationInput) {
  const senderBalanceUnits = useMemo(() => {
    if (!actor || !tokenStat) return null;
    const t = walletTokens.find(
      (w) => w.contract === sendContract && w.symbol === sendSymbol.toUpperCase(),
    );
    if (!t) return null;
    return BigInt(Math.round(t.amount * 10 ** precision));
  }, [actor, tokenStat, walletTokens, sendContract, sendSymbol, precision]);

  /** RAM contract limits per single purchase, in CHEESE. */
  const ramLimits = useMemo(
    () =>
      pricing ? { minCheese: pricing.ram.minCheese, maxCheese: pricing.ram.maxCheese } : null,
    [pricing],
  );

  /**
   * RAM amounts are always signed as CHEESE transfers, so a KB entry is
   * converted to CHEESE first (with the same safety margin as CHEESERam).
   */
  const ramCheeseText = useMemo(() => {
    if (ramUnit === 'cheese') return amountText;
    const kb = parseFloat(amountText);
    if (!pricing || !(kb > 0)) return '';
    const cheese = cheeseForBytes(kb * 1024, pricing);
    return cheese ? formatCheese(cheese) : '';
  }, [ramUnit, amountText, pricing]);

  const effPrecision = isRam ? CHEESE_PRECISION : precision;

  /** Holders ticked in the table — before any contract-limit filtering. */
  const chosenHolders = useMemo(
    () => filteredHolders.filter((h) => selected.has(h.account)),
    [filteredHolders, selected],
  );
  const selectedCount = chosenHolders.length;

  const { recipients, ramPurchases, ramPurchaseCounts, ramExcluded, ramBelowMin } = useMemo<{
    recipients: AirdropRecipient[];
    ramPurchases: RamPurchase[];
    ramPurchaseCounts: Map<string, number>;
    ramExcluded: { belowMin: number; split: number };
    /** RAM mode: selected accounts whose share is below the contract minimum. */
    ramBelowMin: AirdropRecipient[];
  }>(() => {
    const none = {
      recipients: [],
      ramPurchases: [],
      ramPurchaseCounts: new Map<string, number>(),
      ramExcluded: { belowMin: 0, split: 0 },
      ramBelowMin: [],
    };
    const text = isRam ? ramCheeseText : amountText;
    if (!snapshot || !text) return none;
    try {
      const all = computeAmounts(chosenHolders, mode, text, effPrecision);
      if (!isRam) return { ...none, recipients: all };
      const base = 10 ** CHEESE_PRECISION;
      const minUnits = ramLimits ? BigInt(Math.round(ramLimits.minCheese * base)) : 0n;
      const maxUnits = ramLimits ? BigInt(Math.round(ramLimits.maxCheese * base)) : 0n;
      const plan = planRamPurchases(all, minUnits, maxUnits);
      return {
        recipients: plan.included,
        ramPurchases: plan.purchases,
        ramPurchaseCounts: plan.purchaseCounts,
        ramExcluded: {
          belowMin: plan.belowMin.length,
          split: plan.splitCount,
        },
        ramBelowMin: plan.belowMin,
      };
    } catch {
      return none;
    }
  }, [
    snapshot,
    chosenHolders,
    mode,
    amountText,
    ramCheeseText,
    effPrecision,
    isRam,
    ramLimits,
  ]);


  const total = useMemo(() => totalUnits(recipients), [recipients]);

  /** RAM mode: CHEESE spent and the RAM it is expected to deliver. */
  const ramCheeseTotal = isRam ? Number(total) / 10 ** CHEESE_PRECISION : 0;
  const ramBytesTotal = useMemo(() => {
    if (!isRam || !pricing) return 0;
    const per = bytesPerCheese(pricing);
    return per ? ramCheeseTotal * per : 0;
  }, [isRam, pricing, ramCheeseTotal]);

  /**
   * RAM mode: the smallest amount (in the unit currently selected) that keeps
   * every ticked holder above the contract's per-purchase minimum. `null` when
   * it cannot be reached — e.g. a pro-rata split with zero-balance holders.
   */
  const ramMinViable = useMemo<{ cheese: number; text: string } | null>(() => {
    if (!isRam || !ramLimits || selectedCount === 0) return null;
    const min = ramLimits.minCheese;
    let cheese: number | null = null;
    if (mode === 'fixed') cheese = min;
    else if (mode === 'equal') cheese = min * selectedCount;
    else {
      const weights = chosenHolders.map((h) => h.weight);
      if (weights.some((w) => !(w > 0))) return null;
      const totalWeight = weights.reduce((s, w) => s + w, 0);
      const smallest = Math.min(...weights);
      if (!(totalWeight > 0) || !(smallest > 0)) return null;
      cheese = (min * totalWeight) / smallest;
    }
    if (cheese === null || !isFinite(cheese) || cheese <= 0) return null;
    const safeCheese = ceilCheese(cheese * 1.000002) ?? cheese;
    if (ramUnit === 'cheese') return { cheese: safeCheese, text: formatCheese(safeCheese) };
    const per = pricing ? bytesPerCheese(pricing) : null;
    if (!per || per <= 0) return null;
    const kb = Math.ceil(((safeCheese * per) / 1024) * 100) / 100;
    return { cheese: safeCheese, text: String(kb) };
  }, [isRam, ramLimits, selectedCount, mode, chosenHolders, ramUnit, pricing]);

  const applyRamMinViable = useCallback(() => {
    if (ramMinViable) setAmountText(ramMinViable.text);
  }, [ramMinViable]);

  /**
   * RAM mode: the WAX the CHEESERam pool would have to spend on this drop
   * against what it can actually release right now. `null` when unpriceable.
   */
  const ramPoolWax = useMemo<{ needed: number; spendable: number; overBy: number } | null>(() => {
    if (!isRam || !pricing || !(ramCheeseTotal > 0)) return null;
    const needed = waxCostForCheese(ramCheeseTotal, pricing);
    if (needed === null) return null;
    const spendable = spendableWax(pricing);
    return { needed, spendable, overBy: Math.max(0, needed - spendable) };
  }, [isRam, pricing, ramCheeseTotal]);

  /**
   * RAM mode: the largest amount (in the selected unit) the pool's spendable
   * WAX can cover. In fixed mode this is the per-holder figure.
   */
  const ramPoolMaxViable = useMemo<{ cheese: number; text: string } | null>(() => {
    if (!isRam || !pricing) return null;
    const maxTotal = maxCheeseForPool(pricing);
    if (maxTotal === null || !(maxTotal > 0)) return null;
    const divisor = mode === 'fixed' ? Math.max(1, selectedCount) : 1;
    const f = 10 ** CHEESE_PRECISION;
    const cheese = Math.floor((maxTotal / divisor) * f) / f;
    if (!(cheese > 0)) return null;
    if (ramUnit === 'cheese') return { cheese, text: formatCheese(cheese) };
    const per = bytesPerCheese(pricing);
    if (!per || per <= 0) return null;
    // Round down so converting back to CHEESE stays inside the pool limit.
    // KB entries convert back to CHEESE with RAM_MARGIN applied, so shave that
    // margin off here and round down — the refill must stay inside the pool.
    const kb = Math.floor((((cheese / RAM_MARGIN) * per) / 1024) * 100) / 100;
    if (!(kb > 0)) return null;
    return { cheese, text: String(kb) };
  }, [isRam, pricing, mode, ramUnit, selectedCount]);


  const applyRamPoolMax = useCallback(() => {
    if (ramPoolMaxViable) setAmountText(ramPoolMaxViable.text);
  }, [ramPoolMaxViable]);





  const nftAllocation = useMemo(
    () =>
      isNft
        ? allocateAssets(nftPool, chosenHolders, mode, amountText)
        : {
            assignments: [] as NftAssignment[],
            assigned: 0,
            skipped: 0,
            leftover: 0,
            shortfall: 0,
            capped: false,
          },
    [isNft, nftPool, chosenHolders, mode, amountText],
  );
  const nftAssignments = nftAllocation.assignments;
  const nftShortfall = nftAllocation.shortfall;
  const nftPoolSize = nftPool.length;


  return { senderBalanceUnits, ramLimits, ramCheeseText, chosenHolders, selectedCount, recipients, ramPurchases, ramPurchaseCounts, ramExcluded, ramBelowMin, total, ramCheeseTotal, ramBytesTotal, ramMinViable, applyRamMinViable, ramPoolWax, ramPoolMaxViable, applyRamPoolMax, nftAllocation, nftAssignments, nftShortfall, nftPoolSize };
}
