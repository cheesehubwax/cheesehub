import type { ChainMemo } from '@/lib/cheeseCrypt';
import { KEY_PUBLISH_TO } from '@/lib/cheeseCrypt';
import type { HideTarget } from '@/lib/cryptRoomDenylist';

/**
 * Platform reports of public room listings, read by CHEESEHub admins on /admin:
 * a 0.0001 CHEESE transfer to eosio.null with memo `CRYPTREPORT1:{"c":creator,"i":roomId,"r":reason}`.
 * Reasons are fixed codes only, never free text, so nobody can publish abuse on chain while "reporting".
 * Notification only: a report never hides anything by itself; an admin decides with a CRYPTHIDE1: memo.
 */
export const REPORT_PREFIX = 'CRYPTREPORT1:';
export const REPORT_QUANTITY = '0.0001 CHEESE';
export const REPORT_EMAIL = 'cheesehub@protonmail.com';
export const REPORT_TELEGRAM = 'https://t.me/cheeseonwaxofficial';
const ACCOUNT = /^[a-z1-5.]{1,12}$/;
const ROOM_ID = /^[a-f0-9]{16}$/;

export const REPORT_REASONS = {
  1: 'Scam or phishing',
  2: 'Illegal or abusive material',
  3: 'Spam or malicious links',
  4: 'Harassment or defamation',
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;
const isReason = (v: unknown): v is ReportReason => v === 1 || v === 2 || v === 3 || v === 4;

export interface RoomReportRecord { creator: string; id: string; reason: ReportReason; reporter: string; time: number; txId: string }
export interface ReportedRoom { creator: string; id: string; reporters: number; reasons: Partial<Record<ReportReason, number>>; latest: number; reports: RoomReportRecord[] }

export function encodeReport(t: HideTarget, reason: ReportReason): string {
  if (!ACCOUNT.test(t.creator) || !ROOM_ID.test(t.id) || !isReason(reason)) throw new Error('Invalid report');
  return REPORT_PREFIX + JSON.stringify({ c: t.creator, i: t.id, r: reason });
}

export function parseReport(memo: string): (HideTarget & { reason: ReportReason }) | null {
  if (!memo.startsWith(REPORT_PREFIX)) return null;
  try {
    const o = JSON.parse(memo.slice(REPORT_PREFIX.length));
    if (typeof o?.c !== 'string' || !ACCOUNT.test(o.c) || typeof o.i !== 'string' || !ROOM_ID.test(o.i) || !isReason(o.r)) return null;
    return { creator: o.c, id: o.i, reason: o.r };
  } catch { return null; }
}

/** One vote per reporter per room (their newest reason), grouped by room, most reporters first then newest. */
export function collectReports(rows: ChainMemo[]): ReportedRoom[] {
  const latest = new Map<string, RoomReportRecord>();
  for (const r of [...rows].sort((a, b) => a.time - b.time)) {
    if (r.to !== KEY_PUBLISH_TO || !ACCOUNT.test(r.from) || !/^\d+\.\d{4} CHEESE$/.test(r.quantity.trim())) continue;
    const p = parseReport(r.memo);
    if (!p || p.creator === r.from) continue; // owners cannot pad or bury reports about their own room
    latest.set(`${p.creator}:${p.id}:${r.from}`, { ...p, reporter: r.from, time: r.time, txId: r.txId });
  }
  const rooms = new Map<string, ReportedRoom>();
  for (const rep of latest.values()) {
    const k = `${rep.creator}:${rep.id}`;
    const room = rooms.get(k) ?? { creator: rep.creator, id: rep.id, reporters: 0, reasons: {}, latest: 0, reports: [] };
    room.reporters += 1;
    room.reasons[rep.reason] = (room.reasons[rep.reason] ?? 0) + 1;
    room.latest = Math.max(room.latest, rep.time);
    room.reports.push(rep);
    rooms.set(k, room);
  }
  for (const r of rooms.values()) r.reports.sort((a, b) => b.time - a.time);
  return [...rooms.values()].sort((a, b) => b.reporters - a.reporters || b.latest - a.latest);
}

export function buildReportAction(reporter: string, auth: unknown[], target: HideTarget, reason: ReportReason) {
  return { account: 'cheeseburger', name: 'transfer', authorization: auth, data: { from: reporter, to: KEY_PUBLISH_TO, quantity: REPORT_QUANTITY, memo: encodeReport(target, reason) } };
}

export function reportEmailHref(room: { name: string; creator: string; id: string }) {
  const subject = `[CHEESECrypt Notice] Room report: ${room.name}`;
  const body = `Room name: ${room.name}\nCreator account: ${room.creator}\nRoom ID: ${room.id}\n\nWhat is wrong with this room:\n\n`;
  return `mailto:${REPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
