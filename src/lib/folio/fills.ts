// Order-book fill lookups for CHEESEFolio: finds what the account gave for
// each Alcor fill not explained by the bulk deal list, one transaction at a time.
import type { HyperionActionRecord } from '../hyperionHistory';
import { mapLimit } from '../chainRequest';
import { abortableDelay, linkedAbort } from './providers';
import type { RawTransfer } from './types';

/** One transaction lookup; slow hosts are skipped rather than waited on. */
const TX_TIMEOUT_MS = 5_000;
const TX_PROBE_TIMEOUT_MS = 4_000;
/** Order-book fill lookups in flight per provider. */
export const FILL_CONCURRENCY = 12;

export const isFill = (t: RawTransfer, account: string) =>
  t.from === 'alcordexmain' && t.to === account && /order match/i.test(t.memo);

interface MatchRecord {
  bid?: string;
  ask?: string;
  market?: { base_token?: { sym?: string; contract?: string }; quote_token?: { sym?: string; contract?: string } };
  bidder?: string;
  asker?: string;
}

const symOf = (asset: string | undefined) => asset?.trim().split(/\s+/)[1];
const amountOf = (asset: string | undefined) => parseFloat(asset?.trim().split(/\s+/)[0] ?? 'NaN');

/**
 * What the account gave for one order-book fill. The fill's `sellmatch` /
 * `buymatch` record has both sides; whichever side equals what the account
 * received, the other side is what it gave. Role-agnostic on purpose.
 */
export function fillGaveFromActions(actions: HyperionActionRecord[], account: string, t: RawTransfer): RawTransfer['fillGave'] {
  const gotSym = symOf(t.quantity);
  const gotAmt = amountOf(t.quantity);
  const records = actions
    .filter((a) => a.act?.account === 'alcordexmain' && /match$/.test(a.act?.name ?? ''))
    .map((a) => (a.act?.data as { record?: MatchRecord } | undefined)?.record)
    .filter((r): r is MatchRecord => !!r && (r.bidder === account || r.asker === account));
  for (const r of records) {
    for (const [got, gave] of [[r.bid, r.ask], [r.ask, r.bid]] as const) {
      if (symOf(got) !== gotSym || Math.abs(amountOf(got) - gotAmt) > 1e-9) continue;
      const gaveSym = symOf(gave);
      const side = [r.market?.base_token, r.market?.quote_token].find((x) => x?.sym?.split(',')[1] === gaveSym);
      if (gave && side?.contract) return { contract: side.contract, quantity: gave };
    }
  }
  return null;
}

async function fetchTx(base: string, trx: string, timeoutMs = TX_TIMEOUT_MS, signal?: AbortSignal): Promise<HyperionActionRecord[] | null> {
  const link = linkedAbort(timeoutMs, signal);
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/v2/history/get_transaction?id=${trx}`, { signal: link.signal });
    if (!res.ok) return null;
    const actions = ((await res.json()) as { actions?: HyperionActionRecord[] }).actions;
    return Array.isArray(actions) && actions.length ? actions : null;
  } catch {
    return null;
  } finally {
    link.done();
  }
}

/** Keeps only providers that answer one real transaction lookup quickly. */
export async function probeTxProviders(
  bases: string[],
  trx: string,
  fetcher: (base: string, trx: string, timeoutMs: number) => Promise<unknown[] | null> = fetchTx,
): Promise<string[]> {
  const ok = await Promise.all(bases.map(async (b) => ((await fetcher(b, trx, TX_PROBE_TIMEOUT_MS)) ? b : null)));
  return ok.filter((b): b is string => !!b);
}

export interface TxProvider {
  base: string;
  /** Oldest transfer this provider holds for the account (epoch ms). */
  earliestTs: number | null;
  /** Lookups in flight at once on this provider. */
  slots: number;
}

/**
 * Providers that can hold a transaction at `ts`, fastest first. A provider
 * whose history starts later than the fill is skipped instead of asked.
 */
export function txProvidersFor(ts: number, providers: TxProvider[]): TxProvider[] {
  return providers.filter((p) => p.earliestTs != null && p.earliestTs <= ts + 60_000);
}

/**
 * Looks up every order-book fill not yet checked. Each fill goes to the
 * fastest provider whose history reaches back to it, with a cap on lookups
 * in flight per provider, so a slow full-history host only gets the old
 * fills nobody else has. A lookup that fails moves on to the next provider;
 * anything still unchecked is retried on the next sync.
 */
export async function enrichFills(
  providers: TxProvider[],
  account: string,
  transfers: RawTransfer[],
  onProgress: (done: number, total: number) => void,
  signal?: AbortSignal,
) {
  const byTrx = new Map<string, RawTransfer[]>();
  for (const t of transfers) if (isFill(t, account) && !t.fillChecked) byTrx.set(t.trx, [...(byTrx.get(t.trx) ?? []), t]);
  const jobs = [...byTrx.entries()].sort((x, y) => y[1][0].ts - x[1][0].ts);
  const total = jobs.length;
  if (!total || !providers.length) return;
  onProgress(0, total);
  // Probe with the newest fill so providers holding only recent history pass.
  const passed = new Set(await probeTxProviders(providers.map((p) => p.base), jobs[0][0], (b, trx, ms) => fetchTx(b, trx, ms, signal)));
  const working = providers.filter((p) => passed.has(p.base));
  if (!working.length || signal?.aborted) return;
  const busy = new Map(working.map((p) => [p.base, 0]));
  const waiters: (() => void)[] = [];
  const wake = () => waiters.splice(0).forEach((w) => w());
  signal?.addEventListener('abort', wake, { once: true });
  const release = (base: string) => {
    busy.set(base, (busy.get(base) ?? 1) - 1);
    wake();
  };
  /** Waits for a free slot on the first provider in `order` that has one. */
  const acquire = async (order: TxProvider[]): Promise<TxProvider | null> => {
    for (;;) {
      if (signal?.aborted) return null;
      const free = order.find((p) => (busy.get(p.base) ?? 0) < p.slots);
      if (free) {
        busy.set(free.base, (busy.get(free.base) ?? 0) + 1);
        return free;
      }
      await new Promise<void>((r) => waiters.push(r));
    }
  };
  let done = 0;
  const totalSlots = working.reduce((s, p) => s + p.slots, 0);
  const runPass = (batch: typeof jobs, retry: boolean) =>
    mapLimit(batch, retry ? Math.max(4, Math.floor(totalSlots / 3)) : totalSlots, async ([trx, list]) => {
      let order = txProvidersFor(list[0].ts, working);
      while (order.length && !signal?.aborted) {
        const p = await acquire(order);
        if (!p) break;
        let actions: HyperionActionRecord[] | null = null;
        try {
          actions = await fetchTx(p.base, trx, TX_TIMEOUT_MS, signal);
        } finally {
          release(p.base);
        }
        if (actions) {
          for (const t of list) {
            t.fillGave = fillGaveFromActions(actions, account, t);
            t.fillChecked = true;
          }
          break;
        }
        order = order.filter((x) => x !== p);
      }
      if (!retry) done++;
      if (done % 10 === 0 || done === total) onProgress(done, total);
    });
  // Busy full-history hosts sometimes refuse a burst; a short second and
  // third pass over what is left recovers those without a new sync.
  let remaining = jobs;
  for (let pass = 0; pass < 3 && remaining.length && !signal?.aborted; pass++) {
    if (pass) await abortableDelay(1500 * pass, signal);
    await runPass(remaining, pass > 0);
    remaining = remaining.filter(([, list]) => !list[0].fillChecked);
  }
  signal?.removeEventListener('abort', wake);
  onProgress(done, total);
}
