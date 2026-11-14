import { describe, expect, it } from 'vitest';
import { generateKey } from '@/lib/cheeseCrypt';
import { groupBackupName, readGroupBackup, writeGroupBackup, type GroupBackup } from '@/lib/cryptGroupBackup';
import type { DirHandle } from '@/lib/cryptVault';

const owner = generateKey('alice'), member = generateKey('bob');
const id = '00112233445566ff';
const backup: GroupBackup = {
  invites: { [id]: { id, name: 'Private room', creator: 'alice', created: 1, members: [owner, member].map(k => ({ account: k.account, publicKey: k.publicKey })) } },
  decisions: { [id]: { status: 'left', at: 10 } }, requests: {}, controls: [],
};
function folder() {
  let text = '';
  const root: DirHandle = { name: 'cheesecrypt', getDirectoryHandle: async () => root, getFileHandle: async () => ({
    getFile: async () => ({ text: async () => text }), createWritable: async () => {
      let staged = '';
      return { write: async v => { staged = v; }, close: async () => { text = staged; }, abort: async () => {} };
    },
  }) };
  return { root, read: () => text, replace: (value: string) => { text = value; } };
}
describe('encrypted group folder backup', () => {
  it('restores roster and leave decision after browser reset without plaintext room or member data', async () => {
    const f = folder();
    await writeGroupBackup(f.root, owner, backup);
    expect(await readGroupBackup(f.root, owner)).toEqual(backup);
    expect(f.read()).not.toContain('Private room');
    expect(f.read()).not.toContain(member.publicKey);
    expect(f.read()).not.toContain(owner.secretKey);
    expect(groupBackupName('alice')).toBe('alice-cheesecrypt-groups.json');
  });
  it('rejects another account or a replaced key', async () => {
    const f = folder(); await writeGroupBackup(f.root, owner, backup);
    expect(await readGroupBackup(f.root, member)).toBeNull();
    expect(await readGroupBackup(f.root, generateKey('alice'))).toBeNull();
  });
  it('rejects tampering and invalid rosters without replacing the file', async () => {
    const f = folder(); await writeGroupBackup(f.root, owner, backup);
    const before = f.read();
    await expect(writeGroupBackup(f.root, owner, { ...backup, invites: { [id]: { ...backup.invites[id], creator: 'carol' } } })).rejects.toThrow();
    expect(f.read()).toBe(before);
    const e = JSON.parse(before); e.box = `${e.box[0] === 'A' ? 'B' : 'A'}${e.box.slice(1)}`;
    f.replace(JSON.stringify(e)); expect(await readGroupBackup(f.root, owner)).toBeNull();
  });
  it('opens a pre-rotation backup only with the retained matching key', async () => {
    const f = folder(); await writeGroupBackup(f.root, owner, backup);
    const next = generateKey('alice');
    const ring = { ...next, retired: [{ publicKey: owner.publicKey, secretKey: owner.secretKey, retiredAt: Date.now() }] };
    expect(await readGroupBackup(f.root, ring)).toEqual(backup);
  });
});