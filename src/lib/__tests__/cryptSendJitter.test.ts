import { beforeEach, describe, expect, it } from 'vitest';
import { isJitterOnForChat, loadSendJitter, normalizeJitter, pickJitterSeconds, saveSendJitter, setChatJitter, DEFAULT_JITTER } from '@/lib/cryptNetworkPrivacy';

describe('send jitter', () => {
  beforeEach(() => localStorage.clear());
  it('is off by default with a 5–25s range', () => expect(loadSendJitter()).toEqual({ mode: 'off', chats: [], minSeconds: 5, maxSeconds: 25 }));
  it('clamps to 1–120 seconds', () => expect(normalizeJitter({ mode: 'all', minSeconds: -4, maxSeconds: 999 })).toMatchObject({ mode: 'all', minSeconds: 1, maxSeconds: 120 }));
  it('swaps min above max', () => expect(normalizeJitter({ minSeconds: 30, maxSeconds: 10 })).toMatchObject({ minSeconds: 10, maxSeconds: 30 }));
  it('reads the old single switch as all chats', () => expect(normalizeJitter({ enabled: true }).mode).toBe('all'));
  it('persists saved settings', () => { saveSendJitter({ mode: 'chat', chats: ['me|bob'], minSeconds: 15, maxSeconds: 60 }); expect(loadSendJitter()).toEqual({ mode: 'chat', chats: ['me|bob'], minSeconds: 15, maxSeconds: 60 }); });
  it('per-chat mode delays only switched-on chats of that account', () => {
    const j = setChatJitter(DEFAULT_JITTER, 'me', 'bob', true);
    expect(j.mode).toBe('chat');
    expect(isJitterOnForChat(j, 'me', 'bob')).toBe(true);
    expect(isJitterOnForChat(j, 'me', 'alice')).toBe(false);
    expect(isJitterOnForChat(j, 'other', 'bob')).toBe(false);
  });
  it('master off overrides chat switches; all chats overrides them too', () => {
    const j = setChatJitter(DEFAULT_JITTER, 'me', 'bob', true);
    expect(isJitterOnForChat({ ...j, mode: 'off' }, 'me', 'bob')).toBe(false);
    expect(isJitterOnForChat({ ...j, mode: 'all' }, 'me', 'alice')).toBe(true);
  });
  it('switching a chat off keeps the master mode', () => {
    const j = setChatJitter(setChatJitter(DEFAULT_JITTER, 'me', 'bob', true), 'me', 'bob', false);
    expect(j).toMatchObject({ mode: 'chat', chats: [] });
  });
  it('picks inclusive whole-second delays', () => {
    const j = { ...DEFAULT_JITTER, minSeconds: 3, maxSeconds: 10 };
    expect(pickJitterSeconds(j, () => 0)).toBe(3);
    expect(pickJitterSeconds(j, () => 0.999999)).toBe(10);
  });
});
