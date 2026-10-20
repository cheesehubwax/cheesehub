// Fetches the shared daily FX file written by scripts/token-price-history/fx.ts.
import { tokenPriceDataUrl } from '../tokenPriceData';

export type FxHistory = Record<string, Record<string, number>>;

export async function fetchFxHistory(signal?: AbortSignal): Promise<FxHistory | null> {
  const bucket = Math.floor(Date.now() / 3_600_000);
  try {
    const res = await fetch(`${tokenPriceDataUrl()}/fx-usd-history.json?t=${bucket}`, { signal });
    if (!res.ok) return null;
    const data = (await res.json()) as { currencies?: FxHistory };
    return data?.currencies && Object.keys(data.currencies).length ? data.currencies : null;
  } catch {
    return null;
  }
}
