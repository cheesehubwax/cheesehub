import { useCallback, useEffect, useMemo, useState } from 'react';
import { generateKey, saveKey, toPublicFile, type MessagingKey } from '@/lib/cheeseCrypt';
import { saveLockedEnvelope, sealKey, withRetired, type LockedKeyFile } from '@/lib/cryptKeyLock';
import {
  buildRotateBatches, DAY_MS, expiryFor, keyAgeDays, loadRetention, loadRotation, loadSnooze, markAnnounced, noticeSources,
  rotateCost, rotatedRing, ROTATE_RECIPIENTS_PER_TX, saveRetention, saveRotation, saveSnooze, shouldNudge, shreddable, SNOOZE_DAYS, withoutRetired,
  type Retention, type RotationState,
} from '@/lib/cryptKeyRing';
import { privateKeyName, replaceWithRing, vaultWritable, writeOwnPublicKey, type DirHandle } from '@/lib/cryptVault';
import { download } from '@/components/crypt/cryptDownload';

type Exec = (actions: unknown[], options?: { successTitle?: string }, opts?: { paid?: boolean }) => Promise<{ success: boolean; txId?: string | null }>;
type Toast = (t: { title: string; description?: string; variant?: 'destructive' }) => void;

export interface RetiredView { publicKey: string; retiredAt: string; expiresAt: string | null; pinnedRooms: number }

/**
 * Key rotation state for the Messenger: stealth rotation (no public post unless asked), friend notices,
 * retention of retired keys and their destruction. Room-pinned keys are never destroyed.
 */
export function useCryptKeyRotation(o: {
  account: string; key: MessagingKey | null; lockedFile: LockedKeyFile | null;
  setKey: (k: MessagingKey) => void; setLockedFile: (f: LockedKeyFile) => void;
  signer: (publicKey: string) => Promise<string>; vault: DirHandle | null;
  contacts: Record<string, string>; pendingFriends: string[]; roomKeys: Record<string, number>;
  setRotation: (s: RotationState | null) => void; executeTransaction: Exec; permission: unknown; toast: Toast; clock: number;
}) {
  const { account, key, lockedFile, setKey, setLockedFile, signer, vault, contacts, pendingFriends, roomKeys, setRotation, executeTransaction, permission, toast, clock } = o;
  const [retention, setRetentionState] = useState<Retention>(() => loadRetention(account));
  const [snoozedUntil, setSnoozed] = useState(() => loadSnooze(account));
  useEffect(() => { setRetentionState(loadRetention(account)); setSnoozed(loadSnooze(account)); }, [account]);

  /** Saves an updated ring (same active key) to memory, this device and a matching folder backup. No signature needed. */
  const commitRing = useCallback(async (next: MessagingKey) => {
    if (!lockedFile) return;
    const file = withRetired(lockedFile, next);
    saveKey(next); setKey(next); saveLockedEnvelope(file); setLockedFile(file);
    if (vault && (await vaultWritable(vault, false).catch(() => false))) await replaceWithRing(vault, file).catch(() => {});
  }, [lockedFile, setKey, setLockedFile, vault]);

  const pinned = useMemo(() => new Set(Object.keys(roomKeys)), [roomKeys]);
  // Automatic destruction once a retired key has expired, no room holds it and every friend knows the new key.
  useEffect(() => {
    if (!key?.retired?.length || !lockedFile) return;
    const drop = shreddable(key, clock, pinned, pendingFriends.length > 0);
    if (!drop.length) return;
    void commitRing(withoutRetired(key, drop.map(r => r.publicKey))).then(() => toast({
      title: drop.length > 1 ? `${drop.length} old keys destroyed` : 'Old key destroyed',
      description: 'Messages that only that key could open are now permanently unreadable on this device. Older backup files still hold it until you delete them.',
    }));
  }, [key, lockedFile, clock, pinned, pendingFriends.length, commitRing, toast]);

  const setRetention = useCallback((r: Retention) => {
    saveRetention(account, r); setRetentionState(r);
    if (!key?.retired?.length) return;
    void commitRing({ ...key, retired: key.retired.map(x => ({ ...x, expiresAt: expiryFor(Date.parse(x.retiredAt), r) })) });
  }, [account, key, commitRing]);

  /** Step 1 (free): new key, sealed with two Anchor signatures together with the old one, then backed up. */
  const createRotatedKey = useCallback(async () => {
    if (!key || !lockedFile) throw new Error('Unlock your key first.');
    const ring = rotatedRing(key, generateKey(account), Date.now(), retention);
    const file = await sealKey(signer, ring, account);
    saveLockedEnvelope(file); saveKey(ring); setKey(ring); setLockedFile(file);
    saveRotation(account, { to: ring.publicKey, announced: [] }); setRotation(loadRotation(account));
    let saved = false;
    if (vault && (await vaultWritable(vault, true).catch(() => false))) {
      try { await replaceWithRing(vault, file); await writeOwnPublicKey(vault, toPublicFile(ring)).catch(() => {}); saved = true; } catch { saved = false; }
    }
    if (!saved) download(privateKeyName(account), file);
    return { savedToFolder: saved };
  }, [key, lockedFile, account, retention, signer, setKey, setLockedFile, setRotation, vault]);

  /** Step 2 (paid): tells friends the new key with notices from the old key; optionally posts it publicly. */
  const announce = useCallback(async (publishPublicly: boolean) => {
    if (!key?.retired?.length) return false;
    const to = pendingFriends.filter(f => contacts[f]);
    if (!to.length && !publishPublicly) return true;
    const batches = buildRotateBatches(key, to, contacts, [permission], Date.now(), publishPublicly);
    let sent = 0;
    for (let i = 0; i < batches.length; i++) {
      const r = await executeTransaction(batches[i], { successTitle: batches.length > 1 ? `Key notices ${i + 1} of ${batches.length} sent` : 'New key sent to your friends' });
      if (!r.success) break;
      markAnnounced(account, key.publicKey, to.slice(i * ROTATE_RECIPIENTS_PER_TX, (i + 1) * ROTATE_RECIPIENTS_PER_TX));
      sent++;
    }
    setRotation(loadRotation(account));
    if (sent < batches.length) toast({ title: 'Some friends were not told yet', description: 'They will get your new key automatically with your next message to them, or try again from Privacy settings.', variant: 'destructive' });
    return sent === batches.length;
  }, [key, pendingFriends, contacts, permission, executeTransaction, account, setRotation, toast]);

  const destroyNow = useCallback(async (publicKey: string) => {
    if (!key?.retired?.some(r => r.publicKey === publicKey) || pinned.has(publicKey)) return false;
    await commitRing(withoutRetired(key, [publicKey]));
    toast({ title: 'Old key destroyed', description: 'Messages that only that key could open are now permanently unreadable on this device.' });
    return true;
  }, [key, pinned, commitRing, toast]);

  const snooze = useCallback(() => { const until = Date.now() + SNOOZE_DAYS * DAY_MS; saveSnooze(account, until); setSnoozed(until); }, [account]);

  const retired: RetiredView[] = (key?.retired ?? []).map(r => ({ publicKey: r.publicKey, retiredAt: r.retiredAt, expiresAt: r.expiresAt, pinnedRooms: roomKeys[r.publicKey] ?? 0 }));
  const sources = key ? noticeSources(key) : 0;
  return {
    ageDays: key ? keyAgeDays(key.created, clock) : null,
    nudge: !!key && shouldNudge(clock, key.created, snoozedUntil),
    snooze, retention, setRetention, retired, createRotatedKey, announce, destroyNow,
    pendingFriends, announceCost: (publish: boolean) => rotateCost(pendingFriends.length, Math.max(1, sources), publish),
    rotateCost: (publish: boolean) => rotateCost(Object.keys(contacts).length, Math.min(3, 1 + (key?.retired?.length ?? 0)), publish),
  };
}
