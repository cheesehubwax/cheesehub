import { useEffect, useState } from 'react';
import { fetchLibTime } from '@/lib/cryptDelivery';

/** Polls the last irreversible block time every 15 s, only while `pending` and the tab is visible. */
export function useCryptLib(pending: boolean): number | null {
  const [lib, setLib] = useState<number | null>(null);
  useEffect(() => {
    if (!pending) return;
    let stop = false;
    const tick = () => { if (document.visibilityState === 'visible') fetchLibTime().then(t => { if (!stop && t != null) setLib(p => (p == null || t > p ? t : p)); }).catch(() => {}); };
    tick();
    const id = window.setInterval(tick, 15000);
    return () => { stop = true; window.clearInterval(id); };
  }, [pending]);
  return lib;
}
