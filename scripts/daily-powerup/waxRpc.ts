// Multi-endpoint WAX RPC helpers. Mirrors src/lib/wax.ts.

export const ENDPOINTS = [
  "https://api.wax.alohaeos.com",
  "https://wax.greymass.com",
  "https://wax.eosphere.io",
  "https://api.waxsweden.org",
];

/** Hyperion v2 endpoints, used for transfer-history lookups. */
export const HYPERION_ENDPOINTS = [
  "https://wax.eosphere.io",
  "https://wax.greymass.com",
  "https://api.waxsweden.org",
  "https://wax.cryptolions.io",
];

const TIMEOUT_MS = 8000;

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

/**
 * Fetch all rows of a table, paginating until `more === false`.
 * `startEndpointIndex` rotates the *preferred* endpoint per call so callers
 * doing multiple independent scans don't all favor the same RPC. The full
 * endpoint list still serves as fallback for each page.
 */
export async function fetchTableAll<T>(
  code: string,
  scope: string,
  table: string,
  pageSize = 1000,
  startEndpointIndex = 0
): Promise<T[]> {
  const out: T[] = [];
  let lower_bound = "";
  const rotated = ENDPOINTS.map(
    (_, i) => ENDPOINTS[(startEndpointIndex + i) % ENDPOINTS.length]
  );
  for (let i = 0; i < 50; i++) {
    const body = JSON.stringify({
      json: true,
      code,
      scope,
      table,
      lower_bound,
      upper_bound: "",
      limit: pageSize,
    });

    let pageOk = false;
    let lastErr: unknown = null;
    for (const ep of rotated) {
      try {
        const r = await fetchWithTimeout(`${ep}/v1/chain/get_table_rows`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data: { rows: T[]; more: boolean; next_key?: string } = await r.json();
        out.push(...(data.rows ?? []));
        if (!data.more || !data.rows?.length) return out;
        const last = data.rows[data.rows.length - 1] as unknown as {
          staker?: string;
          account?: string;
        };
        lower_bound =
          data.next_key && data.next_key !== ""
            ? data.next_key
            : (last?.staker ?? last?.account ?? "");
        if (!data.next_key && lower_bound) lower_bound = lower_bound + " ";
        pageOk = true;
        break;
      } catch (e) {
        lastErr = e;
        continue;
      }
    }
    if (!pageOk) throw new Error(`All RPC endpoints failed: ${String(lastErr)}`);
  }
  return out;
}

/** Returns true if a WAX account exists. */
export async function accountExists(name: string): Promise<boolean> {
  for (const ep of ENDPOINTS) {
    try {
      const r = await fetchWithTimeout(
        `${ep}/v1/chain/get_account`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ account_name: name }),
        },
        5000
      );
      if (r.ok) return true;
      if (r.status === 500 || r.status === 404) return false;
    } catch {
      continue;
    }
  }
  return false;
}

export interface InboundTransfer {
  from: string;
  to: string;
  quantity: string; // e.g. "1.0000 CHEESE"
  symbol: string;
  amount: number;
  memo: string;
  timestamp: string; // ISO
  trxId: string;
}

/**
 * Fetch inbound token transfers to `account` since `fromIso` (UTC ISO string),
 * filtered to `tokenContract::transfer` actions emitting the given `symbol`.
 * Uses Hyperion v2 with multi-endpoint fallback. Returns at most ~1000 rows.
 */
export async function getRecentInboundTransfers(
  account: string,
  fromIso: string,
  tokenContract: string,
  symbol: string
): Promise<InboundTransfer[]> {
  const params = new URLSearchParams({
    account,
    "act.account": tokenContract,
    "act.name": "transfer",
    after: fromIso,
    limit: "1000",
    sort: "desc",
    "transfer.to": account,
  });
  let lastErr: unknown = null;
  for (const ep of HYPERION_ENDPOINTS) {
    try {
      const r = await fetchWithTimeout(
        `${ep}/v2/history/get_actions?${params.toString()}`,
        { method: "GET" },
        10000
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data: {
        actions?: Array<{
          trx_id: string;
          "@timestamp": string;
          timestamp?: string;
          act: {
            account: string;
            name: string;
            data: { from: string; to: string; quantity: string; memo: string };
          };
        }>;
      } = await r.json();
      const out: InboundTransfer[] = [];
      for (const a of data.actions ?? []) {
        const d = a.act?.data;
        if (!d || a.act.account !== tokenContract || a.act.name !== "transfer") continue;
        if (d.to !== account) continue;
        const [amtStr, sym] = String(d.quantity ?? "").split(" ");
        if (sym !== symbol) continue;
        const amount = parseFloat(amtStr);
        if (!Number.isFinite(amount)) continue;
        out.push({
          from: d.from,
          to: d.to,
          quantity: d.quantity,
          symbol: sym,
          amount,
          memo: d.memo ?? "",
          timestamp: a["@timestamp"] ?? a.timestamp ?? "",
          trxId: a.trx_id,
        });
      }
      return out;
    } catch (e) {
      lastErr = e;
      continue;
    }
  }
  throw new Error(`All Hyperion endpoints failed: ${String(lastErr)}`);
}