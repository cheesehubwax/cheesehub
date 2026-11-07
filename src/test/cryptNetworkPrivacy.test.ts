import { describe, it, expect } from 'vitest';
import { fetchContractStream, mergeMemos, streamRows, STREAM_PAGE, type ChainMemo } from '@/lib/cheeseCrypt';
import { orderWithCustom, validateCustomEndpoint } from '@/lib/cryptNetworkPrivacy';

const memo = 'CRYPT2:' + 'a'.repeat(20);
const act = (name: string, trx: string, sender: string, to: string, ts = '2026-11-07T01:00:00.000', actor = sender) => ({
  trx_id: trx, '@timestamp': ts,
  act: { account: 'crypt.cheese', name, authorization: [{ actor }], data: { sender, copies: [{ to, memo }] } },
});

describe('contract stream filtering', () => {
  it('keeps only copies the account sent or received', () => {
    const rows = streamRows('alice', [act('sendfree', 't1', 'bob', 'alice'), act('sendmsg', 't2', 'alice', 'carol'), act('sendfree', 't3', 'bob', 'carol')]);
    expect(rows.map(r => r.txId).sort()).toEqual(['t1', 't2']);
  });
  it('drops actions the named sender did not sign', () => {
    expect(streamRows('alice', [act('sendfree', 't1', 'bob', 'alice', undefined, 'mallory'), act('sendmsg', 't2', 'bob', 'alice', undefined, 'mallory')])).toEqual([]);
  });
});

describe('mergeMemos', () => {
  it('dedupes by transaction and memo and sorts newest first', () => {
    const a: ChainMemo = { txId: 'x', time: 1, from: 'a', to: 'b', memo, quantity: '' };
    const b: ChainMemo = { ...a, txId: 'y', time: 5 };
    const prev = [a];
    expect(mergeMemos(prev, [a])).toBe(prev);
    expect(mergeMemos(prev, [a, b]).map(r => r.txId)).toEqual(['y', 'x']);
  });
});

describe('fetchContractStream', () => {
  it('never names the account and reports complete for a short page', async () => {
    const queries: string[] = [];
    const r = await fetchContractStream('alice', Date.parse('2026-11-07T00:00:00Z'), async q => { queries.push(q); return [act('sendfree', 't1', 'bob', 'alice')]; });
    expect(queries[0]).toContain('account=crypt.cheese');
    expect(queries[0]).not.toContain('alice');
    expect(r.complete).toBe(true);
    expect(r.cursor).toBe(Date.parse('2026-11-07T01:00:00Z'));
  });
  it('reports incomplete when the page cap is hit so the caller falls back', async () => {
    let n = 0;
    const r = await fetchContractStream('alice', 0, async () => Array.from({ length: STREAM_PAGE }, () => act('sendfree', `t${n++}`, 'bob', 'carol', new Date(Date.UTC(2026, 10, 7, 0, 0, n)).toISOString().slice(0, -1))));
    expect(r.complete).toBe(false);
  });
});

describe('custom history server', () => {
  it('accepts https and localhost http, rejects others', () => {
    expect(validateCustomEndpoint('https://node.example.com/')).toBe('https://node.example.com');
    expect(validateCustomEndpoint('http://localhost:7000')).toBe('http://localhost:7000');
    expect(validateCustomEndpoint('http://node.example.com')).toBeNull();
    expect(validateCustomEndpoint('https://u:p@node.example.com')).toBeNull();
    expect(validateCustomEndpoint('javascript:alert(1)')).toBeNull();
  });
  it('puts the custom server first, or alone when only', () => {
    expect(orderWithCustom(['https://a', 'https://b'], 'https://b', false)).toEqual(['https://b', 'https://a']);
    expect(orderWithCustom(['https://a'], 'https://c', true)).toEqual(['https://c']);
  });
});
