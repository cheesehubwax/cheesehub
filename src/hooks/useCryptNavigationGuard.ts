import { useCallback, useRef, useState } from 'react';

/** Async DOM/event errors bypass React boundaries; suspend navigation without logging chat data. */
export function useCryptNavigationGuard(active: string | null) {
  const [failure, setFailure] = useState<{ active: string | null } | null>(null);
  const current = useRef({ active, failed: false });
  current.current = { active, failed: failure !== null && failure.active === active };
  const run = useCallback((work: () => void) => {
    if (current.current.failed) return;
    try { work(); } catch {
      current.current.failed = true;
      setFailure({ active: current.current.active });
    }
  }, []);
  const retry = useCallback(() => {
    current.current.failed = false;
    setFailure(null);
  }, []);
  return { failed: failure !== null && failure.active === active, run, retry };
}