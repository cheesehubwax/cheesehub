import type { ChainMemo } from '@/lib/cheeseCrypt';

/** Shape checks only: this never substitutes for ciphertext or sender authentication. */
export const validHistoryTime = (time: unknown): time is number => typeof time === 'number' && Number.isSafeInteger(time) && time >= 0 && time <= 8_640_000_000_000_000;
export function isChainMemo(value: unknown): value is ChainMemo {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.txId === 'string' && !!row.txId && validHistoryTime(row.time)
    && typeof row.from === 'string' && /^[a-z1-5.]{1,12}$/.test(row.from)
    && typeof row.to === 'string' && /^[a-z1-5.]{1,12}$/.test(row.to)
    && typeof row.memo === 'string' && typeof row.quantity === 'string';
}