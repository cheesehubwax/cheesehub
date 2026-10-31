import { describe, it, expect } from 'vitest';
import { buildSendMessageActions, buildPublishKeyActions, buildCreateKeyActions, expandRouterActions, routeCryptActions } from '@/lib/cheeseCrypt';

const auth = [{ actor: 'alice', permission: 'active' }];

describe('crypt.cheese router adapter', () => {
  it('turns a 1-part message into one exact 0.0101 payment plus sendmsg', () => {
    const out = routeCryptActions(buildSendMessageActions('alice', 'bob', ['CRYPT1:abc'], auth)) as { account: string; name: string; data: any }[];
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ account: 'cheeseburger', name: 'transfer', data: { from: 'alice', to: 'crypt.cheese', quantity: '0.0101 CHEESE' } });
    expect(out[1]).toMatchObject({ account: 'crypt.cheese', name: 'sendmsg', data: { sender: 'alice', parts: 1, copies: [{ to: 'bob', memo: 'CRYPT1:abc' }] } });
  });

  it('charges 0.0100 per part plus 0.0001 per copy for a 3-part message', () => {
    const out = routeCryptActions(buildSendMessageActions('alice', 'bob', ['CRYPT1:a', 'CRYPT1:b', 'CRYPT1:c'], auth)) as { data: any }[];
    expect(out[0].data.quantity).toBe('0.0303 CHEESE');
    expect(out[1].data.parts).toBe(3);
  });

  it('routes a group message: one shared fee per part, one copy per member', () => {
    const actions = [
      ...buildSendMessageActions('alice', 'bob', ['CRYPT1:b1', 'CRYPT1:b2'], auth, false, true),
      ...buildSendMessageActions('alice', 'carol', ['CRYPT1:c1', 'CRYPT1:c2'], auth, false, false),
    ];
    const out = routeCryptActions(actions) as { data: any }[];
    expect(out[0].data.quantity).toBe('0.0204 CHEESE');
    expect(out[1].data.copies.map((c: { to: string }) => c.to)).toEqual(['bob', 'bob', 'carol', 'carol']);
  });

  it('leaves key creation, key publishing and fee-less batches on the direct path', () => {
    for (const a of [buildCreateKeyActions('alice', auth), buildPublishKeyActions('alice', 'PUB', auth), buildSendMessageActions('alice', 'bob', ['CRYPT1:x'], auth, false, false)])
      expect(routeCryptActions(a, { payfee: false })).toBe(a);
  });

  it('leaves uneven per-recipient copies on the direct path', () => {
    const a = [...buildSendMessageActions('alice', 'bob', ['CRYPT1:1', 'CRYPT1:2'], auth), ...buildSendMessageActions('alice', 'carol', ['CRYPT1:3'], auth, false, false)];
    expect(routeCryptActions(a)).toBe(a);
  });
});

describe('router history sender resolution', () => {
  const sendmsg = (sender: string, actor: string) => ({ act: { account: 'crypt.cheese', name: 'sendmsg', authorization: [{ actor, permission: 'active' }], data: { sender, parts: 1, copies: [{ to: 'bob', memo: 'CRYPT1:m' }] } } });

  it('attributes a router delivery to the authorizing sendmsg sender, not crypt.cheese', () => {
    expect(expandRouterActions('tx', 1, [sendmsg('alice', 'alice')])).toEqual([{ txId: 'tx', time: 1, from: 'alice', to: 'bob', memo: 'CRYPT1:m', quantity: '0.0001 CHEESE' }]);
  });

  it('ignores a sendmsg whose claimed sender did not authorize it', () => {
    expect(expandRouterActions('tx', 1, [sendmsg('alice', 'mallory')])).toEqual([]);
  });
});
