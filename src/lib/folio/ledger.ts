// Weighted-average-cost ledger. All values are in WAX.
//
// Rules (one per event type):
// - trade:  tokens out are disposed at average cost; tokens in are acquired.
//           The trade's WAX value is the WAX leg when there is one, otherwise
//           the recorded daily price of the tokens sent, otherwise the cost of
//           what was sent is carried over unchanged (no profit/loss booked).
// - order-placed: tokens move into "on order" at their cost; later fills are
//           matched to that order's price (oldest first), refunds move back.
// - reward / received / liquidity gains: free acquisition (cost 0).
// - sent / nulled: removed at average cost, no profit/loss.
// - liquidity-add/remove: tokens move to/from an "in liquidity" bucket at cost.
import type { FolioEvent, LedgerResult, PriceAt, TokenAmount, TokenKey, TokenPosition } from './types';
import { WAX_KEY } from './types';

interface OpenOrder {
  give: TokenAmount; // remaining amount still on order
  giveCost: number; // WAX cost of the remaining amount
  want: TokenAmount; // remaining amount still asked for
}

const EPS = 1e-12;

function emptyPosition(a: TokenAmount): TokenPosition {
  return {
    key: a.key, contract: a.contract, symbol: a.symbol, precision: a.precision,
    qty: 0, costWax: 0, realizedWax: 0, onOrderQty: 0, inLiquidityQty: 0, inLiquidityCostWax: 0,
    freeQty: 0, boughtQty: 0, soldQty: 0, historyGap: false, unpricedBuys: false,
  };
}

export function buildLedger(events: FolioEvent[], priceAt: PriceAt = () => null): LedgerResult {
  const positions = new Map<TokenKey, TokenPosition>();
  const realizedByEvent = new Map<string, number>();
  const valueByEvent = new Map<string, number>();
  const orders: OpenOrder[] = [];

  const pos = (a: TokenAmount) => {
    let p = positions.get(a.key);
    if (!p) {
      p = emptyPosition(a);
      positions.set(a.key, p);
    }
    p.precision = Math.max(p.precision, a.precision);
    return p;
  };
  /** Removes `amount` at average cost and returns that cost. */
  const take = (a: TokenAmount): number => {
    const p = pos(a);
    let amount = a.amount;
    if (amount > p.qty + EPS) {
      // History says we never had this much: keep going, flag the token.
      if (amount - p.qty > 10 ** -p.precision) p.historyGap = true;
      amount = p.qty;
    }
    const cost = p.qty > EPS ? (p.costWax * amount) / p.qty : 0;
    p.qty = Math.max(0, p.qty - a.amount);
    p.costWax = p.qty > EPS ? Math.max(0, p.costWax - cost) : 0;
    return cost;
  };
  const give = (a: TokenAmount, cost: number, free = false) => {
    const p = pos(a);
    p.qty += a.amount;
    p.costWax += cost;
    if (free) p.freeQty += a.amount;
  };

  /** Books a disposal of `out` (with known cost) for `inn`, at `value` WAX if known. */
  const settleTrade = (ev: FolioEvent, out: { a: TokenAmount; cost: number }[], inn: TokenAmount[]) => {
    const outCost = out.reduce((s, o) => s + o.cost, 0);
    const waxOut = out.find((o) => o.a.key === WAX_KEY)?.a.amount;
    const waxIn = inn.find((a) => a.key === WAX_KEY)?.amount;
    let value: number | null = null;
    if (waxOut != null) value = waxOut;
    else if (waxIn != null) value = waxIn;
    else if (out.length) {
      const priced = out.map((o) => priceAt(o.a.key, ev.ts));
      if (priced.every((x) => x != null)) value = out.reduce((s, o, i) => s + o.a.amount * (priced[i] as number), 0);
    } else if (inn.length) {
      const priced = inn.map((a) => priceAt(a.key, ev.ts));
      if (priced.every((x) => x != null)) value = inn.reduce((s, a, i) => s + a.amount * (priced[i] as number), 0);
    }

    // Disposal side: realize against value (WAX itself never realizes P&L).
    let realized = 0;
    const nonWaxOut = out.filter((o) => o.a.key !== WAX_KEY);
    if (value != null && nonWaxOut.length) {
      const nonWaxCost = nonWaxOut.reduce((s, o) => s + o.cost, 0);
      const proceeds = value - (waxIn ?? 0) - 0; // proceeds attributable to non-WAX tokens sent
      const attributable = waxOut != null ? 0 : waxIn != null ? waxIn : proceeds;
      // Split proceeds across non-WAX tokens sent in proportion to their cost
      // (or evenly when all were free).
      const totalWeight = nonWaxCost > EPS ? nonWaxCost : nonWaxOut.length;
      for (const o of nonWaxOut) {
        const share = (nonWaxCost > EPS ? o.cost : 1) / totalWeight;
        const r = attributable * share - o.cost;
        pos(o.a).realizedWax += r;
        realized += r;
      }
    }
    for (const o of out) pos(o.a).soldQty += o.a.amount;

    // Acquisition side: what the bought tokens cost.
    const nonWaxIn = inn.filter((a) => a.key !== WAX_KEY);
    const acquireCost = value != null ? value - (waxIn ?? 0) : outCost;
    for (const a of inn) {
      if (a.key === WAX_KEY) {
        give(a, a.amount);
      } else {
        const weights = nonWaxIn.map((x) => {
          const px = priceAt(x.key, ev.ts);
          return px != null ? x.amount * px : null;
        });
        const allPriced = weights.every((w) => w != null) && weights.some((w) => (w as number) > 0);
        const idx = nonWaxIn.indexOf(a);
        const share = allPriced
          ? (weights[idx] as number) / (weights as number[]).reduce((s, w) => s + w, 0)
          : 1 / nonWaxIn.length;
        give(a, Math.max(0, acquireCost) * share);
        const p = pos(a);
        p.boughtQty += a.amount;
        if (value == null && outCost <= EPS) p.unpricedBuys = true;
      }
    }
    if (value != null) valueByEvent.set(ev.id, value);
    if (Math.abs(realized) > EPS) realizedByEvent.set(ev.id, realized);
  };

  const sorted = [...events].sort((a, b) => a.ts - b.ts || a.id.localeCompare(b.id));
  for (const ev of sorted) {
    switch (ev.type) {
      case 'trade': {
        if (ev.venue === 'alcor-orderbook' && ev.out.length === 0) {
          // Order-book fill: match to open orders asking for this token.
          for (const got of ev.in) {
            let remaining = got.amount;
            const matched: { a: TokenAmount; cost: number }[] = [];
            for (const o of orders) {
              if (remaining <= EPS) break;
              if (o.want.key !== got.key || o.want.amount <= EPS) continue;
              const fillWant = Math.min(remaining, o.want.amount);
              const frac = fillWant / o.want.amount;
              const giveAmt = o.give.amount * frac;
              const cost = o.giveCost * frac;
              o.give.amount -= giveAmt;
              o.giveCost -= cost;
              o.want.amount -= fillWant;
              pos(o.give).onOrderQty = Math.max(0, pos(o.give).onOrderQty - giveAmt);
              matched.push({ a: { ...o.give, amount: giveAmt }, cost });
              remaining -= fillWant;
            }
            // Merge matched slices per token for one clean settlement.
            const merged = new Map<string, { a: TokenAmount; cost: number }>();
            for (const m of matched) {
              const cur = merged.get(m.a.key);
              if (cur) { cur.a.amount += m.a.amount; cur.cost += m.cost; }
              else merged.set(m.a.key, { a: { ...m.a }, cost: m.cost });
            }
            settleTrade(ev, [...merged.values()], [got]);
            if (remaining > 10 ** -got.precision && !matched.length) {
              // Fill of an order placed before the scanned history.
              pos(got).unpricedBuys = pos(got).unpricedBuys || !valueByEvent.has(ev.id);
            }
          }
          break;
        }
        const out = ev.out.map((a) => ({ a, cost: take(a) }));
        settleTrade(ev, out, ev.in);
        break;
      }
      case 'order-placed': {
        for (const a of ev.out) {
          const cost = take(a);
          pos(a).onOrderQty += a.amount;
          if (ev.orderWant) orders.push({ give: { ...a }, giveCost: cost, want: { ...ev.orderWant } });
        }
        break;
      }
      case 'order-returned': {
        for (const a of ev.in) {
          let remaining = a.amount;
          let cost = 0;
          for (const o of orders) {
            if (remaining <= EPS) break;
            if (o.give.key !== a.key || o.give.amount <= EPS) continue;
            const back = Math.min(remaining, o.give.amount);
            const frac = back / o.give.amount;
            cost += o.giveCost * frac;
            o.giveCost -= o.giveCost * frac;
            o.want.amount -= o.want.amount * frac;
            o.give.amount -= back;
            remaining -= back;
          }
          const p = pos(a);
          p.onOrderQty = Math.max(0, p.onOrderQty - (a.amount - remaining));
          give(a, cost, remaining > EPS && cost <= EPS);
        }
        break;
      }
      case 'liquidity-add': {
        for (const a of ev.out) {
          const cost = take(a);
          const p = pos(a);
          p.inLiquidityQty += a.amount;
          p.inLiquidityCostWax += cost;
        }
        break;
      }
      case 'liquidity-remove': {
        for (const a of ev.in) {
          const p = pos(a);
          const back = Math.min(a.amount, p.inLiquidityQty);
          const cost = p.inLiquidityQty > EPS ? (p.inLiquidityCostWax * back) / p.inLiquidityQty : 0;
          p.inLiquidityQty -= back;
          p.inLiquidityCostWax = Math.max(0, p.inLiquidityCostWax - cost);
          give({ ...a, amount: back }, cost);
          // Anything above what went in is earned pool fees / price movement.
          if (a.amount - back > EPS) give({ ...a, amount: a.amount - back }, 0, true);
        }
        break;
      }
      case 'reward':
      case 'received':
        for (const a of ev.in) give(a, 0, true);
        for (const a of ev.out) take(a);
        break;
      case 'sent':
      case 'nulled':
        for (const a of ev.out) take(a);
        for (const a of ev.in) give(a, 0, true);
        break;
    }
  }
  return { positions, realizedByEvent, valueByEvent };
}

/** Daily wallet quantity per token, replaying events up to each day's end. */
export function quantitiesByDay(events: FolioEvent[], dayEnds: number[]): Map<TokenKey, number>[] {
  const sorted = [...events].sort((a, b) => a.ts - b.ts);
  const qty = new Map<TokenKey, number>();
  const out: Map<TokenKey, number>[] = [];
  let i = 0;
  for (const end of dayEnds) {
    while (i < sorted.length && sorted[i].ts <= end) {
      const ev = sorted[i++];
      for (const a of ev.out) qty.set(a.key, Math.max(0, (qty.get(a.key) ?? 0) - a.amount));
      for (const a of ev.in) qty.set(a.key, (qty.get(a.key) ?? 0) + a.amount);
    }
    out.push(new Map(qty));
  }
  return out;
}
