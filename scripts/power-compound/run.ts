import { Session, PrivateKey, PublicKey, Chains } from '@wharfkit/session';
import { WalletPluginPrivateKey } from '@wharfkit/wallet-plugin-privatekey';
import { TransactPluginResourceProvider } from '@wharfkit/transact-plugin-resource-provider';
import { ACCOUNT, PERMISSION, claimAction, stakeAction, validatePermission, utcMs } from './policy';
import { CHAIN_ID, connect, snapshot, sessionFetch, rpc, type Info } from './rpc';
import { maintain } from './service';

async function main(): Promise<void> {
  const dryRun = process.env.DRY_RUN !== '0'; // Safe by default, including local runs.
  if (!dryRun && process.env.POWER_COMPOUND_ENABLED !== 'true') {
    console.log('Automation disabled. Set POWER_COMPOUND_ENABLED=true only after a successful dry run.');
    return;
  }
  await connect();
  const first = await snapshot();
  console.log(`CHEESEPower: ${ACCOUNT}@${PERMISSION}, dry_run=${dryRun}`);
  let session: Session | undefined;
  if (!dryRun) {
    const secret = process.env.WAX_POWER_COMPOUND_KEY;
    if (!secret?.trim()) throw new Error('Missing WAX_POWER_COMPOUND_KEY in GitHub Actions secrets');
    let key: PrivateKey;
    try { key = PrivateKey.from(secret.trim()); }
    catch { throw new Error('Invalid automation key; check the GitHub secret'); }
    const publicKey = key.toPublic().toString();
    validatePermission(first.account.permissions, publicKey, k => PublicKey.from(k).toString());
    session = new Session({ chain: Chains.WAX, actor: ACCOUNT, permission: PERMISSION,
      walletPlugin: new WalletPluginPrivateKey(key.toString()) }, { fetch: sessionFetch });
  }

  async function submit(action: ReturnType<typeof claimAction> | ReturnType<typeof stakeAction>): Promise<void> {
    if (!session) throw new Error('No live signing session');
    const result = await session.transact({ actions: [action] }, {
      transactPlugins: [new TransactPluginResourceProvider({
        endpoints: { [CHAIN_ID]: 'https://wax.greymass.com' }, allowFees: false,
      })],
    });
    const id = result.resolved?.transaction.id.toString();
    const response = result.response as { transaction_id?: string; processed?: {
      block_num?: number; receipt?: { status?: string } } } | undefined;
    if (!id || response?.transaction_id !== id || response.processed?.receipt?.status !== 'executed') {
      throw new Error('Broadcast outcome unconfirmed; stop without retrying');
    }
    const block = response.processed.block_num;
    if (!block) throw new Error('Missing execution block; refusing another action');
    console.log(`${action.name}: executed transaction ${id}. Waiting for irreversibility.`);
    const deadline = Date.now() + 180_000;
    while (Date.now() < deadline) {
      const info = await rpc<Info>('get_info', {});
      if (info.last_irreversible_block_num >= block) return;
      await new Promise(resolve => setTimeout(resolve, 3_000));
    }
    throw new Error('Confirmation timeout; inspect the logged transaction before retrying');
  }

  await maintain({
    read: async () => {
      const state = await snapshot();
      return { balance: state.balance, voter: state.voter, now: utcMs(state.info.head_block_time) };
    },
    claim: () => submit(claimAction()),
    stake: units => submit(stakeAction(units)),
    log: console.log,
  }, dryRun);
}

main().catch(error => {
  // Never print arbitrary wallet/library errors: they can contain private input.
  const message = error instanceof Error ? error.message : '';
  const safe = /^(Missing WAX_POWER|Invalid automation|compound must|Missing compound|Automation key|No fresh WAX|RPC is no longer|Liquid balance|Account\/voter|Claim timestamp|Broadcast outcome|Missing execution|Confirmation timeout|RPC \w+ returned)/.test(message);
  console.error(safe ? message : 'Runner stopped safely. Check account eligibility, permission links, CPU/NET and the public transaction log. No blind broadcast retry was attempted.');
  process.exitCode = 1;
});