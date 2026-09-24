// Background route search. Polyfills must load before the swap SDK.
import "./workerPolyfills";
import { quoteFromData, type QuoteInput } from "@/lib/alcorQuoteCore";

self.onmessage = async (ev: MessageEvent<{ id: number; input: QuoteInput }>) => {
  const { id, input } = ev.data;
  try {
    const route = await quoteFromData(input);
    (self as unknown as Worker).postMessage({ id, ok: true, route });
  } catch (e) {
    (self as unknown as Worker).postMessage({
      id,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
};
