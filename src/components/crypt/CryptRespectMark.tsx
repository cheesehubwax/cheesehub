import { MARK_NAME, type TrustMark } from '@/lib/cryptTrust';
import { CryptRespectArt } from './CryptRespectArt';

/** Respect level emblem + name (used in the breakdown). */
export function CryptRespectMark({ mark }: { mark: TrustMark }) {
  return <span className="inline-flex items-center gap-1.5 align-middle"><CryptRespectArt mark={mark} size={22} />{MARK_NAME[mark]}</span>;
}
