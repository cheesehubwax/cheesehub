/** Shared destinations for public WAX account, transaction and NFT inspection. */
export const EXPLORER_BASE = 'https://explorer.alcor.exchange/wax';
export const EXPLORER_NAME = 'Alcor Explorer';

export function explorerTx(id: string): string {
  return `${EXPLORER_BASE}/transaction/${encodeURIComponent(id)}`;
}

export function explorerAccount(name: string): string {
  return `${EXPLORER_BASE}/account/${encodeURIComponent(name)}`;
}

/** Alcor Explorer has no NFT asset view; use AtomicHub's WAX asset explorer. */
export function explorerAsset(id: string): string {
  return `https://wax.atomichub.io/explorer/asset/wax-mainnet/${encodeURIComponent(id)}`;
}