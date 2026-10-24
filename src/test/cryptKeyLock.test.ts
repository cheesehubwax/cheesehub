import { describe, expect, it } from 'vitest';
import { PrivateKey, Transaction, Serializer } from '@wharfkit/antelope';
import { generateKey, parseKeyFile, type MessagingKey } from '@/lib/cheeseCrypt';
import {
  LOCK_QUANTITY, LOCK_TOKEN_CONTRACT, LOCK_TX_EXPIRATION, buildLockTransaction, fromLockedFile, lockSecret, openLockedKey,
  parseLockedKeyFile, sealKey, signLock, toLockedFile, unlockSecret, withProfile,
} from '@/lib/cryptKeyLock';
import { DirHandle, findPrivateKey, replaceWithLocked, updatePrivateKeyProfile } from '@/lib/cryptVault';

const CHAIN = '1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4';
const wallet = PrivateKey.fromString('5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3');
const other = PrivateKey.fromString('5HpHagT65TZzG1PH3CSu63k8DbpvD8s5ip4nEB3kEsreAnchuDf');
const transferAbi = { version: 'eosio::abi/1.2', structs: [{ name: 'transfer', base: '', fields: [{ name: 'from', type: 'name' }, { name: 'to', type: 'name' }, { name: 'quantity', type: 'asset' }, { name: 'memo', type: 'string' }] }] };

/** Signs the lock transaction exactly as a wallet would (action data pre-encoded to avoid an ABI fetch). */
function sign(pk: PrivateKey, k: MessagingKey) {
  const t = buildLockTransaction(k.account, 'active', k.publicKey);
  const tx = Transaction.from({ ...t, actions: t.actions.map(a => ({ ...a, data: Serializer.encode({ object: a.data, type: 'transfer', abi: transferAbi }).hexString })) });
  return String(pk.signDigest(tx.signingDigest(CHAIN)));
}

function fakeDir(name: string): DirHandle & { dirs: Map<string, any>; files: Map<string, string> } {
  const dirs = new Map<string, any>(); const files = new Map<string, string>();
  return {
    name, dirs, files,
    async getDirectoryHandle(n, o) { if (!dirs.has(n)) { if (!o?.create) throw new DOMException('x', 'NotFoundError'); dirs.set(n, fakeDir(n)); } return dirs.get(n); },
    async getFileHandle(n, o) {
      if (!files.has(n) && !o?.create) throw new DOMException('x', 'NotFoundError');
      return { getFile: async () => ({ text: async () => files.get(n) ?? '' }), createWritable: async () => { let staged = ''; return { write: async (d: string) => { staged = d; }, close: async () => { files.set(n, staged); }, abort: async () => {} }; } };
    },
    async *values() { for (const n of dirs.keys()) yield { kind: 'directory', name: n }; for (const n of files.keys()) yield { kind: 'file', name: n }; },
  };
}

describe('wallet-locked CHEESECrypt key files', () => {
  it('lock request is a fixed, already-expired, zero CHEESE transfer to eosio.null naming the key', () => {
    const k = generateKey('alice');
    const t = buildLockTransaction(k.account, 'active', k.publicKey);
    expect(t).toEqual(buildLockTransaction(k.account, 'active', k.publicKey));
    expect(t.expiration).toBe('2020-01-01T00:00:00');
    expect(new Date(`${LOCK_TX_EXPIRATION}Z`).getTime()).toBeLessThan(Date.now());
    expect(t.actions[0].account).toBe(LOCK_TOKEN_CONTRACT);
    expect(t.actions[0].data).toEqual({ from: 'alice', to: 'eosio.null', quantity: '0.0000 CHEESE', memo: `CHEESECrypt key lock v1 ${k.publicKey}` });
    expect(LOCK_QUANTITY).toBe('0.0000 CHEESE');
  });

  it('wallet signatures over the lock request are deterministic', () => {
    const k = generateKey('alice');
    expect(sign(wallet, k)).toBe(sign(wallet, k));
  });

  it('round-trips through a v2 file that holds no secret', async () => {
    const k = generateKey('alice', { displayName: 'Alice' });
    const file = toLockedFile(k, await lockSecret(k.secretKey, sign(wallet, k)));
    const json = JSON.parse(JSON.stringify(file));
    expect(json.secretKey).toBeUndefined();
    expect(parseKeyFile(json)).toBeNull(); // old readers never mistake it for a plain key
    const parsed = parseLockedKeyFile(json)!;
    expect(fromLockedFile(parsed, await unlockSecret(parsed.lock, sign(wallet, k), parsed.publicKey))).toMatchObject({ account: 'alice', publicKey: k.publicKey, secretKey: k.secretKey, displayName: 'Alice' });
  });

  it('another wallet cannot unlock, and tampering is rejected', async () => {
    const k = generateKey('alice');
    const sig = sign(wallet, k);
    const lock = await lockSecret(k.secretKey, sig);
    await expect(unlockSecret(lock, sign(other, k), k.publicKey)).rejects.toThrow('could not unlock');
    const flipped = lock.ciphertext.startsWith('A') ? 'B' + lock.ciphertext.slice(1) : 'A' + lock.ciphertext.slice(1);
    await expect(unlockSecret({ ...lock, ciphertext: flipped }, sig, k.publicKey)).rejects.toThrow();
    await expect(unlockSecret(lock, sig, generateKey('alice').publicKey)).rejects.toThrow('does not match');
    await expect(unlockSecret(lock, 'not-a-signature', k.publicKey)).rejects.toThrow('invalid signature');
  });

  it('plain v1 files still load, and malformed v2 files are refused', () => {
    const k = generateKey('alice');
    expect(parseKeyFile(JSON.parse(JSON.stringify(k)))).toMatchObject({ secretKey: k.secretKey });
    expect(parseLockedKeyFile({ ...k, version: 2 })).toBeNull();
    expect(parseLockedKeyFile({ type: 'gpk-msg-key', version: 2, account: 'alice', publicKey: k.publicKey, lock: { scheme: 'wax-anchor-sig-v1', salt: '', nonce: '', ciphertext: '' } })).toBeNull();
  });

  it('sealing signs twice and refuses when the two signatures differ', async () => {
    const k = generateKey('alice');
    let n = 0;
    await expect(sealKey(async () => sign(n++ ? other : wallet, k), k, 'alice')).rejects.toThrow('two different signatures');
    await expect(sealKey(async () => sign(wallet, k), k, 'bob')).rejects.toThrow('belongs to alice');
    let calls = 0;
    const file = await sealKey(async () => { calls++; return sign(wallet, k); }, k, 'alice');
    expect(calls).toBe(2);
    expect((await openLockedKey(async () => sign(wallet, k), file, 'alice')).secretKey).toBe(k.secretKey);
    await expect(openLockedKey(async () => sign(wallet, k), file, 'bob')).rejects.toThrow('locked to alice');
  });

  it('signLock asks Anchor without broadcasting and rejects other wallets or altered requests', async () => {
    const seen: unknown[] = [];
    const session = (id: string, expiration = LOCK_TX_EXPIRATION) => ({
      actor: 'alice', permission: 'active', walletPlugin: { id },
      transact: async (args: unknown, options: unknown) => { seen.push(args, options); return { resolved: { transaction: { expiration } }, signatures: ['SIG_K1_abc'] }; },
    });
    expect(await signLock(session('anchor'), 'pub')).toBe('SIG_K1_abc');
    expect(seen[1]).toEqual({ broadcast: false, allowModify: false, transactPlugins: [] });
    await expect(signLock(session('cloudwallet'), 'pub')).rejects.toThrow('Anchor');
    await expect(signLock(session('anchor', '2026-10-24T00:00:00'), 'pub')).rejects.toThrow('changed the lock request');
  });

  it('upgrades the matching plain backup in place, finds it again and refreshes its profile without the secret', async () => {
    const k = generateKey('alice');
    const root = fakeDir('cheesecrypt');
    const dir = await root.getDirectoryHandle('my private key', { create: true }) as ReturnType<typeof fakeDir>;
    dir.files.set('alice-cheesecrypt-key-PRIVATE.json', JSON.stringify(k));
    const file = toLockedFile(k, await lockSecret(k.secretKey, sign(wallet, k)));
    await replaceWithLocked(root, file, k);
    const stored = JSON.parse(dir.files.get('alice-cheesecrypt-key-PRIVATE.json')!);
    expect(stored.secretKey).toBeUndefined();
    expect(stored.version).toBe(2);
    expect(await findPrivateKey(root, 'alice')).toMatchObject({ version: 2, publicKey: k.publicKey });

    await updatePrivateKeyProfile(root, { ...k, displayName: 'New name' });
    const refreshed = JSON.parse(dir.files.get('alice-cheesecrypt-key-PRIVATE.json')!);
    expect(refreshed.displayName).toBe('New name');
    expect(refreshed.lock).toEqual(file.lock);
    expect(withProfile(file, { displayName: 'X' }).lock).toEqual(file.lock);
  });

  it('never replaces a backup that holds a different key', async () => {
    const k = generateKey('alice'), otherKey = generateKey('alice');
    const root = fakeDir('cheesecrypt');
    const dir = await root.getDirectoryHandle('my private key', { create: true }) as ReturnType<typeof fakeDir>;
    dir.files.set('alice-cheesecrypt-key-PRIVATE.json', JSON.stringify(otherKey));
    const file = toLockedFile(k, await lockSecret(k.secretKey, sign(wallet, k)));
    await expect(replaceWithLocked(root, file, k)).rejects.toThrow('does not match');
    expect(JSON.parse(dir.files.get('alice-cheesecrypt-key-PRIVATE.json')!).secretKey).toBe(otherKey.secretKey);
  });
});
