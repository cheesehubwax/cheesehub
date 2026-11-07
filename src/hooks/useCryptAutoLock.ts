import { useEffect, useRef, useState } from 'react';
import { createDoubleEscDetector, idleExpired } from '@/lib/cryptPanicLock';

/** Locks on inactivity, double-Esc or Ctrl/Cmd+Shift+L; reports whether the tab is hidden (for the shield). Window blur is ignored: embedded players take focus without the user leaving. */
export function useCryptAutoLock(enabled: boolean, idleMinutes: number, onLock: () => void) {
  const lockRef = useRef(onLock);
  lockRef.current = onLock;
  const [away, setAway] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let last = Date.now();
    let locked = false;
    const lock = () => { if (!locked) { locked = true; lockRef.current(); } };
    const check = () => { if (idleExpired(last, idleMinutes, Date.now())) lock(); };
    const active = () => { check(); last = Date.now(); };
    const esc = createDoubleEscDetector();
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'l') { e.preventDefault(); lock(); return; }
      if (e.key === 'Escape' && esc(Date.now())) { lock(); return; }
      active();
    };
    const onVis = () => { setAway(document.hidden); if (!document.hidden) check(); };
    const onFocus = () => check();
    const events = ['pointerdown', 'touchstart', 'wheel'] as const;
    events.forEach(n => window.addEventListener(n, active, { passive: true }));
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onFocus);
    const t = setInterval(check, 30_000);
    return () => {
      events.forEach(n => window.removeEventListener(n, active));
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onFocus);
      clearInterval(t);
    };
  }, [enabled, idleMinutes]);

  return away;
}
