// Verifies the daily CHEESE powerup actually ran today.
// Exits non-zero (failing the GitHub Actions run, which sends the standard
// failure email) if no inbound CHEESE transfers from the signer to
// cheesepowerz are found since 00:00 UTC today.

import { getRecentInboundTransfers } from "./waxRpc";

const SIGNER = process.env.WAX_SIGNER_ACCOUNT ?? "power.chz";
const POWERUP_TARGET = "cheesepowerz";
const CHEESE_CONTRACT = "cheesecheese";
const CHEESE_SYMBOL = "CHEESE";
const MIN_EXPECTED = Number(process.env.WATCHDOG_MIN_TRANSFERS ?? "10");

const log = (...args: unknown[]) => console.log("[watchdog]", ...args);

async function main() {
  const startOfUtcDay = new Date();
  startOfUtcDay.setUTCHours(0, 0, 0, 0);
  const fromIso = startOfUtcDay.toISOString();

  log(`checking inbound CHEESE to ${POWERUP_TARGET} from ${SIGNER} since ${fromIso}`);
  const transfers = await getRecentInboundTransfers(
    POWERUP_TARGET,
    fromIso,
    CHEESE_CONTRACT,
    CHEESE_SYMBOL
  );
  const fromSigner = transfers.filter(t => t.from === SIGNER);
  const distinctMemos = new Set(fromSigner.map(t => (t.memo ?? "").trim()).filter(Boolean));
  log(`found ${fromSigner.length} transfers from signer, ${distinctMemos.size} distinct memo accounts`);

  if (distinctMemos.size < MIN_EXPECTED) {
    console.error(
      `[watchdog] FAIL: only ${distinctMemos.size} distinct recipient memos today ` +
        `(expected >= ${MIN_EXPECTED}). Daily powerup likely failed to run.`
    );
    process.exit(1);
  }

  log(`OK: daily powerup ran today (${distinctMemos.size} >= ${MIN_EXPECTED}).`);
}

main().catch(e => {
  console.error("[watchdog] fatal:", e);
  process.exit(1);
});