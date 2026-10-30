// One pre-signing budget shared by token, NFT and RAM runs.
import { parseUnits, totalUnits, type AirdropRecipient, type RamPurchase } from './airdrop';
import { CHEESE_CONTRACT, CHEESE_PRECISION, CHEESE_SYMBOL } from './airdropCheese';
import { formatCheese } from './airdropResources';

export function cheeseBudgetUnits(input: {
  isRam: boolean; isNft: boolean; sendContract: string; sendSymbol: string; precision: number;
  recipients: AirdropRecipient[]; ramPurchases: RamPurchase[]; ramTopups: number[]; cpuCheese: number | null;
}): bigint {
  const quantityUnits = (amount: number) => {
    if (!Number.isFinite(amount) || amount < 0 || !Number.isSafeInteger(Math.round(amount * 10 ** CHEESE_PRECISION))) throw new Error('CHEESE resource amount exceeds safe precision');
    return parseUnits(formatCheese(amount), CHEESE_PRECISION);
  };
  let units = quantityUnits(input.cpuCheese ?? 0);
  for (const amount of input.ramTopups) units += quantityUnits(amount);
  if (input.isRam) {
    for (const purchase of input.ramPurchases) {
      if (purchase.units <= 0n) throw new Error('Invalid RAM purchase quantity');
      units += purchase.units;
    }
  } else if (!input.isNft && input.sendContract === CHEESE_CONTRACT && input.sendSymbol.toUpperCase() === CHEESE_SYMBOL) {
    if (input.precision !== CHEESE_PRECISION) throw new Error('CHEESE token precision does not match');
    units += totalUnits(input.recipients);
  }
  return units;
}

export function cheeseBalanceUnits(balance: number | null): bigint | null {
  if (balance === null || !Number.isFinite(balance) || balance < 0 || !Number.isSafeInteger(Math.round(balance * 10 ** CHEESE_PRECISION))) return null;
  return parseUnits(formatCheese(balance), CHEESE_PRECISION);
}