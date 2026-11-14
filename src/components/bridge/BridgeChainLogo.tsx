import ethereum from '@/assets/ethereum-chain-logo.svg.asset.json';
import bnb from '@/assets/bnb-chain-logo.svg.asset.json';
import polygon from '@/assets/polygon-chain-logo.svg.asset.json';

const logos: Record<string, string> = {
  mainnet: ethereum.url,
  ethereum: ethereum.url,
  bsc: bnb.url,
  bnb: bnb.url,
  polygon: polygon.url,
};

export function BridgeChainLogo({ chain }: { chain: string }) {
  const src = logos[chain.toLowerCase()];
  return src ? <img src={src} alt="" aria-hidden="true" className="h-5 w-5 shrink-0 object-contain" /> : null;
}