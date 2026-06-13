// Daily CHEESE powerup runner.

import { fetchTableAll, accountExists } from "./waxRpc";
import { filterEligible, type StakeRow } from "./filterStakers";
import { createSession, buildTransferAction, submitActions } from "./waxSign";

const SIGNER = process.env.WAX_SIGNER_ACCOUNT ?? "power.chz";
const PERMISSION = process.env.WAX_SIGNER_PERMISSION ?? "dailypower";
const PRIVATE_KEY = process.env.WAX_DAILYPOWER_KEY ?? "";
const DRY_RUN = process.env.DRY_RUN === "1";
const ALLOWLIST = (process.env.ALLOWLIST ?? "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

// Tunable via repo Variables / workflow_dispatch inputs. Empty string => default.
const MIN_STAKED_RAW = process.env.MIN_STAKED?.trim();
const POWERUP_AMOUNT_RAW = process.env.POWERUP_AMOUNT?.trim();
const MIN_STAKED = Number(MIN_STAKED_RAW && MIN_STAKED_RAW.length > 0 ? MIN_STAKED_RAW : "5000");
const POWERUP_AMOUNT = Number(
  POWERUP_AMOUNT_RAW && POWERUP_AMOUNT_RAW.length > 0 ? POWERUP_AMOUNT_RAW : "1.0000"
);

if (!Number.isFinite(MIN_STAKED) || MIN_STAKED < 0) {
  throw new Error(`Invalid MIN_STAKED=${process.env.MIN_STAKED}; must be a finite number >= 0`);
}
if (!Number.isFinite(POWERUP_AMOUNT) || POWERUP_AMOUNT <= 0 || POWERUP_AMOUNT > 100) {
  throw new Error(
    `Invalid POWERUP_AMOUNT=${process.env.POWERUP_AMOUNT}; must be a finite number in (0, 100]`
  );
}

const BATCH_SIZE = 50;
const MAX_BISECT_OPS = 20;
const POWERUP_TARGET = "cheesepowerz";
const TRANSFER_AMOUNT = `${POWERUP_AMOUNT.toFixed(4)} CHEESE`;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const log = (...args: unknown[]) => console.log("[powerup]", ...args);

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

interface RunStats {
  txIds: string[];
  sent: string[];
  failed: string[];
  bisectOps: number;
}

async function sendBatchWithBisect(
  session: ReturnType<typeof createSession>,
  accounts: string[],
  stats: RunStats
): Promise<void> {
  if (accounts.length === 0) return;
  if (stats.bisectOps >= MAX_BISECT_OPS) {
    log(`bisect cap (${MAX_BISECT_OPS}) reached; marking ${accounts.length} accounts as failed`);
    stats.failed.push(...accounts);
    return;
  }

  const actions = accounts.map(account =>
    buildTransferAction(session, {
      from: SIGNER,
      to: POWERUP_TARGET,
      quantity: TRANSFER_AMOUNT,
      memo: account,
    })
  );

  try {
    const txId = await submitActions(session, actions);
    stats.txIds.push(txId);
    stats.sent.push(...accounts);
    log(`batch ok (${accounts.length}) tx=${txId}`);
  } catch (e) {
    stats.bisectOps++;
    const msg = e instanceof Error ? e.message : String(e);
    if (accounts.length === 1) {
      log(`single-account failure: ${accounts[0]}: ${msg}`);
      stats.failed.push(accounts[0]);
      return;
    }
    log(`batch failure (${accounts.length}): ${msg} -> bisecting`);
    const mid = Math.floor(accounts.length / 2);
    await sendBatchWithBisect(session, accounts.slice(0, mid), stats);
    await sendBatchWithBisect(session, accounts.slice(mid), stats);
  }
}

async function main() {
  log(`signer=${SIGNER}@${PERMISSION} dry_run=${DRY_RUN} allowlist=${ALLOWLIST.length}`);
  log(`config: min_staked=${MIN_STAKED} CHEESE, per_account=${TRANSFER_AMOUNT}`);

  if (!DRY_RUN && !PRIVATE_KEY) {
    throw new Error("WAX_DAILYPOWER_KEY env var is required");
  }

  log("reading cheesecheese::staketable...");
  const rows = await fetchTableAll<StakeRow>("cheesecheese", "cheesecheese", "staketable", 1000);
  log(`fetched ${rows.length} rows`);

  let eligible = filterEligible(rows, MIN_STAKED, [SIGNER]);
  log(`eligible (>= ${MIN_STAKED} CHEESE): ${eligible.length}`);

  if (ALLOWLIST.length > 0) {
    const set = new Set(ALLOWLIST);
    eligible = eligible.filter(s => set.has(s.account));
    log(`allowlist filter applied -> ${eligible.length}`);
  }

  log("validating accounts exist...");
  const existence = await mapLimit(eligible, 8, async s => ({
    s,
    ok: await accountExists(s.account),
  }));
  const valid = existence.filter(x => x.ok).map(x => x.s);
  const skipped = existence.filter(x => !x.ok).map(x => x.s.account);
  if (skipped.length) log(`skipping ${skipped.length} missing accounts:`, skipped.join(","));
  log(`valid stakers: ${valid.length}`);

  const totalCheese = (valid.length * POWERUP_AMOUNT).toFixed(4);
  log(`projected CHEESE spend: ${totalCheese}`);

  if (DRY_RUN) {
    log("DRY_RUN=1 set; skipping all transactions.");
    log("first batch (up to 50):", valid.slice(0, BATCH_SIZE).map(s => s.account));
    return;
  }

  const session = createSession(SIGNER, PERMISSION, PRIVATE_KEY);

  // Send powerup transfers to stakers. power.chz relies on its own staked WAX
  // (CPU/NET) to land these transactions; no self-powerup phase.
  log(`sending to ${valid.length} stakers in batches of ${BATCH_SIZE}`);
  const stats: RunStats = { txIds: [], sent: [], failed: [], bisectOps: 0 };
  for (const batch of chunk(valid.map(s => s.account), BATCH_SIZE)) {
    await sendBatchWithBisect(session, batch, stats);
  }

  log("---- summary ----");
  log(`eligible:    ${eligible.length}`);
  log(`skipped:     ${skipped.length} (missing accounts)`);
  log(`sent:        ${stats.sent.length}`);
  log(`failed:      ${stats.failed.length}`);
  log(`txs:         ${stats.txIds.length}`);
  log(`cheese spent (approx): ${(stats.sent.length * POWERUP_AMOUNT).toFixed(4)} CHEESE`);
  log("tx ids:");
  for (const id of stats.txIds) log(`  ${id}`);
  if (stats.failed.length) {
    log("failed accounts:", stats.failed.join(","));
    process.exitCode = 1;
  }
}

main().catch(e => {
  console.error("[powerup] fatal:", e);
  process.exit(1);
});