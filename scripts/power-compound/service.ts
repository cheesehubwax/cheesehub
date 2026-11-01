import { CLAIM_GAP_MS, claimDue, stakeExcess, utcMs, waxAsset, type Voter } from './policy';

export interface State { balance: string; voter: Voter; now: number; hasRefund?: boolean }
export interface Operations {
  read(): Promise<State>;
  claim(): Promise<void>;
  stake(units: bigint): Promise<void>;
  log(message: string): void;
}

export async function maintain(ops: Operations, dryRun: boolean): Promise<void> {
  let state = await ops.read();
  if (claimDue(state.voter, state.now)) {
    if (dryRun) {
      ops.log('DRY RUN: vote claim due; no signing. Post-claim CPU amount requires a fresh balance.');
    } else {
      const previousClaim = utcMs(state.voter.last_claim_time);
      await ops.claim();
      state = await ops.read();
      if (utcMs(state.voter.last_claim_time) <= previousClaim) throw new Error('Claim timestamp did not advance');
    }
  } else {
    const next = utcMs(state.voter.last_claim_time) + CLAIM_GAP_MS;
    ops.log(`No claim due. Earliest time: ${new Date(next).toISOString()}`);
  }
  // A new read also prevents using a balance from before a manual powerup.
  state = await ops.read();
  if (state.hasRefund) {
    ops.log('Pending unstake refund: skipping CPU stake so delegation cannot consume refund funds.');
    return;
  }
  const excess = stakeExcess(state.balance);
  ops.log(`Liquid: ${state.balance}; reserve: 400.00000000 WAX; CPU excess: ${waxAsset(excess)}`);
  if (excess === 0n || dryRun) return;
  await ops.stake(excess);
  const after = await ops.read();
  ops.log(`Confirmed CPU stake; liquid now ${after.balance}.`);
}