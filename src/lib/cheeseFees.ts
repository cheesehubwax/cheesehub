/**
 * CHEESE Fee Payment System - Secure Two-Pool Pricing
 */

import { fetchTableRows } from "./waxRpcFallback";

export const CHEESE_FEE_ENABLED = true;

export const CHEESE_FEE_CONTRACT = "cheesefeefee";
export const CHEESE_TOKEN_CONTRACT = "cheeseburger";
export const CHEESE_TOKEN_SYMBOL = "CHEESE";
export const CHEESE_TOKEN_PRECISION = 4;

export const WAXDAO_TOKEN_CONTRACT = "token.waxdao";
export const WAXDAO_TOKEN_SYMBOL = "WAXDAO";
export const WAXDAO_TOKEN_PRECISION = 8;

export const WAX_EQUIVALENT_FEE = 265;
export const CHEESE_DISCOUNT = 0.20;
export const CHEESE_SAFETY_BUFFER = 0.025;

export const WAX_TO_WAXDAO = 215;
export const WAX_TO_BURNER = 50;

export const MIN_WAXDAO_OUTPUT = 5.0;

// Legacy export for compatibility
export const WAX_FEE_AMOUNT = WAX_EQUIVALENT_FEE;

export type FeeType = "dao" | "farm";
export type PaymentMethod = "wax" | "cheese";

export interface ContractBalance {
  waxdao: number;
  cheese: number;
}

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

export function buildCheesePaymentAction(
  user: string,
  cheeseAmount: string,
  feeType: FeeType,
  entityName: string
) {
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

export function buildWaxPaymentAction(
  user: string,
  feeType: FeeType,
  entityName: string
) {
  const memo = `wax${feeType}fee|${entityName}`;

  return {
    account: "eosio.token",
    name: "transfer",
    authorization: [{ actor: user, permission: "active" }],
    data: {
      from: user,
      to: CHEESE_FEE_CONTRACT,
      quantity: `${WAX_EQUIVALENT_FEE}.00000000 WAX`,
      memo,
    },
  };
}

export function formatCheeseAmount(amount: number): string {
  return `${amount.toFixed(CHEESE_TOKEN_PRECISION)} ${CHEESE_TOKEN_SYMBOL}`;
}

export function formatCheeseDisplay(amount: number): string {
  const rounded = Math.ceil(amount);
  return new Intl.NumberFormat().format(rounded);
}

export function calculateDiscountedCheeseAmount(
  waxAmount: number,
  cheeseWaxPrice: number
): number {
  if (cheeseWaxPrice <= 0) return 0;

  const baseAmount = waxAmount / cheeseWaxPrice;
  const discountedAmount = baseAmount * (1 - CHEESE_DISCOUNT);
  const finalAmount = discountedAmount * (1 + CHEESE_SAFETY_BUFFER);

  return finalAmount;
}

export function calculateExpectedWaxdaoOutput(
  cheeseAmount: number,
  cheeseWaxPrice: number,
  waxdaoWaxPrice: number
): number {
  if (cheeseWaxPrice <= 0 || waxdaoWaxPrice <= 0) return 0;

  const waxValue = cheeseAmount * cheeseWaxPrice;
  const waxdaoPerWax = 1 / waxdaoWaxPrice;
  const waxdaoAmount = waxValue * waxdaoPerWax;

  return waxdaoAmount;
}

export async function hasEnoughPoolBalance(requiredAmount: number): Promise<boolean> {
  const balance = await fetchContractWaxdaoBalance();
  return balance >= requiredAmount;
}
