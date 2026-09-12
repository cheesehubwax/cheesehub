import { describe, expect, it } from 'vitest';
import { buildResultsCsv, buildSnapshotCsv } from '@/lib/airdropCsv';

describe('buildSnapshotCsv', () => {
  it('ranks holders and marks selection', () => {
    const { name, lines } = buildSnapshotCsv({
      what: 'token CHEESE@cheeseburger',
      source: 'lightapi',
      truncated: false,
      at: '2026-09-12T04:00:00.000Z',
      holders: [
        { account: 'bigholder111', weight: 500 },
        { account: 'smallholder1', weight: 5 },
      ],
      selected: new Set(['bigholder111']),
    });
    expect(name).toBe('snapshot-2026-09-12-04-00-00.csv');
    expect(lines[0]).toContain('token CHEESE@cheeseburger');
    expect(lines[2]).toBe('rank,account,weight,selected');
    expect(lines[3]).toBe('1,bigholder111,500,yes');
    expect(lines[4]).toBe('2,smallholder1,5,no');
  });
});

describe('buildResultsCsv — token', () => {
  it('joins recipients to batch transactions and reports not-sent rows', () => {
    const { lines } = buildResultsCsv({
      kind: 'token',
      symbol: 'wax',
      precision: 8,
      memo: 'hi "there"',
      planned: [
        { account: 'alice.wam', weight: 1, units: 100000000n },
        { account: 'bob.wam', weight: 1, units: 200000000n },
        { account: 'carol.wam', weight: 1, units: 300000000n },
      ],
      log: [
        {
          batch: 1,
          txId: 'abc123',
          items: [
            { account: 'alice.wam', units: 100000000n },
            { account: 'bob.wam', units: 200000000n },
          ],
        },
      ],
      at: null,
    });
    expect(lines[0]).toBe('account,amount,token,memo,status,batch,tx_id,error');
    expect(lines[1]).toBe('alice.wam,1.00000000,WAX,"hi ""there""",confirmed,1,abc123,');
    expect(lines[2]).toBe('bob.wam,2.00000000,WAX,"hi ""there""",confirmed,1,abc123,');
    expect(lines[3]).toContain('carol.wam,3.00000000,WAX');
    expect(lines[3]).toContain('not_sent');
  });

  it('marks failed batches with the batch error', () => {
    const { lines } = buildResultsCsv({
      kind: 'token',
      symbol: 'cheese',
      precision: 4,
      memo: '',
      planned: [{ account: 'dave.wam', weight: 1, units: 10000n }],
      log: [
        {
          batch: 1,
          error: 'out of CPU',
          items: [{ account: 'dave.wam', units: 10000n }],
        },
      ],
      at: null,
    });
    expect(lines[1]).toBe('dave.wam,1.0000,CHEESE,,failed,1,,out of CPU');
  });
});

describe('buildResultsCsv — ram', () => {
  it('includes below-minimum accounts as skipped rows', () => {
    const { lines } = buildResultsCsv({
      kind: 'ram',
      planned: [{ account: 'whale.wam', units: 1000000n }],
      belowMin: [{ account: 'dust.wam', weight: 1, units: 5000n }],
      minCheese: 1,
      bytesPerCheese: 1000,
      log: [{ batch: 1, txId: 'tx9', items: [{ account: 'whale.wam', units: 1000000n }] }],
      at: null,
    });
    expect(lines[0]).toBe('account,cheese,est_kb,status,batch,tx_id,error');
    expect(lines[1]).toContain('whale.wam');
    expect(lines[1]).toContain('confirmed,1,tx9');
    expect(lines[2]).toContain('dust.wam');
    expect(lines[2]).toContain('skipped');
    expect(lines[2]).toContain('minimum per purchase');
  });
});

describe('buildResultsCsv — nft', () => {
  it('lists asset ids and zero-share skipped accounts', () => {
    const { lines } = buildResultsCsv({
      kind: 'nft',
      collection: 'mycollection',
      templateId: 42,
      memo: '',
      planned: [{ account: 'fan.wam', assetIds: ['1099511627776'] }],
      skippedAccounts: ['late.wam'],
      log: [
        { batch: 1, txId: 'tx1', items: [{ account: 'fan.wam', assetIds: ['1099511627776'] }] },
      ],
      at: null,
    });
    expect(lines[1]).toContain('fan.wam,1,1099511627776,mycollection,42,,confirmed,1,tx1');
    expect(lines[2]).toContain('late.wam,0,,mycollection,42,,skipped');
  });
});
