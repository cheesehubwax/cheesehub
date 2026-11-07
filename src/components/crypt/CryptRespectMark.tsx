import logo from '@/assets/cheese-respect-logo.png.asset.json';
import { MARK_ICON, MARK_NAME, type TrustMark } from '@/lib/cryptTrust';

/** Respect level icon + name; Big Respect shows the CHEESE token logo. */
export function CryptRespectMark({ mark }: { mark: TrustMark }) {
  const icon = MARK_ICON[mark];
  return <>{icon ?? <img src={logo.url} alt="" aria-hidden className="inline-block h-[1.1em] w-[1.1em] align-[-0.2em]" />} {MARK_NAME[mark]}</>;
}
