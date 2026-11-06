// CHEESECrypt tips: `/tip <amount> [cheese] [note]` sent as a reply. The CHEESE moves wallet-to-wallet
// (sender → replied-to author) via cheeseburger::transfer in the SAME transaction as an ordinary encrypted
// chat message carrying the tip card. crypt.cheese never receives or holds tip funds.
// Wire form (inside the encrypted reply body): "\u0007T1:<recipient>:<amount 4dp>:<note>"
import { normalizeEndpoint, resolveEndpoints } from '@/lib/endpointResolver';

export const TIP_MARK = '\u0007T1:';
/** Fixed public memo on the transfer — the user's note never goes on chain in plaintext. */
export const TIP_MEMO = 'CHEESECrypt tip';
export const TIP_NOTE_MAX_CHARS = 120;
const LINE = /^\u0007T1:([a-z1-5.]{1,12}):(\d+\.\d{4}):([^\n]*)$/;
const COMMAND = /^\/tip(?:\s+|$)(\S*)\s*(?:cheese\b)?\s*([\s\S]*)$/i;

export interface Tip { recipient: string; amount: string; note: string }
export type TipParse = { ok: true; amount: string; note: string } | { ok: false; error: string };

export const isTipCommand = (text: string) => /^\/tip(\s|$)/i.test(text.trim());

/** Parses `/tip 100 cheese great work!` → amount "100.0000". */
export function parseTipCommand(text: string): TipParse {
  const m = COMMAND.exec(text.trim());
  if (!m) return { ok: false, error: 'Use /tip <amount> cheese <optional note>' };
  const raw = m[1];
  if (!/^\d+(\.\d{1,4})?$/.test(raw)) return { ok: false, error: 'Enter an amount with up to 4 decimals, e.g. /tip 100 cheese great work!' };
  const [whole, frac = ''] = raw.split('.');
  const units = BigInt(whole) * 10000n + BigInt((frac + '0000').slice(0, 4));
  if (units <= 0n) return { ok: false, error: 'The tip must be more than 0 CHEESE.' };
  if (units > 10_000_000_000_000n) return { ok: false, error: 'That amount is too large.' };
  const note = m[2].replace(/\s+/g, ' ').trim();
  if (Array.from(note).length > TIP_NOTE_MAX_CHARS) return { ok: false, error: `Keep the tip note under ${TIP_NOTE_MAX_CHARS} characters.` };
  const amount = `${units / 10000n}.${(units % 10000n).toString().padStart(4, '0')}`;
  return { ok: true, amount, note };
}

export function encodeTip(t: Tip): string {
  if (!/^[a-z1-5.]{1,12}$/.test(t.recipient) || !/^\d+\.\d{4}$/.test(t.amount)) throw new Error('Invalid tip');
  return `${TIP_MARK}${t.recipient}:${t.amount}:${t.note.replace(/\n/g, ' ')}`;
}

export function parseTip(text: string | null | undefined): Tip | null {
  const m = text ? LINE.exec(text) : null;
  return m ? { recipient: m[1], amount: m[2], note: m[3] } : null;
}

/** The public wallet-to-wallet leg prepended to the message actions. */
export function buildTipTransfer(from: string, tip: Tip, auth: unknown[]) {
  return { account: 'cheeseburger', name: 'transfer', authorization: auth, data: { from, to: tip.recipient, quantity: `${tip.amount} CHEESE`, memo: TIP_MEMO } };
}

type RawAction = { act?: { account?: string; name?: string; authorization?: { actor?: string }[]; data?: { from?: string; to?: string; quantity?: string; amount?: number | string; symbol?: string; memo?: string } } };

/** Verified only if the same transaction has a sender-authorized CHEESE transfer to the recipient for exactly this amount with the tip memo. */
export function verifyTip(sender: string, tip: Tip, actions: unknown[]): boolean {
  return actions.some(raw => {
    const a = (raw as RawAction)?.act;
    const d = a?.data;
    if (a?.account !== 'cheeseburger' || a.name !== 'transfer' || !d) return false;
    if (!a.authorization?.some(x => x.actor === sender)) return false;
    const qty = d.quantity ?? (d.amount != null && d.symbol ? `${Number(d.amount).toFixed(4)} ${d.symbol}` : '');
    return d.from === sender && d.to === tip.recipient && qty === `${tip.amount} CHEESE` && d.memo === TIP_MEMO;
  });
}

const verified = new Map<string, boolean>();
/** Fetches the transaction (Hyperion) and verifies; null when it could not be read yet. */
export async function fetchTipVerified(txId: string, sender: string, tip: Tip): Promise<boolean | null> {
  const k = `${txId}|${sender}|${tip.recipient}|${tip.amount}`;
  if (verified.has(k)) return verified.get(k)!;
  for (const raw of await resolveEndpoints('hyperion-v2')) {
    const base = normalizeEndpoint(raw);
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 10000);
      const r = await fetch(`${base}/v2/history/get_transaction?id=${encodeURIComponent(txId)}`, { signal: ctl.signal }).finally(() => clearTimeout(t));
      if (!r.ok) continue;
      const j = await r.json();
      if (!Array.isArray(j.actions) || !j.actions.length) continue;
      const ok = verifyTip(sender, tip, j.actions);
      verified.set(k, ok);
      return ok;
    } catch { /* next endpoint */ }
  }
  return null;
}
