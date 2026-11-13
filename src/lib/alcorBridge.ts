/**
 * Alcor bridge (third-party, non-custodial for CHEESEHub): read-only API
 * helpers and pure parsing. CHEESEHub never signs, holds or routes funds here.
 * Docs: https://docs.alcor.exchange/api/bridge
 */
export const ALCOR_BRIDGE_API = 'https://telos.alcor.exchange/api/bridge/v1';
export const ALCOR_WIDGET_ORIGIN = 'https://alcor.exchange';

export const CHAIN_NAMES: Record<string, string> = {
  mainnet: 'Ethereum', bsc: 'BNB Smart Chain', polygon: 'Polygon', telos: 'Telos',
  wax: 'WAX', xpr: 'XPR Network', vaulta: 'Vaulta', sui: 'Sui', near: 'NEAR', ton: 'TON',
};
export const chainName = (id: string) => CHAIN_NAMES[id] ?? id;

export interface BridgeRoute {
  symbol: string; precision: number; from: string; to: string;
  via: string | null; open: boolean; min: string; max: string;
}

export interface DepositToken { symbol: string; decimals: number; min: string; max: string; least?: string }
export interface DepositChain { id: string; name: string; chainId: number; tokens: DepositToken[] }
export interface DepositAddress { address: string; chains: DepositChain[] }

export interface BridgeHop {
  key: string;
  status: string;
  progress?: { stage?: string; percent?: number | null; etaSeconds?: number | null };
  from?: { chain?: string; address?: string };
  to?: { chain?: string; recipient?: string };
  deposit?: { symbol?: string; amount?: string; precision?: number; src_tx?: string };
}

/** Exact integer → decimal string (no float rounding). Returns null on bad input. */
export function formatRawUnits(raw: string, decimals: number): string | null {
  if (!/^\d+$/.test(raw) || !Number.isInteger(decimals) || decimals < 0) return null;
  if (decimals === 0) return raw.replace(/^0+(?=\d)/, '');
  const s = raw.padStart(decimals + 1, '0');
  const int = s.slice(0, -decimals).replace(/^0+(?=\d)/, '');
  const frac = s.slice(-decimals).replace(/0+$/, '');
  return frac ? `${int}.${frac}` : int;
}

/** Routes that touch WAX, split into arriving and leaving, sorted stably. */
export function waxRoutes(routes: BridgeRoute[]) {
  const sort = (a: BridgeRoute, b: BridgeRoute) =>
    a.symbol.localeCompare(b.symbol) || a.from.localeCompare(b.from) || a.to.localeCompare(b.to);
  return {
    into: routes.filter((r) => r.to === 'wax' && r.from !== 'wax').sort(sort),
    outOf: routes.filter((r) => r.from === 'wax' && r.to !== 'wax').sort(sort),
  };
}

export const IN_FLIGHT = new Set(['arriving', 'sending', 'returning']);
export const isInFlight = (h: BridgeHop) => IN_FLIGHT.has(h.status);

/** Progress percent clamped 0–100; unknown stays null (never guessed). */
export function hopPercent(h: BridgeHop): number | null {
  const p = h.progress?.percent;
  if (typeof p === 'number' && Number.isFinite(p)) return Math.max(0, Math.min(100, p));
  if (h.status === 'delivered' || h.status === 'returned') return 100;
  return null;
}

export const STATUS_LABEL: Record<string, string> = {
  arriving: 'On its way to Telos', sending: 'On its way to destination', delivered: 'Delivered',
  bounced: 'Refused, sent back', returning: 'Coming back to sender', returned: 'Back with sender',
};

const isWaxAccount = (a: string) => /^[a-z1-5.]{1,12}$/.test(a);

/** Widget iframe URL. No partner tag (no referral revenue). */
export function widgetUrl(opts: { recipient?: string | null; to?: string }) {
  const u = new URL('/embed/bridge', ALCOR_WIDGET_ORIGIN);
  u.searchParams.set('to', opts.to ?? 'wax');
  if (opts.recipient && isWaxAccount(opts.recipient)) u.searchParams.set('recipient', opts.recipient);
  u.searchParams.set('mode', 'inline');
  return u.toString();
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) throw new Error(`Alcor bridge answered ${res.status}`);
    return (await res.json()) as T;
  } finally { clearTimeout(t); }
}

export async function fetchRoutes(): Promise<BridgeRoute[]> {
  const d = await getJson<{ routes?: BridgeRoute[] }>(`${ALCOR_BRIDGE_API}/routes`);
  if (!Array.isArray(d.routes)) throw new Error('Unexpected routes answer');
  return d.routes;
}

export async function fetchHops(party: string): Promise<BridgeHop[]> {
  const d = await getJson<{ hops?: BridgeHop[] }>(`${ALCOR_BRIDGE_API}/hops?party=${encodeURIComponent(party)}`);
  if (!Array.isArray(d.hops)) throw new Error('Unexpected transfers answer');
  return d.hops;
}

/** Same request always returns the same permanent address (rate limited: 20/h). */
export async function fetchDepositAddress(account: string): Promise<DepositAddress> {
  if (!isWaxAccount(account)) throw new Error('Invalid WAX account');
  const d = await getJson<DepositAddress>(`${ALCOR_BRIDGE_API}/deposit-addresses`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chain: 'wax', to: account }),
  });
  if (!/^0x[0-9a-fA-F]{40}$/.test(d.address ?? '') || !Array.isArray(d.chains)) throw new Error('Unexpected deposit address answer');
  return d;
}
