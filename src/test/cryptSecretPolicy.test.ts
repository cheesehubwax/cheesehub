import { describe, expect, it } from 'vitest';
import { parseSecretPolicy, secretPersistencePolicy, secretPolicyAgreed, type SecretPolicyProposal } from '@/lib/cryptSecretPolicy';

const proposal: SecretPolicyProposal = { version: 1, chatId: 'ab'.repeat(16), initiator: 'alice', recipient: 'bob', history: 'keep-encrypted' };

describe('per Secret Chat history consent', () => {
  it('supports both per-chat choices without a global override', () => {
    expect(parseSecretPolicy(proposal)?.history).toBe('keep-encrypted');
    expect(parseSecretPolicy({ ...proposal, history: 'forget-on-close' })?.history).toBe('forget-on-close');
    expect(parseSecretPolicy({ ...proposal, history: 'public' })).toBeNull();
  });
  it('requires the recipient to agree the exact chat and policy', () => {
    const accepted = { ...proposal, acceptedBy: 'bob' };
    expect(secretPolicyAgreed(proposal, accepted, 'bob')).toBe(true);
    expect(secretPolicyAgreed(proposal, { ...accepted, history: 'forget-on-close' }, 'bob')).toBe(false);
    expect(secretPolicyAgreed(proposal, { ...accepted, chatId: 'cd'.repeat(16) }, 'bob')).toBe(false);
    expect(secretPolicyAgreed(proposal, accepted, 'mallory')).toBe(false);
    expect(secretPolicyAgreed(proposal, { ...accepted, acceptedBy: 'alice' }, 'alice')).toBe(false);
  });
  it('keeps forget-on-close transcripts and protocol state in memory only', () => {
    expect(secretPersistencePolicy('forget-on-close')).toEqual({ transcript: 'memory-only', session: 'memory-only', restore: 'fresh-session-only' });
  });
  it('requires encrypted device-only retention and never resumes restored old sessions', () => {
    expect(secretPersistencePolicy('keep-encrypted')).toEqual({ transcript: 'encrypted-device-only', session: 'encrypted-device-only', restore: 'fresh-session-only' });
  });
  it('rejects self chats and malformed identity bindings', () => {
    expect(parseSecretPolicy({ ...proposal, recipient: 'alice' })).toBeNull();
    expect(parseSecretPolicy({ ...proposal, initiator: '<script>' })).toBeNull();
    expect(parseSecretPolicy({ ...proposal, chatId: 'old-chat' })).toBeNull();
  });
});