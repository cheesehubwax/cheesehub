import { isStorageQuotaError } from '@/lib/cryptStorage';
const ERROR_NAMES = new Set(['Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'URIError', 'EvalError', 'DOMException', 'QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED']);
const SAFE_FIELDS = new Set(['map', 'filter', 'sort', 'forEach', 'flatMap', 'startsWith', 'slice', 'localeCompare', 'includes', 'split', 'trim', 'time', 'from', 'to', 'memo', 'text', 'txId', 'group', 'id', 'members', 'name', 'avatar', 'displayName', 'control', 'kind', 'length', 'pixels']);
// Do not display arbitrary exception strings: they can contain decrypted messages or keys.
const SAFE_MESSAGES = [
  /^Cannot (?:read|set) properties of (?:undefined|null)(?: \((?:reading|setting) '[A-Za-z_$][\w$]{0,39}'\))?$/,
  /^Cannot convert undefined or null to object$/,
  /^Maximum (?:call stack size|update depth) exceeded\.?$/,
  /^Invalid (?:time value|array length)$/,
  /^(?:[A-Za-z_$][\w$]{0,39}\.)?(?:map|filter|sort|forEach|flatMap|startsWith|slice|localeCompare|includes|split|trim) is not a function$/,
];
export interface CryptDiagnostic { name: string; message: string; stack: string; storageQuota?: boolean }
export function cryptDiagnostic(error: unknown): CryptDiagnostic {
  let name = 'Error', message = 'Error details withheld for privacy.', stack = '';
  try {
    if (error instanceof Error) {
      if (ERROR_NAMES.has(error.name)) name = error.name;
      if (SAFE_MESSAGES.some(pattern => pattern.test(error.message))) {
        message = error.message.replace(/'([A-Za-z_$][\w$]*)'/g, (_, field: string) => SAFE_FIELDS.has(field) ? `'${field}'` : "'[redacted]'")
          .replace(/^[A-Za-z_$][\w$]*\.(?=\w+ is not a function$)/, '[value].');
      }
      // Keep only source locations, never the original stack header or function arguments.
      const frames = (error.stack ?? '').split('\n').slice(1, 21).flatMap(line => {
        const location = line.match(/(?:https?:\/\/[^\s/]+)?\/(?:src|assets|node_modules)\/[\w./@-]+\.(?:[cm]?js|tsx?)(?:\?[^\s)]*)?:\d+:\d+/)?.[0];
        if (!location) return [];
        const clean = location.replace(/\?.*(?=:\d+:\d+$)/, '').replace(/^https?:\/\/[^/]+/, '');
        return [`    at ${clean}`];
      });
      stack = frames.join('\n');
    }
  } catch { /* Never allow a hostile exception getter to break recovery. */ }
  const storageQuota = isStorageQuotaError(error);
  if (storageQuota) { name = 'QuotaExceededError'; message = 'Browser storage is full. Clear the lookup cache and retry.'; }
  return { name, message, stack: `${name}: ${message}${stack ? `\n${stack}` : ''}`, ...(storageQuota ? { storageQuota: true } : {}) };
}