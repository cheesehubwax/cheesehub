import { describe, expect, it } from 'vitest';
import { collectReports, encodeReport, parseReport, buildReportAction, REPORT_EMAIL } from '@/lib/cryptRoomReports';

const id = 'a'.repeat(16);
const row = (from: string, reason: number, time: number, extra: Partial<{ creator: string; to: string; memo: string }> = {}) => ({
  txId: `t${time}`, time, from, to: extra.to ?? 'eosio.null', quantity: '0.0001 CHEESE',
  memo: extra.memo ?? `CRYPTREPORT1:${JSON.stringify({ c: extra.creator ?? 'owner', i: id, r: reason })}`,
});

describe('CHEESECrypt room reports', () => {
  it('round-trips and rejects free text or unknown reasons', () => {
    expect(parseReport(encodeReport({ creator: 'owner', id }, 2))).toEqual({ creator: 'owner', id, reason: 2 });
    expect(parseReport('CRYPTREPORT1:{"c":"owner","i":"' + id + '","r":5}')).toBeNull();
    expect(parseReport('CRYPTREPORT1:{"c":"owner","i":"' + id + '","r":"scam"}')).toBeNull();
    expect(() => encodeReport({ creator: 'owner', id: '*' }, 1)).toThrow();
  });
  it('counts one report per reporter (newest reason) and ignores the owner reporting their own room', () => {
    const [room] = collectReports([row('alice', 1, 1), row('alice', 2, 2), row('bob', 2, 3), row('owner', 1, 4), row('carol', 1, 5, { to: 'other' })]);
    expect(room.reporters).toBe(2);
    expect(room.reasons).toEqual({ 2: 2 });
  });
  it('sends 0.0001 CHEESE to eosio.null and uses the given email', () => {
    expect(buildReportAction('alice', [], { creator: 'owner', id }, 3).data).toMatchObject({ to: 'eosio.null', quantity: '0.0001 CHEESE' });
    expect(REPORT_EMAIL).toBe('cheesehub@protonmail.com');
  });
});
