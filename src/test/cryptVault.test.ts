import { describe, expect, it } from 'vitest';
import { DirHandle, VaultFileExistsError, prepareVault, updatePrivateKeyProfile, writeFriendKey, writePrivateKey } from '@/lib/cryptVault';
import { generateKey, type MessagingKey } from '@/lib/cheeseCrypt';

// In-memory folder handle mimicking the browser API.
function fakeDir(name: string): DirHandle & { dirs: Map<string, any>; files: Map<string, string> } {
  const dirs = new Map<string, any>(); const files = new Map<string, string>();
  return {
    name, dirs, files,
    async getDirectoryHandle(n, o) {
      if (!dirs.has(n)) { if (!o?.create) throw new DOMException('x', 'NotFoundError'); dirs.set(n, fakeDir(n)); }
      return dirs.get(n);
    },
    async getFileHandle(n, o) {
      if (!files.has(n) && !o?.create) throw new DOMException('x', 'NotFoundError');
      return { getFile: async () => ({ text: async () => files.get(n) ?? '' }), createWritable: async () => {
        let staged = '';
        return { write: async (d: string) => { staged = d; }, close: async () => { files.set(n, staged); }, abort: async () => {} };
      } };
    },
  };
}
const key = { type: 'gpk-msg-key', version: 1, account: 'alice', publicKey: 'p', secretKey: 's', created: '' } as MessagingKey;

describe('cheesecrypt key folder', () => {
  it('creates cheesecrypt with "my private key" and "friends" inside the chosen folder', async () => {
    const desktop = fakeDir('Desktop');
    const root = await prepareVault(desktop);
    expect(root.name).toBe('cheesecrypt');
    expect([...(desktop.dirs.get('cheesecrypt').dirs.keys())].sort()).toEqual(['friends', 'my private key']);
  });

  it('reuses a picked folder already named cheesecrypt', async () => {
    const picked = fakeDir('cheesecrypt');
    expect(await prepareVault(picked)).toBe(picked);
  });

  it('refuses to overwrite an existing private key file', async () => {
    const root = await prepareVault(fakeDir('Desktop'));
    await writePrivateKey(root, key);
    const folder = (await root.getDirectoryHandle('my private key')) as ReturnType<typeof fakeDir>;
    const first = folder.files.get('alice-cheesecrypt-key-PRIVATE.json');
    await expect(writePrivateKey(root, { ...key, secretKey: 'other' })).rejects.toBeInstanceOf(VaultFileExistsError);
    expect(folder.files.get('alice-cheesecrypt-key-PRIVATE.json')).toBe(first);
  });

  it('saves friends public keys into friends/', async () => {
    const root = await prepareVault(fakeDir('Desktop'));
    await writeFriendKey(root, { type: 'gpk-msg-pubkey', version: 1, account: 'bob', publicKey: 'q' });
    const friends = (await root.getDirectoryHandle('friends')) as ReturnType<typeof fakeDir>;
    expect(JSON.parse(friends.files.get('bob-cheesecrypt-public.json') ?? 'null').publicKey).toBe('q');
  });
  it('updates only profile fields in a matching backup, preserving keys and creation metadata', async () => {
    const root = await prepareVault(fakeDir('Desktop'));
    const original = generateKey('alice');
    await writePrivateKey(root, original);
    const updated = { ...original, created: 'not a replacement creation date', displayName: 'Alice Cheese', avatar: { version: 1 as const, pixels: '3'.repeat(64) } };
    await updatePrivateKeyProfile(root, updated);
    const dir = await root.getDirectoryHandle('my private key') as ReturnType<typeof fakeDir>;
    expect(JSON.parse(dir.files.get('alice-cheesecrypt-key-PRIVATE.json') ?? 'null')).toEqual({ ...original, displayName: updated.displayName, avatar: updated.avatar });
    await updatePrivateKeyProfile(root, { ...original, avatar: undefined, displayName: undefined });
    expect(JSON.parse(dir.files.get('alice-cheesecrypt-key-PRIVATE.json') ?? 'null')).toEqual(original);
  });
  it.each(['different pair', 'wrong account', 'malformed', 'missing', 'different public', 'different secret'])('never overwrites a %s backup', async kind => {
    const root = await prepareVault(fakeDir('Desktop'));
    const current = generateKey('alice');
    const dir = await root.getDirectoryHandle('my private key') as ReturnType<typeof fakeDir>;
    const other = generateKey('alice');
    const raw = kind === 'malformed' ? '{broken' : JSON.stringify(kind === 'different pair' ? other : kind === 'wrong account' ? { ...current, account: 'bob' } : kind === 'different public' ? { ...current, publicKey: other.publicKey } : kind === 'different secret' ? { ...current, secretKey: other.secretKey } : current);
    if (kind !== 'missing') dir.files.set('alice-cheesecrypt-key-PRIVATE.json', raw);
    const before = dir.files.get('alice-cheesecrypt-key-PRIVATE.json');
    await expect(updatePrivateKeyProfile(root, { ...current, displayName: 'Updated' })).rejects.toThrow();
    expect(dir.files.get('alice-cheesecrypt-key-PRIVATE.json')).toBe(before);
  });
  it('aborts a failed staged write and leaves the original backup intact', async () => {
    const root = await prepareVault(fakeDir('Desktop'));
    const current = generateKey('alice'); await writePrivateKey(root, current);
    const dir = await root.getDirectoryHandle('my private key') as ReturnType<typeof fakeDir>;
    const before = dir.files.get('alice-cheesecrypt-key-PRIVATE.json');
    const originalGet = dir.getFileHandle.bind(dir);
    let aborted = false;
    dir.getFileHandle = async (name, options) => ({ ...await originalGet(name, options), createWritable: async () => ({ write: async () => { throw new Error('Disk full'); }, close: async () => { throw new Error('Must not commit'); }, abort: async () => { aborted = true; } }) });
    await expect(updatePrivateKeyProfile(root, { ...current, displayName: 'Updated' })).rejects.toThrow('Disk full');
    expect(aborted).toBe(true);
    expect(dir.files.get('alice-cheesecrypt-key-PRIVATE.json')).toBe(before);
  });
});
