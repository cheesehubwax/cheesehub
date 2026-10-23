import { describe, expect, it } from 'vitest';
import { generateKey, toPublicFile } from '@/lib/cheeseCrypt';
import { decodeKeyFileBytes, readKeyFileJson } from '@/lib/cryptKeyFileText';
import { findPrivateKey, readFriendKeys, readVaultMarks, writeVaultMarks, type DirHandle } from '@/lib/cryptVault';
import { firstVisitMarks, mergeMarks, normalizeMarks, parseReadStateFile, toReadStateFile } from '@/lib/cryptUnread';

const utf16le = (s: string, bom: boolean) => {
  const out = new Uint8Array((bom ? 2 : 0) + s.length * 2);
  if (bom) { out[0] = 0xff; out[1] = 0xfe; }
  for (let i = 0; i < s.length; i++) { out[(bom ? 2 : 0) + i * 2] = s.charCodeAt(i) & 0xff; out[(bom ? 2 : 0) + i * 2 + 1] = s.charCodeAt(i) >> 8; }
  return out;
};
const blob = (bytes: Uint8Array) => ({ size: bytes.length, arrayBuffer: async () => bytes.slice().buffer, text: async () => new TextDecoder().decode(bytes) });

function fakeDir(name: string, files: Record<string, string | Uint8Array> = {}, dirs: Record<string, DirHandle> = {}): DirHandle & { files: Map<string, string | Uint8Array> } {
  const f = new Map(Object.entries(files));
  return {
    name, files: f,
    async getDirectoryHandle(n) { if (!dirs[n]) throw new DOMException('x', 'NotFoundError'); return dirs[n]; },
    async getFileHandle(n, o) {
      if (!f.has(n) && !o?.create) throw new DOMException('x', 'NotFoundError');
      return {
        getFile: async () => { const v = f.get(n) ?? ''; return blob(typeof v === 'string' ? new TextEncoder().encode(v) : v); },
        createWritable: async () => { let staged = ''; return { write: async (d: string) => { staged = d; }, close: async () => { f.set(n, staged); }, abort: async () => {} }; },
      };
    },
    async *values() { for (const n of Object.keys(dirs)) yield { kind: 'directory', name: n }; for (const n of f.keys()) yield { kind: 'file', name: n }; },
  };
}

describe('finding key files by their contents', () => {
  const key = generateKey('alice');
  const json = JSON.stringify(key);

  it('reads UTF-8 with BOM, UTF-16 with BOM and BOM-less UTF-16 key files', async () => {
    const bom8 = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(json)]);
    for (const bytes of [bom8, utf16le(json, true), utf16le(json, false)]) {
      expect(await readKeyFileJson(blob(bytes))).toEqual(JSON.parse(json));
    }
    expect(decodeKeyFileBytes(new Uint8Array([0xfe, 0xff, 0, 0x7b, 0, 0x7d]))).toBe('{}');
  });

  it('finds the private key whatever the file is called, in a differently-cased key folder', async () => {
    const keys = fakeDir('My Private Key', { 'notes.txt': 'hello', 'backup copy.json.txt': utf16le(json, true) });
    const root = fakeDir('cheesecrypt', {}, { 'My Private Key': keys });
    expect((await findPrivateKey(root, 'alice'))?.secretKey).toBe(key.secretKey);
    expect(await findPrivateKey(root, 'bob')).toBeNull();
  });

  it('a public key file never counts as the private key; friends load from any file name', async () => {
    const pub = JSON.stringify(toPublicFile(generateKey('bob')));
    const root = fakeDir('cheesecrypt', { 'alice-pub.json': JSON.stringify(toPublicFile(key)) }, { friends: fakeDir('friends', { 'bob.txt': pub, '._bob.txt': pub }) });
    expect(await findPrivateKey(root, 'alice')).toBeNull();
    expect((await readFriendKeys(root)).map(f => f.account)).toEqual(['bob']);
  });
});

describe('read markers shared with the folder', () => {
  it('newest read time wins per chat', () => {
    expect(mergeMarks({ bob: 5, 'group:0123456789abcdef': 9 }, { bob: 7, carol: 2 })).toEqual({ bob: 7, carol: 2, 'group:0123456789abcdef': 9 });
  });

  it('drops invalid chat ids and times', () => {
    expect(normalizeMarks({ bob: 3, 'BAD NAME': 1, 'group:xyz': 4, carol: -1, dave: 1.5 })).toEqual({ bob: 3 });
  });

  it('only accepts a read-state file for the same account', () => {
    const file = toReadStateFile('alice', { bob: 4 });
    expect(parseReadStateFile(file, 'alice')).toEqual({ bob: 4 });
    expect(parseReadStateFile(file, 'mallory')).toBeNull();
    expect(parseReadStateFile({ ...file, version: 2 }, 'alice')).toBeNull();
  });

  it('on a new device the folder markers override the start-read baseline', () => {
    expect(firstVisitMarks({ bob: 10, carol: 8 }, { bob: 4 })).toEqual({ bob: 4, carol: 8 });
    expect(firstVisitMarks({ bob: 10 }, null)).toEqual({ bob: 10 });
  });

  it('writes and reads back the folder file', async () => {
    const root = fakeDir('cheesecrypt');
    await writeVaultMarks(root, 'alice', { bob: 12 });
    expect(await readVaultMarks(root, 'alice')).toEqual({ bob: 12 });
    expect(await readVaultMarks(root, 'bob')).toBeNull();
  });
});
