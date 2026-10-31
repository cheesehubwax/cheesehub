import { describe, it, expect } from 'vitest';
import { buildCreateKeyActions, buildPublishKeyActions, buildSendMessageActions, expandPayfeeActions, newestPublishedKey, routeCryptActions } from '@/lib/cheeseCrypt';
import { buildRoomActions, collectListings, encodeListing, LISTING_FEE_QUANTITY, ROOM_FEE_QUANTITY } from '@/lib/cryptRooms';

const auth = [{ actor: 'alice', permission: 'active' }];
type A = { account: string; name: string; data: any; authorization?: unknown };
const route = (a: unknown[]) => routeCryptActions(a, { payfee: true }) as A[];
const asHistory = (acts: A[], tx = 'tx1', at = '2026-11-01T00:00:00.000') => acts.map(act => ({ trx_id: tx, '@timestamp': at, act: { ...act, authorization: act.authorization } }));
const PUB = 'A'.repeat(43) + '=';
const room = { id: '0123456789abcdef', name: 'Cheese', topic: 't', tags: [], publicKey: PUB, members: 1 };

describe('crypt.cheese payfee routing', () => {
  it('stays on the direct path until the payfee contract is live', () => {
    const a = buildCreateKeyActions('alice', auth);
    expect(routeCryptActions(a)).toBe(a);
  });

  it('key creation: one 100.0000 CHEESE payment to crypt.cheese plus payfee with the creation memo', () => {
    const out = route(buildCreateKeyActions('alice', auth));
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ account: 'cheeseburger', name: 'transfer', data: { from: 'alice', to: 'crypt.cheese', quantity: '100.0000 CHEESE' } });
    expect(out[1]).toMatchObject({ account: 'crypt.cheese', name: 'payfee', data: { payer: 'alice', fee: '100.0000 CHEESE', memo: 'CHEESECrypt key creation fee' } });
  });

  it('key publishing: 0.0100 CHEESE payfee carrying the key memo, still found by key lookup', () => {
    const out = route(buildPublishKeyActions('alice', PUB, auth));
    expect(out[0].data.quantity).toBe('0.0100 CHEESE');
    expect(out[1].data.fee).toBe('0.0100 CHEESE');
    const rows = expandPayfeeActions(asHistory(out));
    expect(rows).toEqual([expect.objectContaining({ from: 'alice', to: 'eosio.null', quantity: '0.0080 CHEESE' })]);
    expect(newestPublishedKey('alice', rows)).toBe(PUB);
  });

  it('room listing: 100.0000 CHEESE fee then sendmsg policy copies, paid in one exact payment', () => {
    const actions = [...buildRoomActions('alice', encodeListing(room), auth, LISTING_FEE_QUANTITY), ...buildSendMessageActions('alice', 'bob', ['CRYPT1:policy'], auth)];
    const out = route(actions);
    expect(out.map(a => a.name)).toEqual(['transfer', 'payfee', 'sendmsg']);
    expect(out[0].data.quantity).toBe('100.0101 CHEESE');
    expect(out[1].data.fee).toBe('100.0000 CHEESE');
    expect(out[2].data).toMatchObject({ sender: 'alice', parts: 1, copies: [{ to: 'bob', memo: 'CRYPT1:policy' }] });
  });

  it('a routed 100 CHEESE listing appears for its payer; an update keeps it; never attributed to crypt.cheese', () => {
    const list = expandPayfeeActions(asHistory(route(buildRoomActions('alice', encodeListing(room), auth, LISTING_FEE_QUANTITY)), 'tx1', '2026-11-01T00:00:00.000'));
    const update = expandPayfeeActions(asHistory(route(buildRoomActions('alice', encodeListing({ ...room, name: 'New' }), auth, ROOM_FEE_QUANTITY)), 'tx2', '2026-11-02T00:00:00.000'));
    const routerLeg = { txId: 'tx1', time: list[0].time, from: 'crypt.cheese', to: 'eosio.null', memo: list[0].memo, quantity: '80.0000 CHEESE' };
    const l = collectListings([routerLeg, ...list, ...update]);
    expect(l.map(x => [x.creator, x.name])).toEqual([['alice', 'New']]);
    // A cheap routed listing alone never lists a room.
    expect(collectListings(update)).toEqual([]);
  });

  it('drops payfee actions not authorized by their payer or with uneven fees', () => {
    const [, pay] = route(buildPublishKeyActions('alice', PUB, auth));
    expect(expandPayfeeActions(asHistory([{ ...pay, authorization: [{ actor: 'mallory', permission: 'active' }] }]))).toEqual([]);
    expect(expandPayfeeActions(asHistory([{ ...pay, data: { ...pay.data, fee: '0.0101 CHEESE' } }]))).toEqual([]);
  });

  it('leaves uneven 80/20 standalone fees on the direct path', () => {
    const a = buildPublishKeyActions('alice', PUB, auth) as A[];
    const bad = [{ ...a[0], data: { ...a[0].data, quantity: '0.0090 CHEESE' } }, a[1]];
    expect(routeCryptActions(bad, { payfee: true })).toBe(bad);
  });
});
