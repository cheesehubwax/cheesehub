// Daily CHEESE powerup runner.

import { fetchTableAll, accountExists, getRecentInboundTransfers } from "./waxRpc";
import { filterEligible, type StakeRow } from "./filterStakers";
import { createSession, buildTransferAction, submitActions } from "./waxSign";

const SIGNER = process.env.WAX_SIGNER_ACCOUNT ?? "power.chz";
const PERMISSION = process.env.WAX_SIGNER_PERMISSION ?? "dailypower";
const PRIVATE_KEY = (process.env.WAX_DAILYPOWER_KEY ?? "").trim();
const DRY_RUN = process.env.DRY_RUN === "1";
const FORCE = process.env.FORCE === "1";
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
const CHEESE_CONTRACT = "cheesecheese";
const CHEESE_SYMBOL = "CHEESE";
// Any visible prior payout today blocks a re-run. The Actions run-history
// guard is the primary defense; this is defense-in-depth against Hyperion
// lag (~60m on some endpoints) so 1 is the safest threshold.
const ALREADY_RAN_THRESHOLD = 1;

const log = (...args: unknown[]) => console.log("[powerup]", ...args);

/**
 * Lag-free idempotency: ask GitHub itself whether this workflow already
 * ran successfully today. Returns true if a *different* successful run
 * of the same workflow exists with created >= start-of-UTC-day.
 * Returns false (don't block) if we can't reach the API or aren't in CI.
 */
async function alreadyRanViaActionsHistory(fromIso: string): Promise<boolean> {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY; // "owner/name"
  const runId = process.env.GITHUB_RUN_ID;
  const workflowRef = process.env.GITHUB_WORKFLOW_REF ?? "";

  if (!token || !repo) {
    log("actions-history guard: GITHUB_TOKEN/REPOSITORY missing; skipping");
    return false;
  }

  // Derive the workflow file name (e.g. "daily-powerup.yml") from
  // GITHUB_WORKFLOW_REF like "owner/repo/.github/workflows/daily-powerup.yml@refs/heads/main".
  const m = workflowRef.match(/\.github\/workflows\/([^@]+)/);
  const workflowFile = m ? m[1] : "daily-powerup.yml";

  const url =
    `https://api.github.com/repos/${repo}/actions/workflows/${workflowFile}/runs` +
    `?status=success&created=%3E%3D${encodeURIComponent(fromIso)}&per_page=20`;

  try {
    const r = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "daily-powerup-guard",
      },
    });
    if (!r.ok) {
      log(`actions-history guard: HTTP ${r.status}; skipping (not blocking)`);
      return false;
    }
    const data: {
      workflow_runs?: Array<{ id: number; conclusion: string | null; created_at: string }>;
    } = await r.json();
    const runs = data.workflow_runs ?? [];
    const others = runs.filter(
      run => String(run.id) !== String(runId) && run.conclusion === "success"
    );
    log(
      `actions-history guard: ${runs.length} success runs today, ${others.length} from prior ticks`
    );
    if (others.length > 0) {
      const earliest = others.reduce((a, b) =>
        a.created_at < b.created_at ? a : b
      );
      log(`prior successful run id=${earliest.id} at ${earliest.created_at}`);
      return true;
    }
    return false;
  } catch (e) {
    log(
      "actions-history guard: fetch failed; skipping (not blocking):",
      e instanceof Error ? e.message : String(e)
    );
    return false;
  }
}

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

  // Idempotency guard: if today's run already happened, the backup cron tick
  // (and any extra manual trigger) should no-op. Bypass with FORCE=1.
  if (!FORCE) {
    const startOfUtcDay = new Date();
    startOfUtcDay.setUTCHours(0, 0, 0, 0);
    const fromIso = startOfUtcDay.toISOString();

    // Primary guard: GitHub Actions run history. Lag-free.
    if (await alreadyRanViaActionsHistory(fromIso)) {
      log(
        "already ran today (Actions run-history shows a prior success); exiting 0. " +
          "Use workflow_dispatch with force=1 to override."
      );
      return;
    }

    // Secondary guard: on-chain transfer history via Hyperion (may lag).
    try {
      log(`idempotency check: inbound CHEESE to ${POWERUP_TARGET} from ${SIGNER} since ${fromIso}`);
      const transfers = await getRecentInboundTransfers(
        POWERUP_TARGET,
        fromIso,
        CHEESE_CONTRACT,
        CHEESE_SYMBOL
      );
      const fromSigner = transfers.filter(t => t.from === SIGNER);
      const distinctMemos = new Set(fromSigner.map(t => (t.memo ?? "").trim()).filter(Boolean));
      log(
        `idempotency: ${fromSigner.length} transfers from signer today, ${distinctMemos.size} distinct memo accounts`
      );
      if (distinctMemos.size >= ALREADY_RAN_THRESHOLD) {
        log(
          `already ran today (>= ${ALREADY_RAN_THRESHOLD} distinct memo accounts); exiting 0. ` +
            `Use workflow_dispatch with force=1 to override.`
        );
        return;
      }
    } catch (e) {
      log(
        "hyperion idempotency check failed; proceeding with run anyway:",
        e instanceof Error ? e.message : String(e)
      );
    }
  } else {
    log("FORCE=1 set; skipping idempotency check.");
  }

  log("reading cheesecheese::staketable (3 independent scans)...");
  const scans = await Promise.all(
    [0, 1, 2].map(async idx => {
      try {
        const r = await fetchTableAll<StakeRow>(
          "cheesecheese",
          "cheesecheese",
          "staketable",
          1000,
          idx
        );
        log(`scan #${idx + 1}: ${r.length} rows`);
        return r;
      } catch (e) {
        log(`scan #${idx + 1} FAILED:`, e instanceof Error ? e.message : String(e));
        return [] as StakeRow[];
      }
    })
  );

  const maxLen = Math.max(...scans.map(s => s.length));
  if (maxLen === 0) throw new Error("All 3 staketable scans returned 0 rows");
  for (const [i, s] of scans.entries()) {
    if (s.length < maxLen * 0.9) {
      log(
        `WARN: scan #${i + 1} returned ${s.length} rows (< 90% of max ${maxLen}); merged set still used`
      );
    }
  }

  // Merge by staker; keep highest cheesestaked seen across passes for safety.
  const merged = new Map<string, StakeRow>();
  for (const scan of scans) {
    for (const row of scan) {
      if (!row?.staker) continue;
      const prev = merged.get(row.staker);
      if (!prev) {
        merged.set(row.staker, row);
        continue;
      }
      const prevAmt = parseFloat(String(prev.cheesestaked).split(" ")[0]) || 0;
      const curAmt = parseFloat(String(row.cheesestaked).split(" ")[0]) || 0;
      if (curAmt > prevAmt) merged.set(row.staker, row);
    }
  }
  const rows = Array.from(merged.values());
  log(`merged distinct stakers: ${rows.length}`);

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