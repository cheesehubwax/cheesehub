import { beforeEach, describe, expect, it } from 'vitest';
import { loadSendJitter, normalizeJitter, pickJitterSeconds, saveSendJitter } from '@/lib/cryptNetworkPrivacy';

describe('send jitter', () => {
  beforeEach(() => localStorage.clear());
  it('is off by default with a 5–25s range', () => expect(loadSendJitter()).toEqual({ enabled: false, minSeconds: 5, maxSeconds: 25 }));
  it('clamps to 1–120 seconds', () => expect(normalizeJitter({ enabled: true, minSeconds: -4, maxSeconds: 999 })).toEqual({ enabled: true, minSeconds: 1, maxSeconds: 120 }));
  it('swaps min above max', () => expect(normalizeJitter({ minSeconds: 30, maxSeconds: 10 })).toMatchObject({ minSeconds: 10, maxSeconds: 30 }));
  it('persists saved settings', () => { saveSendJitter({ enabled: true, minSeconds: 15, maxSeconds: 60 }); expect(loadSendJitter()).toEqual({ enabled: true, minSeconds: 15, maxSeconds: 60 }); });
  it('picks inclusive whole-second delays', () => {
    const j = { enabled: true, minSeconds: 3, maxSeconds: 10 };
    expect(pickJitterSeconds(j, () => 0)).toBe(3);
    expect(pickJitterSeconds(j, () => 0.999999)).toBe(10);
  });
});
