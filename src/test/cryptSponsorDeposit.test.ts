import { describe, it, expect } from 'vitest';
import { sponsorDepositQuantity, CRYPT_SPONSOR_MEMO } from '@/components/admin/CryptSponsorDepositBox';
import { EXTRA_ADMIN_ACCOUNTS } from '@/lib/adminData';

describe('sponsor deposit', () => {
  it('formats amounts to 4 decimals', () => {
    expect(sponsorDepositQuantity('200')).toBe('200.0000 CHEESE');
    expect(sponsorDepositQuantity('0.5')).toBe('0.5000 CHEESE');
  });
  it('rejects invalid amounts', () => {
    expect(sponsorDepositQuantity('0')).toBeNull();
    expect(sponsorDepositQuantity('1.23456')).toBeNull();
    expect(sponsorDepositQuantity('-1')).toBeNull();
  });
  it('uses the contract memo', () => expect(CRYPT_SPONSOR_MEMO).toBe('CHEESECrypt sponsor deposit'));
  it('cheesepromoz can open admin', () => expect(EXTRA_ADMIN_ACCOUNTS).toContain('cheesepromoz'));
});
