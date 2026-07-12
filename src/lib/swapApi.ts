// Alcor Exchange API layer for CHEESESwap
import { waxRpcCall } from "./waxRpcFallback";
import { markAlcorRateLimited } from "./alcorRouter";

export interface SwapToken {
  contract: string;
  ticker: string;
  precision: number;
  logo?: string;
  id?: string;
  system_price?: number;
  usd_price?: number;
}

export interface SwapAction {
  account: string;
  name: string;
  authorization: Array<{ actor: string; permission: string }>;
  data: Record<string, unknown>;
}

export interface SwapSplit {
  percent: number;
  route: number[];
  input: string;
  output: string;
  minReceived: string;
  /** Optional per-split memo. Present when quote comes from the split router. */
  memo?: string;
  /** Optional per-split maxSent (used for EXACT_OUTPUT). */
  maxSent?: string;
  /** Optional display-only token path emitted by the SDK quote. */
  visualPath?: AlcorPoolToken[];
  /** Optional display-only pool fees aligned with `route`. */
  visualFees?: number[];
}

export interface SwapRoute {
  output: number;
  minReceived: number;
  priceImpact: number;
  memo: string;
  route: number[];
  executionPrice: { numerator: string; denominator: string };
  input?: number;
  swaps: SwapSplit[];
  quoteSource?: "http" | "sdk";
  quoteComplete?: boolean;
  quoteDiagnostics?: {
    relevantPools?: number;
    poolsBuilt?: number;
    routesConsidered?: number;
    tickFailures?: number;
    rateLimitedTickFailures?: number;
    poolsDroppedNoTicks?: number;
    tookMs?: number;
  };
}

export interface AlcorPoolToken {
  id: string;
  symbol: string;
  contract: string;
  decimals: number;
}

export interface AlcorPool {
  id: number;
  fee: number;
  tokenA: AlcorPoolToken;
  tokenB: AlcorPoolToken;
}

const ALCOR_API = "https://wax.alcor.exchange/api/v2";

export const POPULAR_TICKERS = ["WAX", "CHEESE", "LSWAX", "LSW", "WAXUSDC", "WAXWBTC"];

export function getTokenLogoUrl(contract: string, ticker: string): string {
  return `${ALCOR_API}/tokens/${ticker.toLowerCase()}-${contract}/logo`;
}

export async function fetchSwapTokenList(signal?: AbortSignal): Promise<SwapToken[]> {
  const res = await fetch(`${ALCOR_API}/tokens`, { signal });
  if (!res.ok) {
    if (res.status === 429) {
      markAlcorRateLimited();
      throw new Error("Rate limited — please wait a moment and try again");
    }
    throw new Error("Failed to fetch token list");
  }
  const data = await res.json();
  const seen = new Set<string>();
  return (data as Array<{ contract: string; decimals: number; symbol: string; id: string; is_scam?: boolean }>)
    .filter((t) => {
      if (t.is_scam) return false;
      const key = `${t.symbol}_${t.contract}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((t: any) => ({
      contract: t.contract,
      ticker: t.symbol,
      precision: t.decimals,
      id: t.id,
      logo: getTokenLogoUrl(t.contract, t.symbol),
      system_price: t.system_price ?? 0,
      usd_price: t.usd_price ?? 0,
    }));
}

export async function fetchSwapRoute(
  tokenIn: SwapToken,
  tokenOut: SwapToken,
  amount: string,
  slippage: number,
  receiver: string,
  signal?: AbortSignal,
  tradeType: "EXACT_INPUT" | "EXACT_OUTPUT" = "EXACT_INPUT"
): Promise<SwapRoute | null> {
  const precision = tradeType === "EXACT_INPUT" ? tokenIn.precision : tokenOut.precision;
  const formattedAmount = formatTokenAmount(amount, precision);

  const inputId = `${tokenIn.ticker.toLowerCase()}-${tokenIn.contract}`;
  const outputId = `${tokenOut.ticker.toLowerCase()}-${tokenOut.contract}`;

  const params = new URLSearchParams({
    trade_type: tradeType,
    input: inputId,
    output: outputId,
    amount: formattedAmount,
    slippage: String(slippage),
    receiver,
    maxHops: "3",
  });

  let res: Response;
  try {
    res = await fetch(`${ALCOR_API}/swapRouter/getRoute?${params}`, { signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    // Normalize cross-browser network failures so the retry classifier matches.
    throw new Error("Failed to fetch swap route — network");
  }
  if (!res.ok) {
    if (res.status === 429) {
      markAlcorRateLimited();
      throw new Error("Rate limited — please wait a moment and try again");
    }
    const text = await res.text().catch(() => "");
    throw new Error(text || "Failed to fetch swap route");
  }

  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(text || "Invalid route response");
  }

  if (!data || !data.route || data.route.length === 0) return null;

  const rawSwaps = Array.isArray(data.swaps) ? data.swaps : [];
  const swaps: SwapSplit[] = rawSwaps.length
    ? rawSwaps.map((s: any) => ({
        percent: typeof s.percent === "number" ? s.percent : parseFloat(s.percent ?? "0"),
        route: Array.isArray(s.route) ? s.route : [],
        input: String(s.input ?? ""),
        output: String(s.output ?? ""),
        minReceived: String(s.minReceived ?? ""),
        memo: s.memo ? String(s.memo) : undefined,
        maxSent: s.maxSent != null ? String(s.maxSent) : undefined,
      }))
    : [
        {
          percent: 100,
          route: data.route,
          input: String(data.input ?? ""),
          output: String(data.output ?? ""),
          minReceived: String(data.minReceived ?? ""),
        },
      ];

  return {
    output: parseFloat(data.output),
    minReceived: parseFloat(data.minReceived),
    priceImpact: parseFloat(data.priceImpact),
    memo: data.memo,
    route: data.route,
    executionPrice: data.executionPrice,
    input: data.input ? parseFloat(data.input) : undefined,
    swaps,
    quoteSource: "http",
    quoteComplete: true,
  };
}

export async function fetchAlcorPool(id: number, signal?: AbortSignal): Promise<AlcorPool> {
  const res = await fetch(`${ALCOR_API}/swap/pools/${id}`, { signal });
  if (!res.ok) {
    if (res.status === 429) markAlcorRateLimited();
    throw new Error(`Failed to fetch pool ${id}`);
  }
  const data = await res.json();
  const pickToken = (t: any): AlcorPoolToken => ({
    id: String(t?.id ?? `${(t?.symbol ?? "").toLowerCase()}-${t?.contract ?? ""}`),
    symbol: String(t?.symbol ?? ""),
    contract: String(t?.contract ?? ""),
    decimals: Number(t?.decimals ?? 0),
  });
  return {
    id: Number(data.id),
    fee: Number(data.fee ?? 0),
    tokenA: pickToken(data.tokenA),
    tokenB: pickToken(data.tokenB),
  };
}

/** Build a single transfer action to swap.alcor with the routing memo */
export function normalizeRouteActions(
  route: SwapRoute,
  accountName: string,
  inputTokenContract: string,
  amount: string,
  tokenIn: SwapToken
): SwapAction[] {
  const auth = [{ actor: accountName, permission: "active" }];

  // Multi-split path: one transfer action per split, each with its own memo.
  // Only used when every split carries a memo (i.e. quote came from the SDK
  // split router). Falls through to the legacy single-transfer path otherwise.
  const splits = route.swaps ?? [];
  const allHaveMemos = splits.length > 1 && splits.every((s) => !!s.memo && !!s.input);

  if (allHaveMemos) {
    // Preserve raw-integer sum: format each split's `input` to precision, then
    // route any rounding remainder into the last split so the on-chain total
    // equals the user's typed amount exactly.
    const precision = tokenIn.precision;
    const scale = 10 ** precision;
    const totalRaw = Math.round(parseFloat(amount) * scale);
    const rawParts = splits.map((s) => Math.round(parseFloat(s.input) * scale));
    const sumFirst = rawParts.slice(0, -1).reduce((a, b) => a + b, 0);
    rawParts[rawParts.length - 1] = totalRaw - sumFirst;

    return splits.map((split, i) => {
      const human = (rawParts[i] / scale).toFixed(precision);
      return {
        account: inputTokenContract,
        name: "transfer",
        authorization: auth,
        data: {
          from: accountName,
          to: "swap.alcor",
          quantity: `${human} ${tokenIn.ticker}`,
          memo: split.memo!,
        },
      };
    });
  }

  const formattedQuantity = `${formatTokenAmount(amount, tokenIn.precision)} ${tokenIn.ticker}`;
  return [
    {
      account: inputTokenContract,
      name: "transfer",
      authorization: auth,
      data: {
        from: accountName,
        to: "swap.alcor",
        quantity: formattedQuantity,
        memo: route.memo,
      },
    },
  ];
}

export function formatTokenAmount(amount: number | string, precision: number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "0";
  return num.toFixed(precision);
}

export async function fetchTokenBalance(
  account: string,
  contract: string,
  ticker: string
): Promise<string> {
  try {
    const data = await waxRpcCall<string[]>(
      '/v1/chain/get_currency_balance',
      { code: contract, account, symbol: ticker }
    );
    if (!data || data.length === 0) return "0";
    return data[0].split(" ")[0];
  } catch {
    return "0";
  }
}

// Preferred contracts for deterministic default pair selection
export const PREFERRED_CONTRACTS: Record<string, string> = {
  WAX: "eosio.token",
  CHEESE: "cheeseburger",
  WAXUSDC: "eth.token",
};
