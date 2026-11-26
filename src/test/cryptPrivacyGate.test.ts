import { beforeEach, describe, expect, it } from 'vitest';
import { privacyGateSatisfied, saveCustomEndpoint, savePrivacyGateChoice } from '@/lib/cryptNetworkPrivacy';

describe('CHEESECrypt first-run privacy gate', () => {
  beforeEach(() => localStorage.clear());
  it('blocks a fresh browser until a choice is made', () => expect(privacyGateSatisfied()).toBe(false));
  it('opens after choosing public servers', () => { savePrivacyGateChoice('public'); expect(privacyGateSatisfied()).toBe(true); });
  it('opens with an exclusive own server', () => { saveCustomEndpoint('http://127.0.0.1:8088', true); expect(privacyGateSatisfied()).toBe(true); });
  it('stays closed with a non-exclusive own server', () => { saveCustomEndpoint('http://127.0.0.1:8088', false); expect(privacyGateSatisfied()).toBe(false); });
  it('re-closes when the private choice loses its server', () => {
    saveCustomEndpoint('http://127.0.0.1:8088', true); savePrivacyGateChoice('private');
    saveCustomEndpoint(null, false); expect(privacyGateSatisfied()).toBe(false);
  });
});
