import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { OpenMojiIcon } from '@/components/OpenMojiIcon';

export interface AboutSection {
  title: string;
  body: string;
}

interface DappAboutProps {
  children: ReactNode;
  title: string;
  introduction: string;
  sections: AboutSection[];
}

export const DappAbout = ({ children, title, introduction, sections }: DappAboutProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="w-full">
      <div className="relative inline-flex items-center justify-center">
        {children}
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`${open ? 'Close' : 'Open'} ${title} guide`}
            className="absolute left-[calc(100%+0.5rem)] top-1/2 h-auto -translate-y-1/2 gap-1.5 whitespace-nowrap px-2 py-1 text-cheese hover:bg-cheese/10 hover:text-cheese"
          >
            <OpenMojiIcon emoji="ℹ️" size={18} />
            <span className="hidden text-xs font-semibold uppercase sm:inline">About</span>
          </Button>
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent className="overflow-hidden">
        <div className="mx-auto mt-6 max-w-3xl rounded-lg border border-cheese/20 bg-card/80 p-5 text-left shadow-lg backdrop-blur-sm sm:p-6">
          <h2 className="mb-1 text-xl font-bold text-cheese">About {title}</h2>
          <p className="mb-6 text-sm leading-relaxed text-muted-foreground">{introduction}</p>
          <div className="space-y-6">
            {sections.map((section) => (
              <section key={section.title} className="space-y-2">
                <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cheese" />
                  {section.title}
                </h3>
                {section.body.split('\n\n').map((paragraph) => (
                  <p key={paragraph} className="pl-3.5 text-sm leading-relaxed text-muted-foreground">
                    {paragraph}
                  </p>
                ))}
              </section>
            ))}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export const aboutGuides = {
  powerup: {
    title: 'CHEESEUp',
    introduction: 'Rent extra WAX CPU and NET for 24 hours by spending CHEESE.',
    sections: [
      { title: 'How to power up', body: 'Connect your wallet, enter how much CHEESE to spend, choose the CPU and NET split, and check the receiving account. Review the estimate, then sign once in your wallet.' },
      { title: 'Why use it', body: 'A temporary resource boost helps an account complete transactions when its CPU or NET is low. You can power up your own account or help another WAX account.' },
      { title: 'Before you sign', body: 'The resources last about 24 hours. CHEESE spent through CHEESEUp is sent to eosio.null and cannot be recovered, so check the amount and recipient carefully.' },
    ],
  },
  null: {
    title: 'CHEESENull',
    introduction: 'Take part in a public CHEESE nulling cycle that supports other CHEESEHub services.',
    sections: [
      { title: 'How to use it', body: 'Connect your wallet and check the countdown. When the action becomes available, press the null button and approve the transaction. The page then updates the totals and leaderboard.' },
      { title: 'What it benefits', body: 'Each completed action removes CHEESE from circulation while helping fund CHEESEUp resource rentals and xCHEESE liquidity.' },
      { title: 'Cooldown and finality', body: 'The button remains unavailable during the public cooldown. A completed null is permanent: the CHEESE sent to eosio.null cannot be returned.' },
    ],
  },
  farm: {
    title: 'CHEESEFarm',
    introduction: 'Stake eligible NFTs without giving up ownership and earn the rewards offered by each farm.',
    sections: [
      { title: 'Join a farm', body: 'Browse active farms, open one to check its accepted NFTs, reward token and dates, then stake eligible NFTs from your wallet. Return to the farm to claim rewards or unstake.' },
      { title: 'Create and manage', body: 'Use Create Farm to define the eligible collection and rewards. My Farms keeps farms you created or joined together in one place.' },
      { title: 'Review the terms', body: 'Rewards, eligibility, dates and available funding differ by farm. Check each farm before staking. Creating a farm has a fee, and every wallet action requires your approval.' },
    ],
  },
  dao: {
    title: 'CHEESEDao',
    introduction: 'Create or join WAX communities that coordinate proposals, votes and shared treasuries.',
    sections: [
      { title: 'Participate', body: 'Browse a DAO, open its page, and review its membership and voting rules. Stake the eligible assets when required, then vote on active proposals with the weight shown to you.' },
      { title: 'Create and govern', body: 'Create DAO guides you through community settings and governance choices. Inside a DAO, eligible members can submit proposals and approved actions can manage token or NFT treasury assets transparently.' },
      { title: 'Costs and responsibility', body: 'Proposal and creation actions can require WAX fees. Voting power and rules vary by DAO, so review the specific settings and proposal details before signing.' },
    ],
  },
  drip: {
    title: 'CHEESEDrip',
    introduction: 'Schedule token payments over time for payroll, vesting or recurring distributions.',
    sections: [
      { title: 'Create a drip', body: 'Choose the receiver, token, payment amount, hours between payments and end date. Creation and funding are two separate wallet approvals, so complete both signatures.' },
      { title: 'Manage payments', body: 'Use My Drips to follow schedules you created. Receivers claim the amount that has become available according to the schedule.' },
      { title: 'Keep your records', body: 'Custom drip names are saved only in this browser and are not part of the on-chain schedule. Check the receiver, total funding and dates carefully before accepting the terms and signing.' },
    ],
  },
  locker: {
    title: 'CHEESELock',
    introduction: 'Make a public, time-based commitment by locking fungible tokens or liquidity positions.',
    sections: [
      { title: 'Choose a lock', body: 'Use Create Lock for normal tokens or LP Lock for supported liquidity positions. Select the asset, amount and unlock date, review the terms, then approve the transaction.' },
      { title: 'Track and unlock', body: 'My Locks and My LP Locks show your active positions. Once the exact unlock time has passed, return there to release the assets.' },
      { title: 'Important limits', body: 'A lock cannot be ended early, so verify the token, amount and date before signing. Supported LP positions can continue earning their trading fees while locked.' },
    ],
  },
  drops: {
    title: 'CHEESEDrop',
    introduction: 'Buy NFT drops priced in CHEESE, or publish a drop for your own collection.',
    sections: [
      { title: 'Buy a drop', body: 'Browse official or community drops, open an item to check its price and limits, add the quantity to your cart, then review and approve the purchase. Purchased NFTs arrive in the receiving WAX account.' },
      { title: 'Create a drop', body: 'Choose the NFT template, price, supply, sale dates and listing visibility. Mint-on-demand is recommended because NFTs are created when purchased; make sure the collection has enough RAM for those mints. Pre-minted drops use NFTs prepared in advance.' },
      { title: 'Check before signing', body: 'NFT purchases are final. Review the collection, template, quantity, recipient and full CHEESE total. Creators should also verify supply and dates before accepting the terms.' },
    ],
  },
} satisfies Record<string, { title: string; introduction: string; sections: AboutSection[] }>;