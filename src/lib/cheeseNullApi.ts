// CHEESENull API utilities - adapted from cheese.null waxApi.ts
// Uses CHEESEHub's fetchTable for RPC fallback

import { fetchTable } from './wax';

const ALCOR_API_ENDPOINT = 'https://wax.alcor.exchange/api/v2/swap/pools';

export const CLAIM_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface VoterData {
  owner: string;
  proxy: string;
  producers: string[];
  staked: number;
  unpaid_voteshare: string;
  unpaid_voteshare_last_updated: string;
  unpaid_voteshare_change_rate: string;
  last_claim_time: string;
  last_vote_weight: string;
  proxied_vote_weight: string;
  is_proxy: number;
  flags1: number;
  reserved2: number;
  reserved3: string;
}

export interface GlobalState {
  voters_bucket: string;
  total_voteshare_change_rate: string;
  total_unpaid_voteshare: string;
  total_unpaid_voteshare_last_updated: string;
}

export interface AlcorPoolData {
  id: number;
  tokenA: { contract: string; symbol: string; quantity: string; decimals: number };
  tokenB: { contract: string; symbol: string; quantity: string; decimals: number };
  currSlot: { sqrtPriceX64: string; tick: number; lastObservationTimestamp: number; currentObservationNum: number; maxObservationNum: number };
  fee: number;
  feeProtocol: number;
  tickSpacing: number;
  maxLiquidityPerTick: string;
  priceA: number;
  priceB: number;
  volumeA24: number;
  volumeB24: number;
  volumeUSD24: number;
  change24: number;
  tvlUSD: number;
}

export interface ContractStats {
  total_burns: number;
  total_wax_claimed: string;
  total_wax_staked: string;
  total_cheese_burned: string;
  total_cheese_rewards: string;
  total_cheese_liquidity: string;
}

export interface CpowerStats {
  total_wax_cheesepowerz: string;
}

export async function fetchCpowerStats(contractAccount: string): Promise<CpowerStats | null> {
  try {
    const rows = await fetchTable<CpowerStats>(contractAccount, contractAccount, 'cpowerstats', { limit: 1 });
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('Error fetching cpowerstats:', error);
    return null;
  }
}

export function parseAssetAmount(assetString: string): number {
  if (!assetString) return 0;
  const amount = assetString.split(' ')[0];
  return parseFloat(amount) || 0;
}

export async function fetchContractStats(contractAccount: string): Promise<ContractStats | null> {
  try {
    const rows = await fetchTable<ContractStats>(contractAccount, contractAccount, 'stats', { limit: 1 });
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('Error fetching contract stats:', error);
    return null;
  }
}

export async function fetchAlcorPoolPrice(poolId: number): Promise<AlcorPoolData | null> {
  try {
    const response = await fetch(`${ALCOR_API_ENDPOINT}/${poolId}`);
    if (!response.ok) throw new Error(`Alcor API error: ${response.status}`);
    return await response.json() as AlcorPoolData;
  } catch (error) {
    console.error('Error fetching Alcor pool price:', error);
    throw error;
  }
}

export function calculateCheesePerWax(poolData: AlcorPoolData): number {
  const cheeseReserve = parseFloat(poolData.tokenA.quantity.toString());
  const waxReserve = parseFloat(poolData.tokenB.quantity.toString());
  if (waxReserve === 0) return 0;
  return cheeseReserve / waxReserve;
}

export function formatWaxAmount(amount: number): string {
  return amount.toFixed(4);
}

export function formatCheeseAmount(amount: number): string {
  return amount.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

export async function fetchVoterInfo(account: string): Promise<VoterData | null> {
  try {
    const rows = await fetchTable<VoterData>('eosio', 'eosio', 'voters', {
      lower_bound: account,
      upper_bound: account,
      limit: 1,
    });
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('Error fetching voter info:', error);
    throw error;
  }
}

export function getTimeUntilNextClaim(lastClaimTime: string): number {
  const lastClaim = new Date(lastClaimTime + 'Z').getTime();
  const nextClaim = lastClaim + CLAIM_COOLDOWN_MS;
  return Math.max(0, nextClaim - Date.now());
}

export function canClaim(lastClaimTime: string): boolean {
  return getTimeUntilNextClaim(lastClaimTime) === 0;
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Ready!';
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);
  return `${hours}h ${minutes}m ${seconds}s`;
}

export async function fetchGlobalState(): Promise<GlobalState | null> {
  try {
    const rows = await fetchTable<GlobalState>('eosio', 'eosio', 'global', { limit: 1 });
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('Error fetching global state:', error);
    throw error;
  }
}

function parseBigFloat(value: string): bigint {
  const intPart = value.split('.')[0];
  try {
    return BigInt(intPart);
  } catch {
    return 0n;
  }
}

export function calculateClaimableRewards(voterData: VoterData, globalState: GlobalState): number {
  const now = Date.now();
  const votersBucket = parseInt(globalState.voters_bucket, 10) / 100000000;

  const voterLastUpdated = new Date(voterData.unpaid_voteshare_last_updated + 'Z').getTime();
  const voterTimeElapsedSec = Math.max(0, (now - voterLastUpdated) / 1000);

  const globalLastUpdated = new Date(globalState.total_unpaid_voteshare_last_updated + 'Z').getTime();
  const globalTimeElapsedSec = Math.max(0, (now - globalLastUpdated) / 1000);

  const voterBaseVoteshare = parseBigFloat(voterData.unpaid_voteshare);
  const voterChangeRate = parseBigFloat(voterData.unpaid_voteshare_change_rate);
  const globalBaseVoteshare = parseBigFloat(globalState.total_unpaid_voteshare);
  const globalChangeRate = parseBigFloat(globalState.total_voteshare_change_rate);

  const voterTimeScaled = BigInt(Math.floor(voterTimeElapsedSec));
  const globalTimeScaled = BigInt(Math.floor(globalTimeElapsedSec));

  const voterVoteshare = voterBaseVoteshare + (voterChangeRate * voterTimeScaled);
  const globalVoteshare = globalBaseVoteshare + (globalChangeRate * globalTimeScaled);

  if (globalVoteshare === 0n) return 0;

  const SCALE = 10n ** 18n;
  const ratio = (voterVoteshare * SCALE) / globalVoteshare;
  const ratioFloat = Number(ratio) / Number(SCALE);
  return votersBucket * ratioFloat;
}
