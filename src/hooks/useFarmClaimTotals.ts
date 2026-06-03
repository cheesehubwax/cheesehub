import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  ClaimSnapshot,
  ClaimedToken,
  applyClaimToAccount,
  clearSnapshot,
  ensureBaseline,
  getAccountSnapshot,
  getAccountStatus,
  subscribeAccount,
} from "@/lib/farmClaimHistory";

export interface UseFarmClaimTotalsResult {
  snapshot: ClaimSnapshot | null;
  totals: Record<string, ClaimedToken[]>;
  status: "idle" | "loading" | "ready" | "error";
  refetchBaseline: () => Promise<void>;
  applyClaim: (farmName: string, claimed: ClaimedToken[]) => void;
}

const EMPTY_SNAPSHOT_KEY = "__no_account__";

/**
 * React hook around the module-level claim totals store.
 * - Reads the current account's snapshot from localStorage on first mount.
 * - Kicks off a Hyperion baseline if missing or stale (>24h).
 * - Stays in sync across all components that use the hook.
 */
export function useFarmClaimTotals(account: string | null | undefined): UseFarmClaimTotalsResult {
  const key = account || EMPTY_SNAPSHOT_KEY;

  const subscribe = useCallback(
    (listener: () => void) => {
      if (!account) return () => {};
      return subscribeAccount(account, listener);
    },
    [account],
  );

  const getSnapshot = useCallback(() => {
    if (!account) return null;
    return getAccountSnapshot(account);
  }, [account]);

  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => null);

  const getStatusSnap = useCallback(() => {
    if (!account) return "idle" as const;
    return getAccountStatus(account);
  }, [account]);

  const status = useSyncExternalStore(subscribe, getStatusSnap, () => "idle" as const);

  useEffect(() => {
    if (!account) return;
    // Fire & forget; ensureBaseline is dedup'd internally.
    void ensureBaseline(account);
  }, [account]);

  const refetchBaseline = useCallback(async () => {
    if (!account) return;
    await ensureBaseline(account, { force: true });
  }, [account]);

  const applyClaim = useCallback(
    (farmName: string, claimed: ClaimedToken[]) => {
      if (!account) return;
      applyClaimToAccount(account, farmName, claimed);
    },
    [account],
  );

  return {
    snapshot,
    totals: snapshot?.totals || {},
    status,
    refetchBaseline,
    applyClaim,
  };
}
