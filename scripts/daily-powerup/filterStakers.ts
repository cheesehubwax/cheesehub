// Parse cheesecheese::staketable rows and filter to eligible stakers.

export interface StakeRow {
  account: string;
  staked: string;
  [k: string]: unknown;
}

/** Parse "12345.6789 CHEESE" -> 12345.6789. Returns NaN on bad input. */
export function parseAssetAmount(asset: string): number {
  if (!asset || typeof asset !== "string") return NaN;
  const [amount] = asset.trim().split(" ");
  const n = Number(amount);
  return Number.isFinite(n) ? n : NaN;
}

export interface EligibleStaker {
  account: string;
  staked: number;
}

export function filterEligible(
  rows: StakeRow[],
  minStaked: number,
  excludeAccounts: string[] = []
): EligibleStaker[] {
  const exclude = new Set(excludeAccounts);
  const seen = new Set<string>();
  const out: EligibleStaker[] = [];
  for (const row of rows) {
    const account = row.account;
    if (!account || exclude.has(account) || seen.has(account)) continue;
    const staked = parseAssetAmount(row.staked);
    if (!Number.isFinite(staked) || staked < minStaked) continue;
    seen.add(account);
    out.push({ account, staked });
  }
  out.sort((a, b) => a.account.localeCompare(b.account));
  return out;
}