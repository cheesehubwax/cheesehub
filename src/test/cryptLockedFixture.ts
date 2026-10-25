import { saveKey as cacheKey, type MessagingKey } from '@/lib/cheeseCrypt';
import { saveLockedEnvelope, sealKey } from '@/lib/cryptKeyLock';

/** Existing messenger-flow tests start with an actually sealed and verified session key. */
export async function saveKey(key: MessagingKey) {
  saveLockedEnvelope(await sealKey(async () => 'SIG_K1_abc', key, key.account));
  cacheKey(key);
}