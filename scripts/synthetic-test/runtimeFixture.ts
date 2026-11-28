/** Offline WAX responses for signing tests. Never uses a real account key or broadcasts. */
import { PrivateKey } from '@wharfkit/antelope';
import { WAX_CHAIN_ID } from './runtime';

export function runtimeFixture(sponsored: boolean, freeOnly = false) {
  const accounts = ['alpha.chz', 'brie.chz'];
  const keys = accounts.map(() => PrivateKey.generate('K1'));
  const highKey = String(PrivateKey.generate('K1').toPublic());
  const bots = accounts.map((account, i) => ({ account, permission: 'cheesecrypt', privateKey: String(keys[i]) }));
  const authority = (key: string) => ({ threshold: 1, keys: [{ key, weight: 1 }], accounts: [], waits: [] });
  const time = '2026-11-27T14:00:00.000';
  const accountResponse = (account: string) => ({
    account_name: account, head_block_num: 100, head_block_time: time, privileged: false, last_code_update: time, created: time,
    ram_quota: 10000, net_weight: 1000, cpu_weight: 1000, ram_usage: 4000,
    net_limit: { used: 0, available: 10000, max: 10000 }, cpu_limit: { used: 0, available: 10000, max: 10000 },
    permissions: [
      { perm_name: 'owner', parent: '', required_auth: authority(highKey) },
      { perm_name: 'active', parent: 'owner', required_auth: authority(highKey) },
      { perm_name: 'cheesecrypt', parent: 'active', required_auth: authority(String(keys[accounts.indexOf(account)].toPublic())), linked_actions: [
        ...(freeOnly ? [{ account: 'crypt.cheese', action: 'sendfree' }] : [{ account: 'cheeseburger', action: 'transfer' }, { account: 'crypt.cheese', action: 'sendfree' }, { account: 'crypt.cheese', action: 'sendmsg' }]),
      ] },
    ],
  });
  const fields = (types: Record<string, string>) => Object.entries(types).map(([name, type]) => ({ name, type }));
  const abi = { version: 'eosio::abi/1.2', types: [], structs: [
    { name: 'copy', base: '', fields: fields({ to: 'name', memo: 'string' }) },
    { name: 'sendfree', base: '', fields: fields({ sender: 'name', parts: 'uint32', copies: 'copy[]' }) },
    { name: 'sendmsg', base: '', fields: fields({ sender: 'name', parts: 'uint32', copies: 'copy[]' }) },
    { name: 'transfer', base: '', fields: fields({ from: 'name', to: 'name', quantity: 'asset', memo: 'string' }) },
  ], actions: ['sendfree', 'sendmsg', 'transfer'].map(name => ({ name, type: name, ricardian_contract: '' })), tables: [], ricardian_clauses: [], error_messages: [], abi_extensions: [], variants: [] };
  const respond = (url: string, body: Record<string, string>) => {
    if (url.endsWith('/get_account')) return accountResponse(body.account_name);
    if (url.endsWith('/get_info')) return {
      server_version: 'test', chain_id: WAX_CHAIN_ID, head_block_num: 100, last_irreversible_block_num: 99,
      last_irreversible_block_id: '0'.repeat(64), head_block_id: '0'.repeat(64), head_block_time: time, head_block_producer: 'test',
      virtual_block_cpu_limit: 100000, virtual_block_net_limit: 100000, block_cpu_limit: 100000, block_net_limit: 100000,
    };
    if (url.endsWith('/get_table_rows')) return { rows: [{ daily_limit: '100.0000 CHEESE', window_start: 0, spent: '0.0000 CHEESE', sponsor_balance: '100.0000 CHEESE', funder: 'cheesepromoz', enabled: sponsored }], more: false };
    if (url.endsWith('/get_currency_balance')) return ['10.0000 CHEESE'];
    if (url.endsWith('/get_abi')) return { account_name: body.account_name, abi };
    throw new Error(`unexpected offline request ${new URL(url).pathname}`);
  };
  return { bots, keys, respond, abi };
}