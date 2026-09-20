import type { ReactNode } from 'react';
import { DappAbout } from '@/components/about/DappAbout';

const sections = [
  {
    title: 'Buy RAM with CHEESE',
    body: 'Open Buy RAM, enter how much CHEESE to spend and choose the receiving WAX account. Review the live estimate, available reserve and account name, then approve the transaction. The RAM is added directly to the recipient.',
  },
  {
    title: 'Sell RAM back for CHEESE',
    body: 'Open Sell RAM to see your currently unused bytes and the estimated CHEESE payout. Enter the amount, review how much RAM remains on your account, then sign. Leave enough RAM for your account and any apps you still use.',
  },
  {
    title: 'Why use CHEESERam',
    body: 'It gives CHEESE a direct use for buying one of WAX’s essential resources, lets users recover value from spare RAM, and supports the wider CHEESE ecosystem. CHEESE used for buys is split between permanent nulling and xCHEESE liquidity support.',
  },
  {
    title: 'Costs and limits',
    body: 'Quotes follow the live WAX RAM market and CHEESE/WAX price, so they can change before signing. A 0.5% CHEESERam spread applies on each side; WAX and liquidity fees make a buy-then-sell round trip roughly 1.5–2%.\n\nMinimums, maximums and a pool-impact cap protect each buy. Selling pauses if the CHEESE payout reserve is too low, and the page shows when that happens.',
  },
  {
    title: 'Payout pool deposits',
    body: 'The Fund WAX Pool area lets anyone contribute CHEESE liquidity for RAM sellers. This is a one-way contribution, not a RAM purchase or investment, so only use it when you intentionally want to support the payout reserve.',
  },
];

interface RamInfoDropdownProps {
  children: ReactNode;
}

export const RamInfoDropdown = ({ children }: RamInfoDropdownProps) => {
  return (
    <DappAbout
      title="CHEESERam"
      introduction="Buy WAX RAM with CHEESE or exchange spare RAM back into CHEESE."
      sections={sections}
    >
      {children}
    </DappAbout>
  );
};
