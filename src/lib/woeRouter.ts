// WaxOnEdge (WoE) DEX aggregator adapter.
//
// Wire format was recovered from the @waxonedge/swap npm package (dist/vueless.mjs)
// and confirmed against the live https://waxonedge.app UI. WoE's contract is `swap.we`.
//
// Request:
//   GET https://woe-api.neftyblocks.com/api/swap/routes
//     ?token_in=<TICKER>_<contract>
//     &token_out=<TICKER>_<contract>
//     &amount_in=<decimal>
//     &slippage=<basis points>            // 1% -> "100"
//     &receiver=<account>
//     &split_max_routes=<n>               // WoE UI default: 4
//     &filter_exchange=                   // "" = all exchanges allowed
//     &filter_type=                       // "" = all types
//     &chain=wax
//
// Response: array; first element (m[0]) has:
//   { amount_in, amount_received, actions: [{to, quantity, memo}, ...],
//     fees, platform_fees, minimum_received, price_impact, route_price }
//
// Signing (from the WoE component's "sign" event):
//   1. Prepend `{ account: "swap.we", name: "madeonwoe", data: {} }` marker.
//   2. For each entry in `actions`, emit a `transfer` on the INPUT token contract
//      with data { from: user, ...entry }. Each split is its own transfer.

import type { SwapAction, SwapRoute, SwapSplit, SwapToken } from "./swapApi";
import { formatTokenAmount } from "./swapApi";

const WOE_API = "https://woe-api.neftyblocks.com";

interface WoeAction {
  to: string;
  quantity: string; // "1.23456789 WAX"
  memo: string;
}

interface WoeRouteResponse {
  amount_in: string | number;
  amount_received: string | number;
  actions: WoeAction[];
  fees: number;
  platform_fees: number;
  minimum_received: string | number;
  price_impact: number;
  route_price: number;
}

function parseQuantityAmount(q: string): number {
  const n = parseFloat(String(q).trim().split(/\s+/)[0]);
  return Number.isFinite(n) ? n : 0;
}

export async function fetchWoeRoute(
  tokenIn: SwapToken,
  tokenOut: SwapToken,
  amount: string,
  slippage: number, // percent (e.g. 1 for 1%)
  receiver: string,
  signal?: AbortSignal,
  tradeType: "EXACT_INPUT" | "EXACT_OUTPUT" = "EXACT_INPUT"
): Promise<SwapRoute | null> {
  // WoE's public endpoint only supports exact-input routing. Signal a miss to
  // let the aggregator fall back to Alcor for exact-output quotes.
  if (tradeType !== "EXACT_INPUT") return null;

  const amountIn = formatTokenAmount(amount, tokenIn.precision);
  if (!(parseFloat(amountIn) > 0)) return null;

  const params = new URLSearchParams({
    token_in: `${tokenIn.ticker}_${tokenIn.contract}`,
    token_out: `${tokenOut.ticker}_${tokenOut.contract}`,
    amount_in: amountIn,
    slippage: Math.round(slippage * 100).toString(),
    receiver,
    split_max_routes: "4",
    filter_exchange: "",
    filter_type: "",
    chain: "wax",
  });

  let res: Response;
  try {
    res = await fetch(`${WOE_API}/api/swap/routes?${params}`, { signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new Error("Failed to fetch WoE route — network");
  }
  if (!res.ok) {
    if (res.status === 429) {
      throw new Error("Rate limited — please wait a moment and try again");
    }
    // Treat any 4xx/5xx as "no WoE route" so the aggregator can fall back.
    return null;
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return null;
  }

  const first: WoeRouteResponse | undefined = Array.isArray(data)
    ? (data[0] as WoeRouteResponse | undefined)
    : undefined;
  if (!first || !Array.isArray(first.actions) || first.actions.length === 0) {
    return null;
  }

  const totalIn = parseQuantityAmount(String(first.amount_in));

  const swaps: SwapSplit[] = first.actions.map((a) => {
    const splitIn = parseQuantityAmount(a.quantity);
    const percent = totalIn > 0 ? (splitIn / totalIn) * 100 : 100 / first.actions.length;
    return {
      percent,
      route: [], // WoE does not expose Alcor pool ids; the panel handles empty routes gracefully.
      input: String(splitIn),
      output: "",
      minReceived: "",
    };
  });

  return {
    source: "woe",
    output: Number(first.amount_received) || 0,
    minReceived: Number(first.minimum_received) || 0,
    priceImpact: Number(first.price_impact) || 0,
    memo: "", // WoE encodes routing in per-action memos, not a top-level memo.
    route: [], // Same reason as above.
    executionPrice: { numerator: "1", denominator: String(first.route_price || 1) },
    input: Number(first.amount_in) || undefined,
    swaps,
    woeActions: first.actions,
    fees: Number(first.fees) || 0,
    platformFees: Number(first.platform_fees) || 0,
  };
}

/** Build signable actions for a WoE-sourced route. */
export function buildWoeActions(
  route: SwapRoute,
  accountName: string,
  inputTokenContract: string
): SwapAction[] {
  const auth = [{ actor: accountName, permission: "active" as const }];
  const actions: SwapAction[] = [
    {
      account: "swap.we",
      name: "madeonwoe",
      authorization: auth,
      data: {},
    },
  ];
  const woeActions = route.woeActions ?? [];
  for (const a of woeActions) {
    actions.push({
      account: inputTokenContract,
      name: "transfer",
      authorization: auth,
      data: {
        from: accountName,
        to: a.to,
        quantity: a.quantity,
        memo: a.memo,
      },
    });
  }
  return actions;
}