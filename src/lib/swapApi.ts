// Alcor Exchange API layer for CHEESESwap
import { waxRpcCall } from "./waxRpcFallback";

export interface SwapToken {
  contract: string;
  ticker: string;
  precision: number;
  logo?: string;
  id?: string;
}

export interface SwapAction {
  account: string;
  name: string;
  authorization: Array<{ actor: string; permission: string }>;
  data: Record<string, unknown>;
}

export interface SwapRoute {
  output: number;
  minReceived: number;
  priceImpact: number;
  memo: string;
  route: number[];
  executionPrice: { numerator: string; denominator: string };
}

const ALCOR_API = "https://wax.alcor.exchange/api/v2";

export const POPULAR_TICKERS = ["WAX", "CHEESE", "NEFTY", "TLM", "AETHER", "SKUNKY", "WAXUSDC"];

export function getTokenLogoUrl(contract: string, ticker: string): string {
  return `${ALCOR_API}/tokens/${ticker.toLowerCase()}-${contract}/logo`;
}

export async function fetchSwapTokenList(signal?: AbortSignal): Promise<SwapToken[]> {
  const res = await fetch(`${ALCOR_API}/tokens`, { signal });
  if (!res.ok) throw new Error("Failed to fetch token list");
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
    .map((t) => ({
      contract: t.contract,
      ticker: t.symbol,
      precision: t.decimals,
      id: t.id,
      logo: getTokenLogoUrl(t.contract, t.symbol),
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
    slippage: (slippage / 100).toFixed(2),
    receiver,
    maxHops: "3",
  });

  const res = await fetch(`${ALCOR_API}/swapRouter/getRoute?${params}`, { signal });
  if (!res.ok) {
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

  return {
    output: parseFloat(data.output),
    minReceived: parseFloat(data.minReceived),
    priceImpact: parseFloat(data.priceImpact),
    memo: data.memo,
    route: data.route,
    executionPrice: data.executionPrice,
    input: data.input ? parseFloat(data.input) : undefined,
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
  const formattedQuantity = `${formatTokenAmount(amount, tokenIn.precision)} ${tokenIn.ticker}`;
  return [
    {
      account: inputTokenContract,
      name: "transfer",
      authorization: [{ actor: accountName, permission: "active" }],
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
