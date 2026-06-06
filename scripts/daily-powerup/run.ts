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

const MIN_STAKED = 1000; // CHEESE
const BATCH_SIZE = 50;
const MAX_BISECT_OPS = 20;
const POWERUP_TARGET = "cheesepowerz";
const TRANSFER_AMOUNT = "1.0000 CHEESE";

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

  const totalCheese = (valid.length + 1).toFixed(4);
  log(`projected CHEESE spend: ${totalCheese} (incl. self-powerup)`);

  if (DRY_RUN) {
    log("DRY_RUN=1 set; skipping all transactions.");
    log("self-powerup action would be:", {
      from: SIGNER,
      to: POWERUP_TARGET,
      quantity: TRANSFER_AMOUNT,
      memo: SIGNER,
    });
    log("first batch (up to 50):", valid.slice(0, BATCH_SIZE).map(s => s.account));
    return;
  }

  const session = createSession(SIGNER, PERMISSION, PRIVATE_KEY);

  // Phase 0: self-powerup
  log("phase 0: self-powerup");
  const selfStats: RunStats = { txIds: [], sent: [], failed: [], bisectOps: 0 };
  await sendBatchWithBisect(session, [SIGNER], selfStats);
  if (selfStats.failed.length) {
    throw new Error("self-powerup failed; aborting run");
  }
  log(`self-powerup tx=${selfStats.txIds[0]}; waiting 3s for CPU to settle...`);
  await sleep(3000);

  // Phase 1: stakers
  log(`phase 1: sending to ${valid.length} stakers in batches of ${BATCH_SIZE}`);
  const stats: RunStats = { txIds: [], sent: [], failed: [], bisectOps: 0 };
  for (const batch of chunk(valid.map(s => s.account), BATCH_SIZE)) {
    await sendBatchWithBisect(session, batch, stats);
  }

  log("---- summary ----");
  log(`eligible:    ${eligible.length}`);
  log(`skipped:     ${skipped.length} (missing accounts)`);
  log(`sent:        ${stats.sent.length}`);
  log(`failed:      ${stats.failed.length}`);
  log(`txs:         ${stats.txIds.length + 1} (including self-powerup)`);
  log(`cheese spent (approx): ${(stats.sent.length + 1).toFixed(4)} CHEESE`);
  log("tx ids:");
  log(`  self-powerup: ${selfStats.txIds[0]}`);
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