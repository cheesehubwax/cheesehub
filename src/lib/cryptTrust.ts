/**
 * CHEESECrypt trust strength: a published, fixed-weight score built only from public chain
 * signals plus local context. It is a decision aid, never identity verification.
 * Unknown signals (a read failed) are left out of the total and mark the score partial; they never count as zero.
 */

export type TrustMark = 'warning' | 'low' | 'moderate' | 'good' | 'strong';

export interface TrustSignals {
  account: string;
  /** Account creation time (ms), null = unknown. */
  createdAt: number | null;
  /** Liquid CHEESE, null = unknown. */
  cheese: number | null;
  /** CHEESE staked in cheesecheese, null = unknown. */
  staked: number | null;
  /** CHEESE across Alcor CHEESE pools and the number of distinct pools, null = unknown. */
  pooled: { cheese: number; pools: number } | null;
  /** cheesenftwax NFTs held, null = unknown. */
  nfts: number | null;
  /** Earliest key publication (ms) and whether a key is currently published; null = unknown. */
  key: { published: boolean; firstAt: number | null } | null;
  /** Local context; undefined = not available here (not counted, not partial). */
  local?: { sharedRooms: number; pastChat: boolean };
}

export interface TrustLine { id: string; label: string; points: number | null; detail: string }
export interface TrustScore { total: number; mark: TrustMark; partial: boolean; lines: TrustLine[] }

const DAY = 86_400_000;
const YEAR = 365 * DAY;

export const isPremiumName = (account: string) => /\.(cheese|chz)$/.test(account);
export const PREMIUM_POINTS = 40;

export function agePoints(ageMs: number): number {
  if (ageMs < 7 * DAY) return -15;
  if (ageMs < 30 * DAY) return 3;
  if (ageMs < YEAR) return 8;
  if (ageMs < 3 * YEAR) return 16;
  if (ageMs < 5 * YEAR) return 24;
  return 32;
}

export function balancePoints(c: number): number {
  if (c >= 50_000) return 30;
  if (c >= 10_000) return 20;
  if (c >= 1_000) return 12;
  if (c >= 100) return 6;
  if (c >= 1) return 2;
  return 0;
}

export function stakePoints(c: number): number {
  if (c >= 50_000) return 32;
  if (c >= 20_000) return 24;
  if (c >= 5_000) return 16;
  if (c >= 100) return 8;
  return 0;
}

export function poolPoints(c: number, pools: number): number {
  if (!(c > 0)) return 0;
  const base = c >= 50_000 ? 40 : c >= 20_000 ? 32 : c >= 5_000 ? 24 : c >= 1_000 ? 16 : c >= 100 ? 8 : 2;
  return base + (pools >= 2 ? 5 : 0);
}

export function nftPoints(n: number): number {
  if (n >= 50) return 25;
  if (n >= 20) return 18;
  if (n >= 5) return 10;
  if (n >= 1) return 4;
  return 0;
}

export function keyAgePoints(ageMs: number): number {
  if (ageMs >= YEAR) return 10;
  if (ageMs >= 182 * DAY) return 6;
  if (ageMs >= 30 * DAY) return 3;
  return 0;
}

export function markFor(total: number, newAccount: boolean): TrustMark {
  if (newAccount || total < 10) return 'warning';
  if (total < 30) return 'low';
  if (total < 60) return 'moderate';
  if (total < 90) return 'good';
  return 'strong';
}

export const MARK_LABEL: Record<TrustMark, string> = {
  warning: '⚠️ Warning', low: '🟡 Low', moderate: '🟢 Moderate', good: '🔷 Good', strong: '🛡️ Strong',
};

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 4 });
const span = (ms: number) => ms >= YEAR ? `${Math.floor(ms / YEAR)} yr` : `${Math.max(0, Math.floor(ms / DAY))} days`;

export function scoreTrust(s: TrustSignals, now = Date.now()): TrustScore {
  const lines: TrustLine[] = [];
  const premium = isPremiumName(s.account);
  lines.push({ id: 'name', label: '🧀 Premium CHEESE name', points: premium ? PREMIUM_POINTS : 0, detail: premium ? s.account : 'No .cheese or .chz name' });
  lines.push(s.createdAt == null ? { id: 'age', label: '⏳ Account age', points: null, detail: 'Unknown' }
    : { id: 'age', label: '⏳ Account age', points: agePoints(now - s.createdAt), detail: span(now - s.createdAt) });
  lines.push(s.cheese == null ? { id: 'cheese', label: '🧀 CHEESE held', points: null, detail: 'Unknown' }
    : { id: 'cheese', label: '🧀 CHEESE held', points: balancePoints(s.cheese), detail: `${fmt(s.cheese)} CHEESE` });
  lines.push(s.staked == null ? { id: 'stake', label: '🚰 Faucet stake', points: null, detail: 'Unknown' }
    : { id: 'stake', label: '🚰 Faucet stake', points: stakePoints(s.staked), detail: `${fmt(s.staked)} CHEESE` });
  lines.push(s.pooled == null ? { id: 'pool', label: '💧 Liquidity', points: null, detail: 'Unknown' }
    : { id: 'pool', label: '💧 Liquidity', points: poolPoints(s.pooled.cheese, s.pooled.pools), detail: `${fmt(s.pooled.cheese)} CHEESE in ${s.pooled.pools} pool${s.pooled.pools === 1 ? '' : 's'}` });
  lines.push(s.nfts == null ? { id: 'nft', label: '🖼️ CHEESE NFTs', points: null, detail: 'Unknown' }
    : { id: 'nft', label: '🖼️ CHEESE NFTs', points: nftPoints(s.nfts), detail: `${s.nfts}` });
  if (s.key == null) {
    lines.push({ id: 'key', label: '🔑 Published key', points: null, detail: 'Unknown' });
    lines.push({ id: 'keyage', label: '🗝️ CHEESECrypt key age', points: null, detail: 'Unknown' });
  } else {
    lines.push({ id: 'key', label: '🔑 Published key', points: s.key.published ? 10 : 0, detail: s.key.published ? 'Published on chain' : 'Not published' });
    const ka = s.key.published && s.key.firstAt != null ? now - s.key.firstAt : null;
    lines.push({ id: 'keyage', label: '🗝️ CHEESECrypt key age', points: ka == null ? 0 : keyAgePoints(ka), detail: ka == null ? 'No key' : span(ka) });
  }
  if (s.local) {
    lines.push({ id: 'rooms', label: '👥 Shared rooms', points: Math.min(15, 5 * Math.max(0, s.local.sharedRooms)), detail: `${s.local.sharedRooms}` });
    lines.push({ id: 'chat', label: '💬 Past chat with you', points: s.local.pastChat ? 5 : 0, detail: s.local.pastChat ? 'Yes' : 'No' });
  }
  const total = lines.reduce((t, l) => t + (l.points ?? 0), 0);
  const partial = lines.some(l => l.points == null);
  const newAccount = s.createdAt != null && now - s.createdAt < 7 * DAY;
  return { total, mark: markFor(total, newAccount), partial, lines };
}

export const TRUST_DISCLAIMER = 'Based on public blockchain data only. It does not confirm who someone is. Use your own judgement.';
