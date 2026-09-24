// Runs the split-route search in a background worker so the page stays
// responsive while it works. Falls back to the main thread whenever a worker
// is unavailable (tests, old browsers) or fails to start.

import { quoteFromData, type QuoteInput } from "./alcorQuoteCore";
import type { SwapRoute } from "./swapApi";
import { logger } from "./logger";

type Pending = {
  resolve: (r: SwapRoute | null) => void;
  reject: (e: unknown) => void;
  input: QuoteInput;
};

let worker: Worker | null = null;
let workerBroken = false;
let nextId = 1;
const pending = new Map<number, Pending>();

function abortError(): Error {
  const err = new Error("aborted");
  err.name = "AbortError";
  return err;
}

function failAllToMainThread(reason: unknown) {
  logger.warn("[alcor-router] route worker failed — using main thread", reason);
  workerBroken = true;
  worker?.terminate();
  worker = null;
  const items = [...pending.values()];
  pending.clear();
  for (const p of items) quoteFromData(p.input).then(p.resolve, p.reject);
}

function getWorker(): Worker | null {
  if (workerBroken || typeof Worker === "undefined" || typeof window === "undefined") return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL("../workers/alcorRoute.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (ev: MessageEvent<{ id: number; ok: boolean; route?: SwapRoute | null; error?: string }>) => {
      const p = pending.get(ev.data.id);
      if (!p) return;
      pending.delete(ev.data.id);
      if (ev.data.ok) p.resolve(ev.data.route ?? null);
      else p.reject(new Error(ev.data.error || "Route search failed"));
    };
    worker.onerror = (ev) => {
      ev.preventDefault?.();
      failAllToMainThread(ev.message || ev);
    };
    return worker;
  } catch (e) {
    failAllToMainThread(e);
    return null;
  }
}

export function runQuote(input: QuoteInput, signal?: AbortSignal): Promise<SwapRoute | null> {
  if (signal?.aborted) return Promise.reject(abortError());
  const w = getWorker();
  if (!w) return quoteFromData(input);
  const id = nextId++;
  return new Promise<SwapRoute | null>((resolve, reject) => {
    pending.set(id, { resolve, reject, input });
    signal?.addEventListener(
      "abort",
      () => {
        if (!pending.has(id)) return;
        pending.delete(id);
        reject(abortError());
      },
      { once: true },
    );
    w.postMessage({ id, input });
  });
}
