// Multi-endpoint WAX RPC helpers. Mirrors src/lib/wax.ts.

export const ENDPOINTS = [
  "https://api.wax.alohaeos.com",
  "https://wax.greymass.com",
  "https://wax.eosphere.io",
  "https://api.waxsweden.org",
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