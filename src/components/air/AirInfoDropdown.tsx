// CHEESEAir — collapsible explainer anchored to the right of the page title.
import type { ReactNode } from 'react';
import { DappAbout } from '@/components/about/DappAbout';

const sections = [
  {
    title: 'Pick what you are sending',
    body: 'Token mode sends any WAX token you hold. NFT mode sends NFTs from your inventory. RAM mode buys RAM for every selected WAX account using CHEESE. Choose the mode first, then follow the fields shown for that asset.',
  },
  {
    title: 'Snapshot the holders',
    body: 'Build a recipient list from holders of a WAX token, an NFT collection, schema or template, or liquidity providers on Alcor, Taco or Defibox. Token and liquidity snapshots support up to 5,000 accounts; NFT snapshots support up to 2,000 assets.\n\nReview the account list before continuing. Your own account and common system accounts start unticked, and you can select all, none, a top group or individual recipients.',
  },
  {
    title: 'Choose the distribution',
    body: 'Equal split shares one total evenly. Fixed each sends the same amount to every recipient. Pro-rata gives more to accounts with a larger snapshot balance. Use the preview and minimum-balance filter to confirm exactly who receives what.',
  },
  {
    title: 'Review and run the airdrop',
    body: 'Check the recipient table and estimated CHEESE, RAM, CPU and NET needs before starting. Large drops are divided into batches, with one wallet approval per batch. You can stop after the current batch, follow each result on WAXBlock, and download a CSV of the snapshot or completed results.\n\nCHEESEAir never holds your assets or wallet keys.',
  },
  {
    title: 'Airdrop RAM directly',
    body: 'Choose RAM as the send type, then set the total in CHEESE or the RAM amount in KB. Each recipient receives RAM directly; CHEESEAir automatically keeps every purchase within the allowed per-recipient minimum and maximum.\n\nThe quote uses the current RAM price. If the requested drop needs more WAX than the liquid pool can handle, the warning offers a clickable maximum that safely fits the pool.',
  },
  {
    title: 'Costs and limits',
    body: 'The table previews the first 500 rows, but every selected account remains in the airdrop. Resource and price figures are estimates and can move before signing, so CHEESEAir includes small RAM and CPU safety margins. Always review the final wallet transaction.',
  },
];

interface AirInfoDropdownProps {
  children: ReactNode;
}

export const AirInfoDropdown = ({ children }: AirInfoDropdownProps) => {
  return (
    <DappAbout
      title="CHEESEAir"
      introduction="Plan and send token, NFT or RAM airdrops to a transparent WAX snapshot."
      sections={sections}
    >
      {children}
    </DappAbout>
  );
};
