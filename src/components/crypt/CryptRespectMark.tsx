import logo from '@/assets/cheese-token-logo.png';
import { openMojiMap } from '@/components/OpenMojiIcon';
import { MARK_ICON, MARK_NAME, type TrustMark } from '@/lib/cryptTrust';

/** Respect level icon + name; Big Respect shows the CHEESE token logo. */
export function CryptRespectMark({ mark }: { mark: TrustMark }) {
  const icon = MARK_ICON[mark];
  const image = icon === null ? logo : openMojiMap[icon];
  return <>{image ? <img src={image} alt="" aria-hidden className="inline-block h-[1.1em] w-[1.1em] align-[-0.2em]" /> : icon} {MARK_NAME[mark]}</>;
}
