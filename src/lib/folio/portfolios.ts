import type { FolioEvent, LedgerResult } from './types';

export interface FolioPortfolio {
  id: string;
  name: string;
  tokenKeys: string[];
  createdAt: number;
  updatedAt: number;
}

const TOKEN_KEY = /^[a-z1-5.]{1,13}:[A-Z]{1,7}$/;
export function validPortfolios(value: unknown): value is FolioPortfolio[] {
  if (!Array.isArray(value)) return false;
  const ids = new Set<string>();
  return value.every((p) => {
    if (!p || typeof p !== 'object' || typeof p.id !== 'string' || !p.id || p.id.length > 100 || ids.has(p.id)) return false;
    ids.add(p.id);
    return typeof p.name === 'string' && p.name.trim().length > 0 && p.name.length <= 80
      && Array.isArray(p.tokenKeys) && p.tokenKeys.every((k: unknown) => typeof k === 'string' && TOKEN_KEY.test(k))
      && typeof p.createdAt === 'number' && Number.isFinite(p.createdAt) && p.createdAt >= 0
      && typeof p.updatedAt === 'number' && Number.isFinite(p.updatedAt) && p.updatedAt >= p.createdAt;
  });
}

/** The newer definition wins for an identical ID; unrelated portfolios survive. */
export function mergePortfolios(local: FolioPortfolio[], imported: FolioPortfolio[]): FolioPortfolio[] {
  const byId = new Map(local.map((p) => [p.id, p]));
  for (const p of imported) {
    const have = byId.get(p.id);
    if (!have || p.updatedAt > have.updatedAt) byId.set(p.id, { ...p, tokenKeys: [...new Set(p.tokenKeys)] });
  }
  return [...byId.values()];
}

/** Filter only after the complete account ledger has been costed. Keep both trade legs. */
export function scopePortfolio(ledger: LedgerResult, events: FolioEvent[], keys: Set<string> | null) {
  if (!keys) return { ledger, events };
  const scopedEvents = events.filter((e) => [...e.in, ...e.out, ...(e.fillGave ? [e.fillGave] : [])].some((a) => keys.has(a.key)));
  const sum = (source: Map<string, Map<string, number>>) => {
    const result = new Map<string, number>();
    for (const [id, tokens] of source) {
      let value = 0, found = false;
      for (const [key, amount] of tokens) if (keys.has(key)) { value += amount; found = true; }
      if (found) result.set(id, value);
    }
    return result;
  };
  return {
    events: scopedEvents,
    ledger: {
      ...ledger,
      positions: new Map([...ledger.positions].filter(([key]) => keys.has(key))),
      realizedByEvent: sum(ledger.realizedByEventToken),
      realizedUsdByEvent: sum(ledger.realizedUsdByEventToken),
    },
  };
}