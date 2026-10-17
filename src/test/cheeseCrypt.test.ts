import { describe, it, expect } from 'vitest';
import {
  generateKey, encryptMemo, decryptMemo, MAX_PLAINTEXT_BYTES, MEMO_MAX_BYTES, buildSendMessageActions,
  buildPublishKeyActions, MESSAGE_TOTAL_QUANTITY, keyMemo, parseKeyFile, toPublicFile,
} from '@/lib/cheeseCrypt';

describe('CHEESECrypt', () => {
  const a = generateKey('alice.wam'), b = generateKey('bob.wam');
  it('recipient and sender can both read; others cannot', () => {
    const memo = encryptMemo('hi bob', b.publicKey, a.secretKey);
    expect(decryptMemo(memo, a.publicKey, b.secretKey)).toBe('hi bob');
    expect(decryptMemo(memo, b.publicKey, a.secretKey)).toBe('hi bob');
    expect(decryptMemo(memo, a.publicKey, generateKey('eve.wam').secretKey)).toBeNull();
  });
  it('longest allowed message fits the 256-byte memo', () => {
    const memo = encryptMemo('x'.repeat(MAX_PLAINTEXT_BYTES), b.publicKey, a.secretKey);
    expect(new TextEncoder().encode(memo).length).toBeLessThanOrEqual(MEMO_MAX_BYTES);
    expect(() => encryptMemo('x'.repeat(MAX_PLAINTEXT_BYTES + 1), b.publicKey, a.secretKey)).toThrow();
  });
  it('sends 0.0010 CHEESE to the recipient and nulls 0.0100 CHEESE in the same transaction', () => {
    const auth = [{ actor: 'alice.wam', permission: 'active' }];
    const actions = buildSendMessageActions('alice.wam', 'bob.wam', 'enc', auth);
    expect(actions).toHaveLength(2);
    expect(actions[0].data).toEqual({ from: 'alice.wam', to: 'bob.wam', quantity: '0.0010 CHEESE', memo: 'enc' });
    expect(actions[1].data.to).toBe('eosio.null');
    expect(actions[1].data.quantity).toBe('0.0100 CHEESE');
    expect(actions.every((x) => x.account === 'cheeseburger')).toBe(true);
    expect(MESSAGE_TOTAL_QUANTITY).toBe('0.0110 CHEESE');
  });
  it('publishes a key with one 0.0100 CHEESE transfer to eosio.null', () => {
    const actions = buildPublishKeyActions('alice.wam', a.publicKey, []);
    expect(actions).toHaveLength(1);
    expect(actions[0].data).toEqual({ from: 'alice.wam', to: 'eosio.null', quantity: '0.0100 CHEESE', memo: keyMemo(a.publicKey) });
  });
  it('accepts original key files and rejects mismatched private keys', () => {
    expect(parseKeyFile(JSON.parse(JSON.stringify(a)))?.type).toBe('gpk-msg-key');
    expect(parseKeyFile({ ...a, publicKey: b.publicKey })).toBeNull();
    expect(parseKeyFile(toPublicFile(b))?.type).toBe('gpk-msg-pubkey');
  });
});
