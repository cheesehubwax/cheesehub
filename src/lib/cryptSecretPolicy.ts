/** Both participants explicitly agree a per-chat policy; it is not a remote deletion guarantee. */
export type SecretHistoryPolicy = 'keep-encrypted' | 'forget-on-close';
export interface SecretPolicyProposal {
  version: 1;
  chatId: string;
  initiator: string;
  recipient: string;
  history: SecretHistoryPolicy;
}
export interface SecretPolicyAcceptance extends SecretPolicyProposal { acceptedBy: string }

const accountPattern = /^[a-z1-5.]{1,12}$/;
export function parseSecretPolicy(raw: unknown): SecretPolicyProposal | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  if (p.version !== 1 || typeof p.chatId !== 'string' || !/^[a-f0-9]{32}$/.test(p.chatId)
    || typeof p.initiator !== 'string' || !accountPattern.test(p.initiator)
    || typeof p.recipient !== 'string' || !accountPattern.test(p.recipient) || p.initiator === p.recipient
    || (p.history !== 'keep-encrypted' && p.history !== 'forget-on-close')) return null;
  return { version: 1, chatId: p.chatId, initiator: p.initiator, recipient: p.recipient, history: p.history };
}

/** Called only with a chain-authenticated sender; memo claims cannot substitute for that sender. */
export function secretPolicyAgreed(proposal: SecretPolicyProposal, rawAcceptance: unknown, authenticatedSender: string): boolean {
  const original = parseSecretPolicy(proposal), accepted = parseSecretPolicy(rawAcceptance);
  if (!original || !accepted || !rawAcceptance || typeof rawAcceptance !== 'object') return false;
  return authenticatedSender === original.recipient
    && (rawAcceptance as Record<string, unknown>).acceptedBy === authenticatedSender
    && accepted.chatId === original.chatId && accepted.initiator === original.initiator
    && accepted.recipient === original.recipient && accepted.history === original.history;
}

/** Forget-on-close may not persist readable history OR resumable protocol state. */
export function secretPersistencePolicy(history: SecretHistoryPolicy) {
  return history === 'keep-encrypted'
    ? { transcript: 'encrypted-device-only', session: 'encrypted-device-only', restore: 'fresh-session-only' } as const
    : { transcript: 'memory-only', session: 'memory-only', restore: 'fresh-session-only' } as const;
}