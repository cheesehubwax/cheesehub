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

  /** Books a disposal of `out` (with known cost) for `inn`. */
  const settleTrade = (ev: FolioEvent, out: { a: TokenAmount; cost: number }[], inn: TokenAmount[]) => {
    const outCost = out.reduce((s, o) => s + o.cost, 0);
    const waxOut = out.filter((o) => o.a.key === WAX_KEY).reduce((s, o) => s + o.a.amount, 0);
    const waxIn = inn.filter((a) => a.key === WAX_KEY).reduce((s, a) => s + a.amount, 0);
    const nonWaxOut = out.filter((o) => o.a.key !== WAX_KEY);
    const nonWaxIn = inn.filter((a) => a.key !== WAX_KEY);
    const pricedValue = (list: TokenAmount[]) => {
      let sum = 0;
      for (const a of list) {
        if (a.key === WAX_KEY) { sum += a.amount; continue; }
        const px = priceAt(a.key, ev.ts);
        if (px == null) return null;
        sum += a.amount * px;
      }
      return sum;
    };

    // Total WAX value of the trade. Exact when one whole side is WAX.
    let value: number | null = null;
    if (inn.length && nonWaxIn.length === 0) value = waxIn;
    else if (out.length && nonWaxOut.length === 0) value = waxOut;
    else if (out.length) value = pricedValue(out.map((o) => o.a));
    if (value == null && inn.length) value = pricedValue(inn);

    // Disposal side.
    let realized = 0;
    if (value != null && nonWaxOut.length) {
      const proceeds = Math.max(0, value - waxOut);
      const nonWaxCost = nonWaxOut.reduce((s, o) => s + o.cost, 0);
      for (const o of nonWaxOut) {
        const share = nonWaxCost > EPS ? o.cost / nonWaxCost : 1 / nonWaxOut.length;
        const r = proceeds * share - o.cost;
        pos(o.a).realizedWax += r;
        realized += r;
      }
    }
    for (const o of out) pos(o.a).soldQty += o.a.amount;

    // Acquisition side.
    const acquireCost = Math.max(0, value != null ? value - waxIn : outCost - waxIn);
    const weights = nonWaxIn.map((x) => {
      const px = priceAt(x.key, ev.ts);
      return px != null ? x.amount * px : null;
    });
    const weightSum = weights.every((w) => w != null) ? (weights as number[]).reduce((s, w) => s + w, 0) : 0;
    for (const a of inn) {
      if (a.key === WAX_KEY) { give(a, a.amount); continue; }
      const i = nonWaxIn.indexOf(a);
      const share = weightSum > EPS ? (weights[i] as number) / weightSum : 1 / nonWaxIn.length;
      give(a, acquireCost * share);
      const p = pos(a);
      p.boughtQty += a.amount;
      if (value == null && outCost <= EPS) p.unpricedBuys = true;
    }
    if (value != null) valueByEvent.set(ev.id, value);
    if (Math.abs(realized) > EPS) realizedByEvent.set(ev.id, realized);
  };

  const sorted = [...events].sort((a, b) => a.seq - b.seq);
  for (const ev of sorted) {
    switch (ev.type) {
      case 'trade': {
        if (ev.venue === 'alcor-orderbook' && ev.out.length === 0) {
          // Order-book fill. With the fill record we know exactly what was
          // given; it is taken from open orders that gave that token.
          const got = ev.in[0];
          const gave = ev.fillGave;
          const candidates = orders.filter((o) => o.give.amount > EPS && (gave ? o.give.key === gave.key : o.want.key === got.key));
          // Prefer orders asking for the token received (the right market).
          candidates.sort((x, y) => Number(y.want.key === got.key) - Number(x.want.key === got.key));
          let need = gave ? gave.amount : null;
          let wantNeed = got.amount;
          let matchedQty = 0;
          let matchedCost = 0;
          let matchedToken: TokenAmount | null = gave ?? null;
          for (const o of candidates) {
            if (need != null ? need <= EPS : wantNeed <= EPS) break;
            const giveAmt = need != null
              ? Math.min(need, o.give.amount)
              : Math.min(o.give.amount, o.want.amount > EPS ? (o.give.amount * wantNeed) / o.want.amount : 0);
            if (giveAmt <= EPS) continue;
            const frac = giveAmt / o.give.amount;
            const cost = o.giveCost * frac;
            const wantPart = o.want.amount * frac;
            o.give.amount -= giveAmt;
            o.giveCost -= cost;
            o.want.amount = Math.max(0, o.want.amount - wantPart);
            pos(o.give).onOrderQty = Math.max(0, pos(o.give).onOrderQty - giveAmt);
            matchedQty += giveAmt;
            matchedCost += cost;
            matchedToken = matchedToken ?? o.give;
            if (need != null) need -= giveAmt;
            wantNeed -= wantPart;
          }
          const out = matchedToken && matchedQty > EPS ? [{ a: { ...matchedToken, amount: matchedQty }, cost: matchedCost }] : [];
          // Unmatched remainder = an order placed before the scanned history.
          if (gave && need != null && need > 10 ** -gave.precision) pos(gave).historyGap = true;
          settleTrade(ev, out, [got]);
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
  const sorted = [...events].sort((a, b) => a.seq - b.seq);
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
