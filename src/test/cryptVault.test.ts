import { describe, expect, it } from 'vitest';
import { DirHandle, VaultFileExistsError, prepareVault, writeFriendKey, writePrivateKey } from '@/lib/cryptVault';
import type { MessagingKey } from '@/lib/cheeseCrypt';

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
      return { createWritable: async () => ({ write: async (d: string) => { files.set(n, d); }, close: async () => {} }) };
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
    expect(JSON.parse(friends.files.get('bob-cheesecrypt-public.json')!).publicKey).toBe('q');
  });
});
