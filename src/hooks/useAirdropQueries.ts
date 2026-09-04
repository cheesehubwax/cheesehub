// CHEESEAir — cached chain reads for the airdrop dashboard.
import { useQuery } from '@tanstack/react-query';
import {
  getAccountResources,
  getInventoryAssets,
  getInventoryCollections,
  getInventoryTemplates,
  getRamPrice,
  getResourcePricing,
  getTokenStat,
  getWalletTokens,
} from '@/lib/airdropChain';
import { fetchAlcorPairs } from '@/lib/airdropAlcorLp';

const ACCOUNT_RE = /^[a-z1-5.]{1,12}$/;

/** Token supply/precision for the token being sent. */
export function useAirTokenStat(code: string, symbol: string) {
  const enabled = ACCOUNT_RE.test(code) && symbol.length > 0;
  return useQuery({
    queryKey: ['air-token-stat', code, symbol.toUpperCase()],
    queryFn: () => getTokenStat(code, symbol.toUpperCase()),
    enabled,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

/** Every token the connected account holds, for the quick-pick chips. */
export function useAirWalletTokens(account: string | null) {
  return useQuery({
    queryKey: ['air-wallet-tokens', account],
    queryFn: () => getWalletTokens(account as string),
    enabled: !!account,
    staleTime: 60 * 1000,
  });
}

/** CPU / NET / RAM headroom and stake weights of the connected account. */
export function useAirAccountResources(account: string | null) {
  return useQuery({
    queryKey: ['air-account-resources', account],
    queryFn: () => getAccountResources(account as string),
    enabled: !!account,
    staleTime: 30 * 1000,
  });
}

/** WAX cost of RAM, per KB and per fresh token-balance row. */
export function useAirRamPrice() {
  return useQuery({
    queryKey: ['air-ram-price'],
    queryFn: getRamPrice,
    staleTime: 60 * 1000,
  });
}

/** Live CHEESE pricing for RAM and powerup purchases. */
export function useAirResourcePricing() {
  return useQuery({
    queryKey: ['air-resource-pricing'],
    queryFn: getResourcePricing,
    staleTime: 60 * 1000,
    retry: 1,
  });
}

/** Collections the connected account owns NFTs from. */
export function useAirInventoryCollections(account: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['air-inventory-collections', account],
    queryFn: () => getInventoryCollections(account as string),
    enabled: !!account && enabled,
    staleTime: 2 * 60 * 1000,
  });
}

/** Templates owned inside one collection. */
export function useAirInventoryTemplates(
  account: string | null,
  collection: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['air-inventory-templates', account, collection],
    queryFn: () => getInventoryTemplates(account as string, collection),
    enabled: !!account && !!collection && enabled,
    staleTime: 2 * 60 * 1000,
  });
}

/** The pool of asset ids of one template owned by the account. */
export function useAirInventoryAssets(
  account: string | null,
  collection: string,
  templateId: number | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['air-inventory-assets', account, collection, templateId],
    queryFn: () => getInventoryAssets(account as string, collection, templateId as number),
    enabled: !!account && !!collection && templateId !== null && enabled,
    staleTime: 60 * 1000,
  });
}

/** Every Alcor pair (all fee tiers merged) for the LP snapshot picker. */
export function useAirAlcorPairs(enabled: boolean) {
  return useQuery({
    queryKey: ['air-alcor-pairs'],
    queryFn: fetchAlcorPairs,
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
