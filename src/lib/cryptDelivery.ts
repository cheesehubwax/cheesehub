/**
 * Delivery ticks: a message that appears in chain history is in a block (✔); once that block's time is at or
 * before the chain's last irreversible block time it can never be undone (✔✔). Times are UTC block timestamps,
 * so no per-message lookup is needed: one shared get_info covers every message.
 */
import { hedgedJson } from '@/lib/chainRequest';
import { WAX_RPC_ENDPOINTS } from '@/lib/waxRpcFallback';

export type DeliveryState = 'sent' | 'permanent';

/** Parse get_info's last_irreversible_block_time (UTC, no zone suffix); null when missing/invalid. */
export function parseLibTime(info: unknown): number | null {
  const raw = (info as { last_irreversible_block_time?: unknown } | null)?.last_irreversible_block_time;
  if (typeof raw !== 'string') return null;
  const t = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(raw) ? raw : `${raw}Z`);
  return Number.isFinite(t) ? t : null;
}

/** Unknown irreversibility (null) never claims permanence. */
export function deliveryState(messageTime: number, libTime: number | null): DeliveryState {
  return libTime != null && messageTime <= libTime ? 'permanent' : 'sent';
}

export async function fetchLibTime(): Promise<number | null> {
  const { data } = await hedgedJson<unknown>('/v1/chain/get_info', { feature: 'chain-api', fallback: WAX_RPC_ENDPOINTS, body: {}, timeoutMs: 8000 });
  return parseLibTime(data);
}
