// Turns raw token transfers of one account into classified events.
// Pure functions only — tested against real recorded transaction shapes.
import type { FolioEvent, RawTransfer, TokenAmount, Venue } from './types';

export function parseAsset(quantity: string, contract: string): TokenAmount | null {
  const m = /^\s*(-?\d+(?:\.(\d+))?)\s+([A-Z0-9]{1,7})\s*$/.exec(quantity ?? '');
  if (!m) return null;
  const amount = parseFloat(m[1]);
  if (!Number.isFinite(amount)) return null;
  return { key: `${contract}:${m[3]}`, contract, symbol: m[3], precision: m[2]?.length ?? 0, amount };
}

/** `"294.00000000 WAX@eosio.token"` → the asked-for amount of an order-book order. */
export function parseOrderMemo(memo: string): TokenAmount | null {
  const m = /^\s*(\d+(?:\.\d+)?\s+[A-Z0-9]{1,7})@([a-z1-5.]{1,12})\s*$/.exec(memo ?? '');
  return m ? parseAsset(m[1], m[2]) : null;
}

type Kind =
  | { k: 'swap-out' | 'swap-in'; venue: Venue }
  | { k: 'order-place'; want: TokenAmount }
  | { k: 'order-fill' }
  | { k: 'order-return' }
  | { k: 'lp-add' | 'lp-remove'; venue: Venue }
  | { k: 'reward' }
  | { k: 'nulled' }
  | { k: 'in' }
  | { k: 'out' };

const REWARD_SENDERS = new Set(['reward.alcor', 'farms.waxdao', 'mine2.box', 'cheesefarmzz']);
const REWARD_MEMO = /reward|claim|staking|harvest|airdrop|dividend|payout/i;

function kindOf(t: RawTransfer, account: string, trxHasTacoSwap: boolean): Kind {
  const outgoing = t.from === account;
  const other = outgoing ? t.to : t.from;
  const memo = t.memo ?? '';
  if (outgoing) {
    if (other === 'eosio.null') return { k: 'nulled' };
    if (other === 'swap.alcor') {
      return /^swapexact(in|out)#/.test(memo) ? { k: 'swap-out', venue: 'alcor' } : { k: 'lp-add', venue: 'alcor' };
    }
    if (other === 'swap.box') {
      return /^swap,/.test(memo) ? { k: 'swap-out', venue: 'defibox' } : { k: 'lp-add', venue: 'defibox' };
    }
    if (other === 'swap.taco') {
      return parseOrderMemo(memo) ? { k: 'swap-out', venue: 'taco' } : { k: 'lp-add', venue: 'taco' };
    }
    if (other === 'alcordexmain') {
      const want = parseOrderMemo(memo);
      if (want) return { k: 'order-place', want };
    }
    return { k: 'out' };
  }
  if (other === 'swap.alcor') {
    return /^Swap (tokenOut|Change)/.test(memo) ? { k: 'swap-in', venue: 'alcor' } : { k: 'lp-remove', venue: 'alcor' };
  }
  if (other === 'swap.box') {
    return /swap token/i.test(memo) ? { k: 'swap-in', venue: 'defibox' } : { k: 'lp-remove', venue: 'defibox' };
  }
  if (other === 'swap.taco') {
    return trxHasTacoSwap && memo === '' ? { k: 'swap-in', venue: 'taco' } : { k: 'lp-remove', venue: 'taco' };
  }
  if (other === 'alcordexmain') return /order match/i.test(memo) ? { k: 'order-fill' } : { k: 'order-return' };
  if (REWARD_SENDERS.has(other) || REWARD_MEMO.test(memo)) return { k: 'reward' };
  return { k: 'in' };
}

function addTo(list: TokenAmount[], a: TokenAmount) {
  const hit = list.find((x) => x.key === a.key);
  if (hit) {
    hit.amount += a.amount;
    hit.precision = Math.max(hit.precision, a.precision);
  } else list.push({ ...a });
}

/** Rounds away float dust at the token's own precision. */
function clean(a: number, precision: number) {
  const f = 10 ** Math.min(precision, 12);
  return Math.round(a * f) / f;
}

/**
 * Classifies every transaction of `account`. Transfers are de-duplicated by
 * global sequence (history services repeat notifications) and processed in
 * chain order, so results are deterministic.
 */
/**
 * Some token contracts re-send a transfer as an inline copy of itself (same
 * from/to/amount/memo, created by the original action) only to notify the
 * receiver. Hyperion lists it as its own action, but the balance moves once,
 * so the copy is dropped. Genuine repeated transfers are separate top-level
 * or sibling actions and are kept.
 */
export function withoutRedispatches(transfers: RawTransfer[]): RawTransfer[] {
  const byOrd = new Map<string, RawTransfer>();
  for (const t of transfers) if (t.ord != null) byOrd.set(`${t.trx}:${t.ord}`, t);
  return transfers.filter((t) => {
    if (!t.parent) return true;
    const p = byOrd.get(`${t.trx}:${t.parent}`);
    return !(p && p.contract === t.contract && p.from === t.from && p.to === t.to && p.quantity === t.quantity && p.memo === t.memo);
  });
}

export function classifyTransfers(transfers: RawTransfer[], account: string): FolioEvent[] {
  const unique = new Map<number, RawTransfer>();
  for (const t of transfers) {
    if (t.from === t.to) continue;
    if (t.from !== account && t.to !== account) continue;
    if (!unique.has(t.gs)) unique.set(t.gs, t);
  }
  const ordered = withoutRedispatches([...unique.values()]).sort((a, b) => a.gs - b.gs);
  const byTrx = new Map<string, RawTransfer[]>();
  for (const t of ordered) {
    const list = byTrx.get(t.trx);
    if (list) list.push(t);
    else byTrx.set(t.trx, [t]);
  }

  const events: FolioEvent[] = [];
  for (const [trx, list] of byTrx) {
    const ts = list[0].ts;
    let swapSeq = Infinity;
    const hasTacoSwap = list.some((t) => t.from === account && t.to === 'swap.taco' && !!parseOrderMemo(t.memo));
    let n = 0;
    const nextId = () => `${trx}:${n++}`;

    // Swap legs (any venue, any number of hops) are netted into ONE trade so
    // intermediate tokens and arbitrage cycles cancel out.
    const net = new Map<string, TokenAmount>();
    const venues = new Set<Venue>();
    const simple: { t: RawTransfer; kind: Kind; asset: TokenAmount }[] = [];
    for (const t of list) {
      const asset = parseAsset(t.quantity, t.contract);
      if (!asset || asset.amount <= 0) continue;
      const kind = kindOf(t, account, hasTacoSwap);
      if (kind.k === 'swap-out' || kind.k === 'swap-in') {
        venues.add(kind.venue);
        swapSeq = Math.min(swapSeq, t.gs);
        const sign = kind.k === 'swap-in' ? 1 : -1;
        const cur = net.get(asset.key) ?? { ...asset, amount: 0 };
        cur.amount += sign * asset.amount;
        cur.precision = Math.max(cur.precision, asset.precision);
        net.set(asset.key, cur);
      } else simple.push({ t, kind, asset });
    }
    if (net.size) {
      const out: TokenAmount[] = [];
      const inn: TokenAmount[] = [];
      for (const a of net.values()) {
        const v = clean(a.amount, a.precision);
        if (v < 0) out.push({ ...a, amount: -v });
        else if (v > 0) inn.push({ ...a, amount: v });
      }
      if (out.length || inn.length) {
        events.push({
          id: nextId(), trx, ts, seq: swapSeq, type: 'trade',
          venue: venues.size === 1 ? [...venues][0] : 'alcor',
          out, in: inn,
        });
      }
    }

    // Everything else, grouped by kind within the transaction.
    const groups = new Map<string, FolioEvent>();
    for (const { t, kind, asset } of simple) {
      if (kind.k === 'order-place') {
        // Each placement is its own order so fills can be matched to its price.
        events.push({ id: nextId(), trx, ts, seq: t.gs, type: 'order-placed', venue: 'alcor-orderbook', out: [asset], in: [], orderWant: kind.want, memo: t.memo });
        continue;
      }
      if (kind.k === 'order-fill') {
        const gave = t.fillGave ? parseAsset(t.fillGave.quantity, t.fillGave.contract) : null;
        events.push({ id: nextId(), trx, ts, seq: t.gs, type: 'trade', venue: 'alcor-orderbook', out: [], in: [asset], ...(gave ? { fillGave: gave } : {}) });
        continue;
      }
      const type =
        kind.k === 'order-return' ? 'order-returned'
        : kind.k === 'lp-add' ? 'liquidity-add'
        : kind.k === 'lp-remove' ? 'liquidity-remove'
        : kind.k === 'reward' ? 'reward'
        : kind.k === 'nulled' ? 'nulled'
        : kind.k === 'in' ? 'received'
        : 'sent';
      const counterparty = t.from === account ? t.to : t.from;
      const venue = 'venue' in kind ? kind.venue : kind.k === 'order-return' ? 'alcor-orderbook' : undefined;
      const gk = `${type}|${venue ?? ''}|${type === 'sent' || type === 'received' ? counterparty : ''}`;
      let ev = groups.get(gk);
      if (!ev) {
        ev = { id: nextId(), trx, ts, seq: t.gs, type, venue, out: [], in: [], counterparty, memo: t.memo };
        groups.set(gk, ev);
        events.push(ev);
      }
      if (t.from === account) addTo(ev.out, asset);
      else addTo(ev.in, asset);
    }
  }
  return events;
}
