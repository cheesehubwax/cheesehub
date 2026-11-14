import { afterEach, describe, it, expect, vi } from 'vitest';
import { fetchContractStream, mergeMemos, streamRows, STREAM_PAGE, type ChainMemo } from '@/lib/cheeseCrypt';
import { checkHistoryEndpoint, fetchCryptHistoryJson, historyTimeoutMs, loadCustomEndpoint, loadCustomOnly, loadCustomOnlyPreference, saveCustomOnlyPreference, orderWithCustom, saveCustomEndpoint, validateCustomEndpoint } from '@/lib/cryptNetworkPrivacy';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); localStorage.clear(); });

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
    expect(r.cursor).toBeGreaterThanOrEqual(Date.parse('2026-11-07T01:00:00Z'));
  });
  it('reports incomplete when the page cap is hit so the caller falls back', async () => {
    let n = 0;
    const r = await fetchContractStream('alice', 0, async () => Array.from({ length: STREAM_PAGE }, () => act('sendfree', `t${n++}`, 'bob', 'carol', new Date(Date.UTC(2026, 10, 7, 0, 0, n)).toISOString().slice(0, -1))));
    expect(r.complete).toBe(false);
  });
});

describe('custom history server', () => {
  it('remembers the checkbox before connection without activating an untested server', () => {
    saveCustomOnlyPreference(true);
    expect(loadCustomOnlyPreference()).toBe(true);
    expect(loadCustomEndpoint()).toBeNull();
    expect(loadCustomOnly()).toBe(false);
    saveCustomOnlyPreference(false);
    expect(loadCustomOnlyPreference()).toBe(false);
  });
  it('removes the preference when the connected server is removed', () => {
    saveCustomEndpoint('http://localhost:8088', true);
    saveCustomEndpoint(null, false);
    expect(loadCustomOnlyPreference()).toBe(false);
    expect(loadCustomOnly()).toBe(false);
  });
  it('accepts a complete history response and never names the user in its probe', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ actions: [] }) });
    vi.stubGlobal('fetch', fetcher);
    expect(await checkHistoryEndpoint('http://localhost:8088')).toEqual({ ok: true });
    expect(fetcher.mock.calls[0][0]).toBe('http://localhost:8088/v2/history/get_actions?account=crypt.cheese&limit=1');
  });
  it('does not accept a non-Hyperion JSON response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'ok' }) }));
    expect((await checkHistoryEndpoint('http://localhost:8088')).ok).toBe(false);
  });
  it('shows the helper error instead of disguising it as a wrong server', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({ error: 'Tor is not running.' }) }));
    expect((await checkHistoryEndpoint('http://localhost:8088')).error).toContain('Tor is not running.');
  });
  it('gives local-access guidance on a browser fetch failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    expect((await checkHistoryEndpoint('http://localhost:8088')).error).toContain('allow local-network access');
  });
  it('gives Tor/custom history 40s but keeps ordinary public reads at 10s', () => {
    expect(historyTimeoutMs('http://localhost:8088')).toBe(40000);
    expect(historyTimeoutMs('http://127.0.0.1:8088')).toBe(40000);
    expect(historyTimeoutMs('https://node.example.com')).toBe(10000);
    saveCustomEndpoint('https://node.example.com', true);
    expect(historyTimeoutMs('https://node.example.com')).toBe(40000);
  });
  it('persists the only-this-server toggle instantly on an already-saved server', () => {
    saveCustomEndpoint('http://localhost:8088', false);
    expect(loadCustomOnly()).toBe(false);
    // The dialog's instant-save path: toggle writes straight to storage, no re-test.
    saveCustomEndpoint(loadCustomEndpoint(), true);
    expect(loadCustomOnly()).toBe(true);
    saveCustomEndpoint(loadCustomEndpoint(), false);
    expect(loadCustomOnly()).toBe(false);
  });
  it('keeps the timeout active while reading a stalled response body', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url, opts) => Promise.resolve({
      ok: true, json: () => new Promise((_resolve, reject) => opts.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))),
    })));
    const result = checkHistoryEndpoint('http://localhost:8088');
    await vi.advanceTimersByTimeAsync(39999);
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect((await result).error).toContain('timed out');
    expect(vi.getTimerCount()).toBe(0);
  });
  it('rejects broken history JSON rather than reporting an empty history', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => { throw new SyntaxError('Invalid JSON'); } }));
    await expect(fetchCryptHistoryJson('http://localhost:8088', '/v2/history/get_actions')).rejects.toThrow('Invalid JSON');
  });
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
