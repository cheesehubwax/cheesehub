/**
 * CHEESE Fee Payment System - Simplified Single-Transaction Flow
 *
 * Enables users to pay DAO and Farm creation fees with CHEESE token
 * at a 20% discount instead of WAX/WAXDAO.
 *
 * NEW FLOW (Single Transaction):
 * 1. User sends CHEESE to cheesefeefee with memo containing WAXDAO amount
 * 2. Contract immediately sends WAXDAO back to user (inline)
 * 3. Contract immediately burns CHEESE to eosio.null (inline)
 * 4. User's bundled transaction pays WAXDAO to WaxDAO and creates farm/dao
 * 5. If any step fails, entire transaction reverts atomically
 */

import { fetchTableRows } from "./waxRpcFallback";

// ============================================================================
// FEATURE FLAG - Set to true when contract is deployed and funded
// ============================================================================
export const CHEESE_FEE_ENABLED = true;

// ============================================================================
// Contract Configuration
// ============================================================================
export const CHEESE_FEE_CONTRACT = "cheesefeefee";
export const CHEESE_TOKEN_CONTRACT = "cheeseburger";
export const CHEESE_TOKEN_SYMBOL = "CHEESE";
export const CHEESE_TOKEN_PRECISION = 4;

export const WAXDAO_TOKEN_CONTRACT = "token.waxdao";
export const WAXDAO_TOKEN_SYMBOL = "WAXDAO";
export const WAXDAO_TOKEN_PRECISION = 8;

// For reference/display
export const WAX_EQUIVALENT_FEE = 250; // 250 WAX equivalent
export const CHEESE_DISCOUNT = 0.20; // 20% discount when paying with CHEESE
export const CHEESE_SAFETY_BUFFER = 0.025; // 2.5% buffer for price drift

// Legacy export for compatibility
export const WAX_FEE_AMOUNT = WAX_EQUIVALENT_FEE;

// ============================================================================
// Types
// ============================================================================
export type FeeType = "dao" | "farm";
export type PaymentMethod = "wax" | "cheese";

export interface ContractBalance {
  waxdao: number;
  cheese: number;
}

// ============================================================================
// Fetch Functions
// ============================================================================

/**
 * Fetch the WAXDAO balance of the cheesefeefee contract
 * Used to check if the pool has enough WAXDAO to process payments
 */
export async function fetchContractWaxdaoBalance(): Promise<number> {
  try {
    const response = await fetchTableRows<{ balance: string }>({
      code: WAXDAO_TOKEN_CONTRACT,
      scope: CHEESE_FEE_CONTRACT,
      table: "accounts",
      limit: 1,
    });

    if (response.rows.length === 0) return 0;

    const balanceStr = response.rows[0].balance;
    const amount = parseFloat(balanceStr.split(" ")[0]);
    return isNaN(amount) ? 0 : amount;
  } catch (error) {
    console.error("Failed to fetch contract WAXDAO balance:", error);
    return 0;
  }
}

// ============================================================================
// Action Builders
// ============================================================================

/**
 * Build CHEESE transfer action - contract calculates WAXDAO via Alcor prices
 * This is the FIRST action in the bundled transaction
 *
 * @param user - User sending CHEESE
 * @param cheeseAmount - Formatted CHEESE amount (e.g., "41840.50000000 CHEESE")
 * @param feeType - "dao" or "farm"
 * @param entityName - Name of the entity being created
 */
export function buildCheesePaymentAction(
  user: string,
  cheeseAmount: string,
  feeType: FeeType,
  entityName: string
) {
  // Simplified memo - contract calculates WAXDAO from Alcor prices
  const memo = `${feeType}fee|${entityName}`;

  return {
    account: CHEESE_TOKEN_CONTRACT,
    name: "transfer",
    authorization: [{ actor: user, permission: "active" }],
    data: {
      from: user,
      to: CHEESE_FEE_CONTRACT,
      quantity: cheeseAmount,
      memo,
    },
  };
}

/**
 * Build action to pay WAXDAO fee to WaxDAO contracts
 * This is the SECOND action - user pays WAXDAO received from inline action
 */
export function buildWaxdaoFeeAction(
  sender: string,
  targetContract: string,
  waxdaoAmount: string,
  memo: string
) {
  return {
    account: WAXDAO_TOKEN_CONTRACT,
    name: "transfer",
    authorization: [{ actor: sender, permission: "active" }],
    data: {
      from: sender,
      to: targetContract,
      quantity: waxdaoAmount,
      memo,
    },
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format CHEESE amount with proper precision for transactions
 */
export function formatCheeseAmount(amount: number): string {
  return `${amount.toFixed(CHEESE_TOKEN_PRECISION)} ${CHEESE_TOKEN_SYMBOL}`;
}

/**
 * Format CHEESE amount for display (with commas)
 */
export function formatCheeseDisplay(amount: number): string {
  const rounded = Math.ceil(amount);
  return new Intl.NumberFormat().format(rounded);
}

/**
 * Calculate discounted CHEESE amount for a given WAX fee
 * @param waxAmount - The WAX fee amount (e.g., 250)
 * @param cheeseWaxPrice - Price of 1 CHEESE in WAX
 * @returns The discounted CHEESE amount
 */
export function calculateDiscountedCheeseAmount(
  waxAmount: number,
  cheeseWaxPrice: number
): number {
  if (cheeseWaxPrice <= 0) return 0;

  // Base amount: waxAmount / price per CHEESE
  const baseAmount = waxAmount / cheeseWaxPrice;

  // Apply 20% discount (user pays equivalent of 200 WAX instead of 250)
  const discountedAmount = baseAmount * (1 - CHEESE_DISCOUNT);

  // Add 2% safety buffer to prevent failures from price drift
  const finalAmount = discountedAmount * (1 + CHEESE_SAFETY_BUFFER);

  return finalAmount;
}

/**
 * Check if the contract pool has enough WAXDAO for a payment
 * @param requiredAmount - The WAXDAO amount needed
 */
export async function hasEnoughPoolBalance(requiredAmount: number): Promise<boolean> {
  const balance = await fetchContractWaxdaoBalance();
  return balance >= requiredAmount;
}
