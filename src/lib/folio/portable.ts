// CHEESEFolio portable file: a sectioned, versioned JSON the user can save and
// load. Only raw transfers travel; everything else is re-derived on load.
import { FOLIO_SCHEMA, type ProviderCursor, type ScanWindow, type StoredFolio } from './storage';
import type { RawTransfer } from './types';

export const PORTABLE_FORMAT = 'cheesefolio';
export const PORTABLE_VERSION = 1;

export interface PortableHistory {
  schema: number;
  transfers: RawTransfer[];
  cursors: Record<string, ProviderCursor>;
  syncedAt: number | null;
  coverageFrom?: number;
  accountCreated?: number;
  checksum: string;
}

export interface PortableFile {
  format: typeof PORTABLE_FORMAT;
  version: number;
  exportedAt: string;
  account: string;
  /** Unknown sections are ignored so later additions stay loadable. */
  sections: { history?: PortableHistory; [k: string]: unknown };
}

export class PortableError extends Error {}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function exportFolio(rec: StoredFolio, now = new Date()): Promise<PortableFile> {
  const transfers = [...rec.transfers].sort((a, b) => a.gs - b.gs);
  return {
    format: PORTABLE_FORMAT,
    version: PORTABLE_VERSION,
    exportedAt: now.toISOString(),
    account: rec.account,
    sections: {
      history: {
        schema: rec.schema,
        transfers,
        cursors: rec.cursors,
        syncedAt: rec.syncedAt,
        ...(rec.coverageFrom != null ? { coverageFrom: rec.coverageFrom } : {}),
        ...(rec.accountCreated != null ? { accountCreated: rec.accountCreated } : {}),
        checksum: await sha256(JSON.stringify(transfers)),
      },
    },
  };
}

export function downloadFolioFile(file: PortableFile): void {
  const blob = new Blob([JSON.stringify(file)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cheesefolio-${file.account}-${file.exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const ACCOUNT = /^[a-z1-5.]{1,13}$/;
const ASSET = /^\d+(\.\d+)? [A-Z]{1,7}$/;
const TRX = /^[0-9a-f]{64}$/i;

function validTransfer(t: unknown): t is RawTransfer {
  if (!isObj(t)) return false;
  if (!isNum(t.gs) || !Number.isInteger(t.gs) || t.gs < 0) return false;
  if (!isStr(t.trx) || !TRX.test(t.trx) || !isNum(t.ts)) return false;
  if (![t.contract, t.from, t.to].every((s) => isStr(s) && ACCOUNT.test(s))) return false;
  if (!isStr(t.quantity) || !ASSET.test(t.quantity) || !isStr(t.memo)) return false;
  if (t.ord !== undefined && !isNum(t.ord)) return false;
  if (t.parent !== undefined && !isNum(t.parent)) return false;
  if (t.fillChecked !== undefined && typeof t.fillChecked !== 'boolean') return false;
  if (t.fillGave !== undefined && t.fillGave !== null) {
    const g = t.fillGave;
    if (!isObj(g) || !isStr(g.contract) || !ACCOUNT.test(g.contract) || !isStr(g.quantity) || !ASSET.test(g.quantity)) return false;
  }
  return true;
}

const isTime = (v: unknown) => v === null || (isStr(v) && Number.isFinite(Date.parse(v)));
function validWindow(w: unknown): w is ScanWindow {
  return isObj(w) && isTime(w.after) && isTime(w.before) && typeof w.done === 'boolean';
}
function validCursor(c: unknown): c is ProviderCursor {
  if (!isObj(c) || !isTime(c.after) || typeof c.caughtUp !== 'boolean') return false;
  if (c.limit !== undefined && !(isNum(c.limit) && c.limit > 0)) return false;
  if (c.windows !== undefined && !(Array.isArray(c.windows) && c.windows.every(validWindow))) return false;
  return true;
}

/** Strictly validates a saved file for `account`; throws PortableError with a readable reason. */
export async function parseFolioFile(text: string, account: string): Promise<PortableHistory> {
  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new PortableError('This file is not valid JSON.'); }
  if (!isObj(data) || data.format !== PORTABLE_FORMAT) throw new PortableError('This is not a CHEESEFolio file.');
  if (!isNum(data.version) || data.version > PORTABLE_VERSION) throw new PortableError('This file was made by a newer version of CHEESEFolio. Reload the page and try again.');
  if (data.account !== account) throw new PortableError(`This file is for ${String(data.account)}, but you are signed in as ${account}.`);
  if (!isObj(data.sections) || !isObj(data.sections.history)) throw new PortableError('This file has no saved history in it.');
  const h = data.sections.history;
  if (h.schema !== FOLIO_SCHEMA) {
    throw new PortableError(isNum(h.schema) && h.schema > FOLIO_SCHEMA
      ? 'This history was saved by a newer version of CHEESEFolio. Reload the page and try again.'
      : 'This history was saved in an older format that can no longer be loaded. Please scan again.');
  }
  if (!Array.isArray(h.transfers) || !isStr(h.checksum)) throw new PortableError('This file is damaged (history is missing).');
  if ((await sha256(JSON.stringify(h.transfers))) !== h.checksum.toLowerCase()) throw new PortableError('This file is damaged or was edited (checksum does not match).');
  const bad = h.transfers.findIndex((t) => !validTransfer(t));
  if (bad >= 0) throw new PortableError(`This file is damaged (transfer #${bad + 1} is invalid).`);
  if (!isObj(h.cursors) || !Object.values(h.cursors).every(validCursor)) throw new PortableError('This file is damaged (scan progress is invalid).');
  if (!(h.syncedAt === null || isNum(h.syncedAt))) throw new PortableError('This file is damaged (sync time is invalid).');
  if (h.coverageFrom !== undefined && !isNum(h.coverageFrom)) throw new PortableError('This file is damaged (coverage is invalid).');
  if (h.accountCreated !== undefined && !isNum(h.accountCreated)) throw new PortableError('This file is damaged (creation time is invalid).');
  return {
    schema: FOLIO_SCHEMA,
    transfers: h.transfers as RawTransfer[],
    cursors: h.cursors as Record<string, ProviderCursor>,
    syncedAt: h.syncedAt as number | null,
    ...(h.coverageFrom !== undefined ? { coverageFrom: h.coverageFrom as number } : {}),
    ...(h.accountCreated !== undefined ? { accountCreated: h.accountCreated as number } : {}),
    checksum: h.checksum,
  };
}

/** Higher = more detail: a found fill record beats a checked miss beats unchecked. */
const detail = (t: RawTransfer) => (t.fillGave ? 2 : t.fillChecked ? 1 : 0);

/** Finished beats unfinished, then whichever read further. Windows travel with the chosen cursor. */
function pickCursor(a: ProviderCursor, b: ProviderCursor): ProviderCursor {
  if (a.caughtUp !== b.caughtUp) return a.caughtUp ? a : b;
  const ta = a.after ? Date.parse(a.after) : -Infinity;
  const tb = b.after ? Date.parse(b.after) : -Infinity;
  return tb > ta ? b : a;
}

export interface MergeResult {
  rec: StoredFolio;
  added: number;
  alreadySaved: number;
}

export function mergeFolio(local: StoredFolio, imported: PortableHistory): MergeResult {
  const byGs = new Map<number, RawTransfer>(local.transfers.map((t) => [t.gs, t]));
  let added = 0;
  let alreadySaved = 0;
  for (const t of imported.transfers) {
    const have = byGs.get(t.gs);
    if (!have) { byGs.set(t.gs, t); added++; continue; }
    alreadySaved++;
    if (detail(t) > detail(have)) byGs.set(t.gs, t);
  }
  const cursors: Record<string, ProviderCursor> = { ...local.cursors };
  for (const [k, c] of Object.entries(imported.cursors)) cursors[k] = cursors[k] ? pickCursor(cursors[k], c) : c;
  const min = (a?: number, b?: number) => (a == null ? b : b == null ? a : Math.min(a, b));
  const syncedAt = local.syncedAt == null ? imported.syncedAt : imported.syncedAt == null ? local.syncedAt : Math.max(local.syncedAt, imported.syncedAt);
  const coverageFrom = min(local.coverageFrom, imported.coverageFrom);
  const accountCreated = local.accountCreated ?? imported.accountCreated;
  const rec: StoredFolio = {
    account: local.account,
    schema: FOLIO_SCHEMA,
    transfers: [...byGs.values()].sort((a, b) => a.gs - b.gs),
    cursors,
    syncedAt,
    ...(coverageFrom != null ? { coverageFrom } : {}),
    ...(accountCreated != null ? { accountCreated } : {}),
  };
  return { rec, added, alreadySaved };
}
