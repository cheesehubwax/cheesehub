# CHEESEPower vote reward / CPU automation

No cheesepowerz contract update is required. This separate GitHub runner signs as
`cheesepowerz@compound`, never as active or owner. It is disabled until you opt in.

## Behaviour

- Checks hourly at minute 23 UTC. GitHub may delay or skip scheduled runs; no exact execution-time guarantee.
- Uses fresh WAX chain time and the persisted voter `last_claim_time`. At least **24 hours + 5 minutes** must elapse between claims. The next hourly tick may be later; it does not drift by exactly five minutes daily.
- Calls `eosio::claimgbmvote` (the current system alias for voter rewards) when prior-vote/share checks and the interval pass. The system remains the final authority on reward eligibility and amount. A failed claim stops that run without attempting staking.
- Waits for an executed transaction ID and irreversible block, then rereads the updated claim timestamp and liquid balance.
- Stakes only excess over **400.00000000 WAX** to cheesepowerz's own CPU, with NET zero and `transfer=false`, using exact eight-decimal integer arithmetic.
- Can also stake excess when no claim is due. Skips staking if there is a pending unstake refund, since self-staking can otherwise consume that refund.
- Has no transfer, vote-changing, unstaking, or permission-management action in the runner. It never changes the existing proxy.
- Concurrency is serialized. Broadcast is pinned to the preflight node; no blind write retries or active-key fallback. Read-only startup uses health-ordered endpoint fallback.
- Attempts free Greymass Fuel sponsorship; paid sponsorship is disabled. Keep CPU/NET available because free sponsorship is not guaranteed.

## Important security limitation

Action links constrain action names, **not their arguments**. A stolen key with
`delegatebw` authority could stake more than intended, to another receiver, or
transfer stake ownership using `transfer=true`. The 400-WAX reserve and own-CPU
restrictions are runner rules, **not on-chain permission limits**. This is narrower
than an active key but it is not a spending-limited key. Stronger enforcement
needs a separately audited policy contract. Keep the GitHub repository and account
secure; require two-factor authentication and restrict who can edit workflows.

The runner adds no custody of other users' assets; it operates only this account.
It cannot establish the legal treatment of the existing rewards/resource service.
The account's existing `active` grant to its own `eosio.code` is unchanged.

## One-time setup — waxblock.io + Anchor

These permission changes require your own Anchor signatures. **Do not paste a
private key into chat, a source file, a command-line argument, or a repository variable.**

1. Generate a **new, dedicated WAX K1 keypair locally** using your trusted wallet/key tool. Record its public key and secure private backup. Do not reuse the existing active/owner key or daily-powerup key. The runner never generates or receives a key during setup here.
2. Log into waxblock.io as `cheesepowerz` with Anchor. Open the `eosio` contract's actions. Use `updateauth`, signed by `cheesepowerz@active`, with:

   ```json
   {
     "account": "cheesepowerz",
     "permission": "compound",
     "parent": "active",
     "auth": {
       "threshold": 1,
       "keys": [{"key": "YOUR_NEW_PUBLIC_KEY", "weight": 1}],
       "accounts": [],
       "waits": []
     }
   }
   ```

   Replace only `YOUR_NEW_PUBLIC_KEY`. Do not replace active/owner, add a contract-code authority to compound, or change the existing active authority.

3. Submit `eosio::linkauth`, signed by `cheesepowerz@active`:

   ```json
   {"account":"cheesepowerz","code":"eosio","type":"claimgbmvote","requirement":"compound"}
   ```

4. Submit a second `eosio::linkauth`:

   ```json
   {"account":"cheesepowerz","code":"eosio","type":"delegatebw","requirement":"compound"}
   ```

   Only these two links. No wildcards. Parent active authority continues to work for manual actions and the existing contract.

5. In **bewbzz/cheesehub → Settings → Secrets and variables → Actions → Secrets**, create the repository secret **`WAX_POWER_COMPOUND_KEY`** containing only the new private key. This is a GitHub secret, not a Lovable secret; GitHub is where the runner executes. The runner trims whitespace and validates that the key matches the dedicated permission, is not reused in another permission, and has exactly the two expected action links. If an RPC omits action-link metadata it fails closed instead of guessing.
6. Once these changes reach the repository's default branch, open **Actions → CHEESEPower vote rewards and CPU → Run workflow**. Leave **Read-only test** checked. Review the public liquid balance, claim timing, and CPU excess. This test sends nothing and does not require the key.
7. To activate, go to **Settings → Secrets and variables → Actions → Variables** and add **`POWER_COMPOUND_ENABLED` = `true`**. Run the workflow with Read-only test unchecked. This authorizes real claims and CPU staking. Inspect the logged transaction IDs on waxblock.io and confirm the reward transfer, updated claim time, own CPU stake, and remaining liquid balance.
8. Thereafter the hourly schedule handles maintenance. If the last claim was too recent it skips that claim. There is no force/bypass option.

## Pause / revoke

- Pause immediately by changing `POWER_COMPOUND_ENABLED` to `false` or disabling this workflow in GitHub Actions. This does not revoke a leaked key.
- To revoke authority, use active/owner to replace the compound key with a new secure key, or submit `eosio::unlinkauth` for each of the two links and then `eosio::deleteauth` for `compound`. Do not delete active or owner. Remove the GitHub secret afterwards.
- If a run fails after reporting a transaction ID, inspect that transaction and on-chain state before a manual retry. The next scheduled run reads current chain state rather than relying on a local last-run file.

## Tests and safe local check

In Windows CMD, from the repository folder (Bun installed):

```cmd
cd scripts\power-compound
bun install --frozen-lockfile
bun test
set DRY_RUN=1
bun run run.ts
```

Local runs default to read-only. Workflow dependencies use the committed isolated
lockfile; these dependencies do not change the dApp bundle.

Live signing cannot be verified until your new permission/key are configured.
The tests exercise concrete claim timing, reserve precision, key isolation,
claim-before-stake sequencing, dry-run safety, failed-claim stop and refund safety.

System-source reference: https://github.com/worldwide-asset-exchange/wax-system-contracts/blob/wax-3.4.0/contracts/eosio.system/src/voting.cpp