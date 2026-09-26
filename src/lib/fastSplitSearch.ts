// Faster, result-identical version of the Alcor SDK's `Trade.bestTradeWithSplit`
// (@alcorexchange/alcor-swap-sdk 1.1.5, JS path).
//
// The SDK explores exactly the same search tree, but every step adds and
// compares `CurrencyAmount` fraction objects and copies the whole route list.
// Here each quote is reduced once to its raw integer amount (all per-route
// quotes are whole token units, so this is exact), sums/compares are plain
// bigints, and states keep a parent link instead of an array copy. The order
// in which candidates are visited, the tie-breaking and the stop rules are
// unchanged, so the chosen split is identical. Covered by a parity test.

import { Trade, TradeType, CurrencyAmount } from "@alcorexchange/alcor-swap-sdk";

type Quote = { percent: number; route: any; inputAmount: any; outputAmount: any };

function rawOf(amount: any): bigint {
  // Whole-unit amounts (denominator 1) — exactly what pool quotes produce.
  const q = amount.quotient;
  return typeof q === "bigint" ? q : BigInt(q.toString());
}

function isWhole(amount: any): boolean {
  const d = amount.denominator ?? amount.fraction?.denominator;
  if (d === undefined) return false;
  return String(d) === "1";
}

interface Node {
  quote: Quote;
  parent: Node | null;
  len: number;
}

interface State {
  node: Node;
  percentIndex: number;
  remainingPercent: number;
  usedMask: bigint;
  quoteSoFar: bigint;
}

/**
 * Returns the same Trade as `Trade.bestTradeWithSplit(routes, amount, percents,
 * tradeType, swapConfig)`, or `undefined` if the inputs can't be handled
 * exactly (caller then falls back to the SDK).
 */
export function fastBestTradeWithSplit(
  _routes: any[],
  amount: any,
  percents: number[],
  tradeType: TradeType,
  swapConfig: { minSplits: number; maxSplits: number } = { minSplits: 1, maxSplits: 10 },
): any | null | undefined {
  if (_routes.length === 0 || percents.length === 0) return undefined;
  const exactIn = tradeType === TradeType.EXACT_INPUT;

  const validRoutes = _routes.filter((route) =>
    route.pools.every((pool: any) => pool.active && (pool.tickDataProvider?.ticks?.length ?? 0) > 0),
  );
  const routeMinLiq = new Map<any, any>();
  for (const route of validRoutes) {
    let min = route.pools[0].liquidity;
    for (let i = 1; i < route.pools.length; i++) if (route.pools[i].liquidity < min) min = route.pools[i].liquidity;
    routeMinLiq.set(route, min);
  }
  validRoutes.sort((a, b) => {
    const la = routeMinLiq.get(a);
    const lb = routeMinLiq.get(b);
    if (la > lb) return -1;
    if (la < lb) return 1;
    return 0;
  });

  const percentToAmount = new Map<number, any>();
  for (const percent of percents) percentToAmount.set(percent, amount.multiply(percent).divide(100));

  const quoteRoute = (route: any, splitAmount: any, percent: number): Quote | null => {
    const n = route.tokenPath.length;
    const amounts = new Array(n);
    let inputAmount;
    let outputAmount;
    if (exactIn) {
      amounts[0] = splitAmount;
      for (let i = 0; i < n - 1; i++) amounts[i + 1] = route.pools[i].getOutputAmount(amounts[i]);
      inputAmount = splitAmount;
      outputAmount = amounts[n - 1];
    } else {
      amounts[n - 1] = splitAmount;
      for (let i = n - 1; i > 0; i--) amounts[i - 1] = route.pools[i - 1].getInputAmount(amounts[i]);
      inputAmount = amounts[0];
      outputAmount = splitAmount;
    }
    if (!outputAmount.greaterThan(0)) return null;
    return { percent, route, inputAmount, outputAmount };
  };

  const percentToQuotes: Record<number, Quote[]> = {};
  for (const percent of percents) percentToQuotes[percent] = [];
  for (const route of validRoutes) {
    for (const percent of percents) {
      try {
        const q = quoteRoute(route, percentToAmount.get(percent), percent);
        if (q) percentToQuotes[percent].push(q);
      } catch (error: any) {
        if (error?.isInsufficientReservesError || error?.isInsufficientInputAmountError) continue;
        throw error;
      }
    }
  }

  // ----- getBestSwapRoute (branchFactor 1, no candidate limit) -----
  const { minSplits, maxSplits } = swapConfig;
  const value = new Map<Quote, bigint>();
  for (const percent of percents) {
    for (const q of percentToQuotes[percent]) {
      const amt = exactIn ? q.outputAmount : q.inputAmount;
      if (!isWhole(amt)) return undefined; // not exactly representable — use the SDK
      value.set(q, rawOf(amt));
    }
  }
  const better = exactIn ? (a: bigint, b: bigint) => a > b : (a: bigint, b: bigint) => a < b;

  const poolToBit = new Map<unknown, bigint>();
  let bit = 0n;
  const keys = Object.keys(percentToQuotes); // same key order as the SDK
  for (const k of keys) {
    for (const q of percentToQuotes[Number(k)]) {
      for (const pool of q.route.pools) {
        if (!poolToBit.has(pool.id)) {
          poolToBit.set(pool.id, 1n << bit);
          bit += 1n;
        }
      }
    }
  }
  const mask = new Map<Quote, bigint>();
  for (const k of keys) {
    for (const q of percentToQuotes[Number(k)]) {
      let m = 0n;
      for (const pool of q.route.pools) m |= poolToBit.get(pool.id)!;
      mask.set(q, m);
    }
  }

  const sorted: Record<number, Quote[]> = {};
  const sortedVals: Record<number, bigint[]> = {};
  const sortedMasks: Record<number, bigint[]> = {};
  for (const k of keys) {
    const p = Number(k);
    const s = percentToQuotes[p].sort((a, b) => (better(value.get(a)!, value.get(b)!) ? -1 : 1));
    sorted[p] = s;
    sortedVals[p] = s.map((q) => value.get(q)!);
    sortedMasks[p] = s.map((q) => mask.get(q)!);
  }

  let bestQuote: bigint | undefined;
  let bestNode: Node | undefined;
  const s100 = sorted[100];
  if ((!s100 || s100.length === 0) && minSplits <= 1) {
    // SDK logs here; nothing to do.
  } else if (minSplits <= 1 && s100 && s100[0]) {
    bestNode = { quote: s100[0], parent: null, len: 1 };
    bestQuote = sortedVals[100][0];
  }

  let queue: State[] = [];
  for (let i = percents.length - 1; i >= 0; i--) {
    const percent = percents[i];
    const c = sorted[percent];
    if (!c || c.length === 0) continue;
    queue.push({
      node: { quote: c[0], parent: null, len: 1 },
      percentIndex: i,
      remainingPercent: 100 - percent,
      usedMask: sortedMasks[percent][0],
      quoteSoFar: sortedVals[percent][0],
    });
  }

  let splits = 1;
  while (queue.length > 0) {
    splits++;
    if (splits >= 3 && bestNode && bestNode.len < splits - 1) break;
    if (splits > maxSplits) break;
    const next: State[] = [];
    for (let s = 0; s < queue.length; s++) {
      const { remainingPercent, node, percentIndex, usedMask, quoteSoFar } = queue[s];
      for (let i = percentIndex; i >= 0; i--) {
        const percent = percents[i];
        if (percent > remainingPercent) continue;
        const cMasks = sortedMasks[percent];
        if (!cMasks || cMasks.length === 0) continue;
        let idx = -1;
        for (let j = 0; j < cMasks.length; j++) {
          if ((cMasks[j] & usedMask) === 0n) {
            idx = j;
            break;
          }
        }
        if (idx < 0) continue;
        const remainingNew = remainingPercent - percent;
        const quoteNew = quoteSoFar + sortedVals[percent][idx];
        if (remainingNew === 0 && splits >= minSplits) {
          if (bestQuote === undefined || better(quoteNew, bestQuote)) {
            bestQuote = quoteNew;
            bestNode = { quote: sorted[percent][idx], parent: node, len: node.len + 1 };
          }
        } else {
          next.push({
            node: { quote: sorted[percent][idx], parent: node, len: node.len + 1 },
            remainingPercent: remainingNew,
            percentIndex: i,
            usedMask: usedMask | cMasks[idx],
            quoteSoFar: quoteNew,
          });
        }
      }
    }
    queue = next;
  }

  if (!bestNode) return null;
  const best: Quote[] = [];
  for (let n: Node | null = bestNode; n; n = n.parent) best.unshift(n.quote);

  const routes = best.map(({ inputAmount, outputAmount, route, percent }) => ({
    inputAmount,
    outputAmount,
    route,
    percent,
  }));
  if (exactIn) {
    let total = CurrencyAmount.fromRawAmount(routes[0].route.input, 0);
    for (const r of routes) total = total.add(r.inputAmount);
    const missing = amount.subtract(total);
    if (missing.greaterThan(0)) routes[0].inputAmount = routes[0].inputAmount.add(missing);
  }
  return new (Trade as any)({ routes, tradeType });
}
