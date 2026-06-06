# Daily CHEESE Powerup Cron — Plan

Run a scheduled GitHub Actions workflow once per day at **00:00 UTC** that:
1. **Self-powerup**: first action of the run is `cheeselardr1` sending `1.0000 CHEESE` → `cheesepowerz` with memo `cheeselardr1` so it has CPU to sign the rest of the batch.
2. Reads every row of `cheesecheese::staketable`.
3. Filters to rows where `staked >= 1000.0000 CHEESE`.
4. For each eligible account, sends `1.0000 CHEESE` from **cheeselardr1** → **cheesepowerz** with the staker account name as the memo (powerup contract uses the memo as the CPU receiver — confirmed against `PowerUpCard.tsx` line 121).
5. Batches actions into transactions, skips broken accounts, logs results.

No app/UI changes. Everything lives in `.github/workflows/` and a new `scripts/` folder.

---

## What gets added

```text
.github/workflows/daily-powerup.yml   # cron 0 0 * * *  (UTC)
scripts/daily-powerup/
  ├── package.json                    # standalone, not part of the app build
  ├── tsconfig.json
  ├── run.ts                          # main entry
  ├── waxRpc.ts                       # multi-endpoint fetchTable (mirrors src/lib/wax.ts)
  ├── waxSign.ts                      # @wharfkit/session signer (PrivateKey)
  ├── filterStakers.ts                # parse + filter staketable rows
  └── README.md                       # ops notes
```

The script uses its own `package.json` so we don't pollute the app bundle. It runs with **bun** (already used in CI).

---

## Behaviour details

### Phase 0 — Self-powerup (NEW)
- Single-action transaction sent **before** anything else:
  - `cheeseburger::transfer { from: cheeselardr1, to: cheesepowerz, quantity: "1.0000 CHEESE", memo: "cheeselardr1" }`
- Wait `~3 seconds` (one block round) for the powerup to take effect before the staker batches go out.
- If this single tx fails, abort the whole run (no point continuing without CPU). Exit non-zero so GH flags it.
- This 1 CHEESE/day is added to the daily budget (so total = `(eligible_stakers + 1) × 1 CHEESE`).

### Reading `staketable`
- Source contract/scope: `cheesecheese` / `cheesecheese`, table `staketable`.
- Paginate with `limit: 1000` + `lower_bound` until `more === false`.
- Multi-endpoint fallback identical to `src/lib/wax.ts` (alohaeos → greymass → eosphere → waxsweden).

### Filter
- Parse the `staked` asset field (e.g. `"12345.6789 CHEESE"`) → number.
- Keep rows with `staked >= 1000`.
- Exclude `cheeselardr1` itself (already handled in Phase 0).
- Sort by account name (stable ordering = predictable logs).
- Deduplicate by account just in case.

### Staker powerup transfers
- Action: `cheeseburger::transfer`
  - `from: "cheeselardr1"`
  - `to: "cheesepowerz"`
  - `quantity: "1.0000 CHEESE"`
  - `memo: "<staker_account>"`  ← CPU-only powerup.
- Authorization: `cheeselardr1@dailypower` (new restricted permission — see Security).

### Batching & failure handling — "Skip & continue"
1. **Pre-validate** every staker exists via `/v1/chain/get_account` (parallel, 8 at a time, 5 s timeout). Drop missing accounts.
2. Build actions in **batches of 50**.
3. Push each batch as one transaction.
4. If a batch fails (any reason), **bisect** down to find the bad account, drop it, retry the remainder. Worst case = log2(50) ≈ 6 retries per bad account.
5. Cap total bisection attempts per run (e.g. 20) so a global outage doesn't burn the whole CHEESE balance.

### Reporting
- Print a compact summary at end: total eligible, sent, skipped (missing account), failed (after bisect), total CHEESE spent (including the self-powerup), all TX IDs.
- Exit non-zero if the self-powerup failed or any batch ultimately failed → GitHub shows a red run and you get an email.

---

## Security — signing key

This is the sensitive part. The workflow needs a private key.

**Required setup (you do this once, manually):**
1. On `cheeselardr1`, create a new permission named `dailypower` with a fresh keypair, parent = `active`. Via `cleos set account permission` or any wallet UI.
2. Link it to **only** `cheeseburger::transfer`:
   ```
   cleos set action permission cheeselardr1 cheeseburger transfer dailypower
   ```
   This single linkauth covers both Phase 0 and the staker batches (same action). The key is useless for anything except `cheeseburger::transfer` from `cheeselardr1`.
3. Add the private key as a GitHub repo secret named `WAX_DAILYPOWER_KEY`.
4. Add `WAX_SIGNER_ACCOUNT = cheeselardr1` and `WAX_SIGNER_PERMISSION = dailypower` as plain repo variables (not secrets).

The script reads these from `process.env`. The key is never written to a file and never logged.

**Funding:** `cheeselardr1` must keep enough CHEESE to cover `(N + 1) × 1.0000` per day. The first powerup of the day provides its own CPU budget, but it still needs a tiny baseline of CPU/NET to land that initial transaction — make sure it always has at least a few ms of free CPU (top up manually once, or set up a small WAX stake to itself).

---

## Workflow file shape

```yaml
name: Daily CHEESE Powerup
on:
  schedule:
    - cron: "0 0 * * *"   # 00:00 UTC daily
  workflow_dispatch:       # manual trigger for testing
jobs:
  powerup:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
        working-directory: scripts/daily-powerup
      - run: bun run run.ts
        working-directory: scripts/daily-powerup
        env:
          WAX_SIGNER_ACCOUNT:    ${{ vars.WAX_SIGNER_ACCOUNT }}
          WAX_SIGNER_PERMISSION: ${{ vars.WAX_SIGNER_PERMISSION }}
          WAX_DAILYPOWER_KEY:    ${{ secrets.WAX_DAILYPOWER_KEY }}
```

`workflow_dispatch` lets you manually run from the GitHub Actions tab to test before the cron takes over.

---

## Known limits

- **GitHub cron drift:** scheduled workflows can fire up to ~15 min late and occasionally skip during incidents. Fine for a daily 1-CHEESE powerup.
- **Bootstrap CPU:** the very first self-powerup tx still needs CPU to land. Keep a small permanent WAX stake on `cheeselardr1` so it always has baseline CPU; the daily 1-CHEESE self-powerup tops it up from there.
- **Key on a server:** even with a restricted permission, the key exists in GitHub's secret store. Restriction to `cheeseburger::transfer` means worst-case leak = attacker can move your `cheeseburger` tokens but nothing else (no staking, no NFTs, no DAO, no account changes).
- **CHEESE budget:** `(eligible_stakers + 1) × 1 CHEESE/day`. E.g. 200 stakers ≈ 201 CHEESE/day ≈ 6030/month. Script logs the projected cost on every run.
- **`cheesepowerz` outage:** if the powerup contract is paused or out of WAX, transactions revert. Bisect logic eventually drops everyone and run exits non-zero; no CHEESE is spent on reverted batches.

---

## Validation before going live

1. Manually run via `workflow_dispatch` with cron commented out and `DRY_RUN=1`:
   - Confirms `staketable` is read (count + sample rows printed).
   - Confirms filter is correct (count of eligible stakers printed).
   - Prints the would-be self-powerup action and the first batch.
2. Real run with an allowlist override targeting just one eligible account + the self-powerup, to validate signing and that the powerup memo behaves as expected (`cheeselardr1` gets CPU on tx 1, the test staker gets CPU on tx 2).
3. Remove the allowlist, enable the cron.

---

## What this plan deliberately does NOT do

- No on-chain contract. Pure off-chain script.
- No UI/admin page to view/manage the schedule. Add later if needed.
- No persistence of per-day history (GitHub Actions run logs are the audit trail). A Lovable Cloud table for run history can be added in a follow-up if you want it surfaced in `/admin`.
- No `cheeseburner` interaction — separate concern from the burn-pipeline discussion.
