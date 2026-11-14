import ethereum from '@/assets/ethereum-chain-logo.svg';
import bnb from '@/assets/bnb-chain-logo.svg';
import polygon from '@/assets/polygon-chain-logo.svg';

const logos: Record<string, string> = {
  mainnet: ethereum,
  ethereum,
  bsc: bnb,
  bnb,
  polygon,
};

export function BridgeChainLogo({ chain }: { chain: string }) {
  const src = logos[chain.toLowerCase()];
  return src ? <img src={src} alt="" aria-hidden="true" className="h-5 w-5 shrink-0 object-contain" /> : null;
}