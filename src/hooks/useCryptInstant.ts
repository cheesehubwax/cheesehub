import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@wharfkit/session';
import { fetchCheeseRamConfig, fetchRamPricePerByte } from '@/lib/cheeseRam';
import {
  buildEnableActions, buildRevokeActions, fetchInstantStatus, forgetInstantKey, generateInstantKey, instantReady,
  isInstantEligible, loadInstantKey, needsRam, ramTopUpQuantity, saveInstantKey, sendInstant,
  type InstantKey, type InstantStatus,
} from '@/lib/cryptInstant';

type Exec = (actions: unknown[], options?: { successTitle?: string; showSuccessToast?: boolean; showErrorToast?: boolean }) => Promise<{ success: boolean; txId: string | null; error?: Error }>;

/** Instant Messaging state for one account: browser key, on-chain permission status, setup/removal, signing. */
export function useCryptInstant(account: string, session: Session, executeDirect: Exec) {
  const [key, setKey] = useState<InstantKey | null>(() => loadInstantKey(account));
  const [status, setStatus] = useState<InstantStatus | null>(null);
  const [checking, setChecking] = useState(false);

  const refresh = useCallback(async () => {
    setChecking(true);
    try { const s = await fetchInstantStatus(account); setStatus(s); return s; }
    catch { return null; }
    finally { setChecking(false); }
  }, [account]);
  useEffect(() => { void refresh(); }, [refresh]);

  /** RAM top-up quote for setup when the account is short (null = not needed or ram.chz unavailable). */
  const quoteRam = useCallback(async (s: InstantStatus | null) => {
    if (!needsRam(s)) return { needed: false, quantity: null as string | null };
    try {
      const [config, price] = await Promise.all([fetchCheeseRamConfig(), fetchRamPricePerByte()]);
      return { needed: true, quantity: ramTopUpQuantity(config, price) };
    } catch { return { needed: true, quantity: null }; }
  }, []);

  /** One Anchor approval: optional ram.chz top-up, updateauth (new browser key) and linkauth to sendfree. */
  const enable = useCallback(async (ramQuantity: string | null) => {
    const s = (await refresh()) ?? status;
    if (!s) throw new Error('Could not read your account. Please try again.');
    const fresh = generateInstantKey(account);
    const actions = buildEnableActions(account, [session.permissionLevel as unknown as { actor: string; permission: string }], fresh.publicKey,
      { linked: s.linked, ramQuantity: needsRam(s) ? ramQuantity : null });
    const r = await executeDirect(actions, { successTitle: 'Instant Messaging switched on' });
    if (!r.success) return false;
    // Only a confirmed setup replaces the stored key, so a cancelled rotation never breaks a working one.
    saveInstantKey(fresh);
    setKey(fresh);
    setStatus({ ...s, exists: true, linked: true, keys: [fresh.publicKey], parent: 'active' });
    setTimeout(() => void refresh(), 4000);
    return true;
  }, [account, session, executeDirect, refresh, status]);

  /** Removes the permission on chain (Anchor) and forgets the browser key. */
  const revoke = useCallback(async () => {
    const s = (await refresh()) ?? status;
    if (s && (s.exists || s.linked)) {
      const r = await executeDirect(buildRevokeActions(account, [session.permissionLevel as unknown as { actor: string; permission: string }], s),
        { successTitle: 'Instant Messaging switched off' });
      if (!r.success) return false;
    }
    forgetInstantKey(account);
    setKey(null);
    setStatus(s ? { ...s, exists: false, linked: false, keys: [], parent: null } : s);
    setTimeout(() => void refresh(), 4000);
    return true;
  }, [account, session, executeDirect, refresh, status]);

  const ready = instantReady(status, key);
  const canSend = useCallback((actions: unknown[]) => ready && isInstantEligible(actions, account), [ready, account]);
  const send = useCallback(async (actions: unknown[]) => {
    if (!key) throw new Error('Instant Messaging is off.');
    return sendInstant(session.chain, key, actions);
  }, [key, session]);

  return { key, status, checking, ready, refresh, quoteRam, enable, revoke, canSend, send };
}
