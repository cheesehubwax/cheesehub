import { fetchTable, WAXDAO_CONTRACT } from "@/lib/wax";

// Known LP token contracts that should be excluded from token locks
const LP_TOKEN_CONTRACTS = ["lptoken.box", "swap.taco"];

// Lock status values from WaxDAO locker contract
export const LOCK_STATUS = {
  CREATED: 0,     // Lock created, awaiting token deposit
  FUNDED: 1,      // Tokens deposited, lock is active
  WITHDRAWN: 2,   // Tokens have been claimed/withdrawn
} as const;

// Actual table structure from WaxDAO locker contract
export interface TokenLock {
  ID: number;
  creator: string;
  receiver: string;
  amount: string;  // e.g., "100.0000 WAX"
  token_contract: string;
  time_of_creation: number;  // Unix timestamp
  time_of_deposit: number;   // Unix timestamp
  unlock_time: number;       // Unix timestamp
  status: number;            // 0 = created, 1 = funded, 2 = withdrawn
}

// Fetch locks for a specific user (by receiver - the person who can claim)
// Excludes LP token locks which are shown in the Liquidity Locks tab
export async function fetchUserLocks(account: string): Promise<TokenLock[]> {
  try {
    // Use receiver index (index_position 3) to find locks claimable by this user
    const allLocks = await fetchTable<TokenLock>(
      WAXDAO_CONTRACT,
      WAXDAO_CONTRACT,
      "locks",
      {
        lower_bound: account,
        upper_bound: account,
        key_type: "name",
        index_position: 3, // receiver index
        limit: 100,
      }
    );

    // Filter out LP token locks (those go to the Liquidity Locks tab)
    const tokenLocks = allLocks.filter(
      lock => !LP_TOKEN_CONTRACTS.includes(lock.token_contract)
    );

    console.log("Raw locks data:", allLocks);
    console.log("Filtered token locks (excluding LP):", tokenLocks);
    return tokenLocks;
  } catch (error) {
    console.error("Failed to fetch locks:", error);
    return [];
  }
}

// Format asset string (e.g., "100.0000 WAX" -> { amount: "100.0000", symbol: "WAX" })
export function parseAsset(asset: string | undefined): { amount: string; symbol: string } {
  if (!asset || typeof asset !== 'string') {
    console.warn("parseAsset received invalid value:", asset);
    return { amount: "0", symbol: "UNKNOWN" };
  }
  const parts = asset.split(" ");
  return { amount: parts[0] || "0", symbol: parts[1] || "UNKNOWN" };
}

// Format unlock time from Unix timestamp
export function formatUnlockTime(timestamp: number): string {
  const date = new Date(timestamp * 1000); // Convert seconds to milliseconds
  return date.toLocaleString();
}

// Check if lock is claimable (must be funded AND unlock time has passed)
export function isClaimable(lock: TokenLock): boolean {
  if (lock.status !== LOCK_STATUS.FUNDED) return false; // Only funded locks can be claimed
  const now = Math.floor(Date.now() / 1000); // Current time in seconds
  return now >= lock.unlock_time;
}

// Get time remaining until unlock
export function getTimeRemaining(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = timestamp - now;

  if (diff <= 0) return "Unlocked";

  const days = Math.floor(diff / (60 * 60 * 24));
  const hours = Math.floor((diff % (60 * 60 * 24)) / (60 * 60));
  const minutes = Math.floor((diff % (60 * 60)) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// Get display status for a lock
export function getLockStatus(lock: TokenLock): { label: string; variant: "default" | "secondary" | "outline" | "destructive" } {
  if (lock.status === LOCK_STATUS.WITHDRAWN) {
    return { label: "Claimed", variant: "secondary" };
  }
  if (lock.status === LOCK_STATUS.CREATED) {
    return { label: "Awaiting Deposit", variant: "outline" };
  }
  // Status is FUNDED
  if (isClaimable(lock)) {
    return { label: "Claimable", variant: "default" };
  }
  return { label: "Locked", variant: "outline" };
}
