/**
 * Adds CHEESE prices to RAM records that have none (backfilled slots), using
 * the CHEESE daily close for the record's UTC day. Records that already carry
 * a CHEESE price (live samples) are never touched. Re-runs change nothing.
 * Env: RAM_HISTORY_FILE
 */
import { cheeseFields, loadCheeseDays } from "./cheesePrice";

interface RamHistoryRecord {
  t: number;
  waxPerKb: number;
  cheesePerKb: number | null;
  waxPerCheese: number | null;
  usdPerKb: number | null;
}

async function main() {
  const file = process.env.RAM_HISTORY_FILE;
  if (!file) throw new Error("RAM_HISTORY_FILE is required");
  const records = JSON.parse(await Bun.file(file).text()) as RamHistoryRecord[];
  if (!Array.isArray(records) || !records.length) throw new Error("RAM history is empty — refusing to write");

  const days = await loadCheeseDays();
  if (days.size < 100) throw new Error("CHEESE history has too few days — refusing to write");

  let enriched = 0;
  for (const r of records) {
    if (r.cheesePerKb != null) continue;
    const f = cheeseFields(days, r.t, r.waxPerKb);
    if (!f) continue;
    r.cheesePerKb = f.cheesePerKb;
    r.waxPerCheese = f.waxPerCheese;
    enriched++;
  }
  await Bun.write(file, `${JSON.stringify(records)}\n`);
  const left = records.filter((r) => r.cheesePerKb == null).length;
  console.log(`Gave ${enriched} records a CHEESE price; ${left} remain without one (before CHEESE traded).`);
}

main().catch((e) => {
  console.error("CHEESE enrichment failed:", e);
  process.exit(1);
});
