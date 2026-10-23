// Key files are recognised by their contents, never their names: Windows "hidden extension" files
// (name.json.txt), renamed copies and files re-saved by Notepad as UTF-8-with-BOM or UTF-16 all work.

/** Key files are a few KB (avatar included); anything far bigger is not one and is never parsed. */
export const MAX_KEY_FILE_BYTES = 256 * 1024;

/** Decodes UTF-8 (with or without BOM) and UTF-16 LE/BE (with BOM, or BOM-less ASCII-range JSON). */
export function decodeKeyFileBytes(bytes: Uint8Array): string {
  const b = bytes;
  if (b.length >= 3 && b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) return new TextDecoder('utf-8').decode(b.subarray(3));
  if (b.length >= 2 && b[0] === 0xff && b[1] === 0xfe) return new TextDecoder('utf-16le').decode(b.subarray(2));
  if (b.length >= 2 && b[0] === 0xfe && b[1] === 0xff) return new TextDecoder('utf-16be').decode(b.subarray(2));
  // BOM-less UTF-16: JSON starts with an ASCII character, so one byte of the first pair is zero.
  if (b.length >= 4 && b.length % 2 === 0) {
    if (b[0] !== 0 && b[1] === 0 && b[3] === 0) return new TextDecoder('utf-16le').decode(b);
    if (b[0] === 0 && b[1] !== 0 && b[2] === 0) return new TextDecoder('utf-16be').decode(b);
  }
  return new TextDecoder('utf-8').decode(b);
}

/** Parses a key-file candidate's JSON; null when unreadable, too big or not JSON. A stray leading BOM char is dropped. */
export function parseKeyFileText(text: string): unknown {
  try { return JSON.parse(text.replace(/^\uFEFF/, '').trim()); } catch { return null; }
}

interface Readable { size?: number; arrayBuffer?(): Promise<ArrayBuffer>; text(): Promise<string> }

export async function readKeyFileJson(file: Readable): Promise<unknown> {
  if (typeof file.size === 'number' && file.size > MAX_KEY_FILE_BYTES) return null;
  try {
    if (file.arrayBuffer) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      return bytes.length > MAX_KEY_FILE_BYTES ? null : parseKeyFileText(decodeKeyFileBytes(bytes));
    }
    return parseKeyFileText(await file.text());
  } catch { return null; }
}

/** macOS resource-fork companions (._name) and OS clutter are never key files. */
export const skipFileName = (name: string) => name.startsWith('._') || /^(\.ds_store|thumbs\.db|desktop\.ini)$/i.test(name);
