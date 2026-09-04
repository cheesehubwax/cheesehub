// CHEESEAir — collapsible explainer anchored to the right of the page title.
import { useState, type ReactNode } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { OpenMojiIcon } from '@/components/OpenMojiIcon';
import { Button } from '@/components/ui/button';

const sections = [
  {
    title: 'Pick what you are sending',
    body: 'Token mode sends any WAX token you hold: enter the contract and symbol, or tap one of your balances. The precision and supply are read straight from the token contract, so amounts are always formatted the way the chain expects.\n\nNFT mode drops NFTs out of your own inventory. Choose one of your collections, then a template — every selected recipient receives exactly one NFT of that template, assigned lowest asset id first.',
  },
  {
    title: 'Snapshot the holders',
    body: 'Airdrop to holders of any WAX token, to holders of an AtomicAssets collection (optionally narrowed to a schema or a single template), or to liquidity providers of any Alcor pair. Up to 5,000 holders are loaded with their balances.\n\nAlcor LP snapshots scan every fee tier of the chosen pair, keep only open, in-range positions, and weight each provider by the USD value of their position.\n\nYour own account and the usual system accounts are unticked automatically. Every holder is listed with a checkbox, so you can deselect anyone, or use Top 10/50/100, All and None.',
  },
  {
    title: 'Choose the distribution',
    body: 'Equal split shares one total evenly. Fixed each sends the same amount to everyone. Pro-rata weights each recipient by how much they hold.\n\nEqual and pro-rata use largest-remainder rounding, so the sum of the transfers matches the total you typed exactly — no dust left over and no overspend. A minimum-balance filter drops tiny holders before the maths runs.',
  },
  {
    title: 'Batching and signing',
    body: 'Transfers are grouped into batches (default 15 actions per transaction) and each batch is one transaction you sign in your wallet, spaced about a second apart. Every batch is logged with its WAXBlock link as it lands, and you can cancel after the current batch at any time.\n\nNothing is custodial: your keys never leave your wallet and CHEESEAir never holds your tokens.',
  },
  {
    title: 'RAM, CPU and NET in CHEESE',
    body: 'Sending a token to an account that has never held it opens a new balance row, and that row costs the sender RAM. CHEESEAir checks on-chain which recipients already hold the token, so the RAM estimate is real rather than worst-case.\n\nEvery airdrop starts by buying RAM with CHEESE through ram.chz — at least 10 CHEESE, more when the drop needs it. That RAM stays in your account and can be sold back for CHEESE afterwards on CHEESERam. CPU and NET are topped up through cheesepowerz only when your account is short.',
  },
  {
    title: 'Costs and limits',
    body: 'Up to 5,000 holders per snapshot and up to 2,000 NFTs per drop pool. The holder table previews the first 500 rows; every selected account is still included.\n\nAll figures shown are estimates: RAM, CPU and CHEESE prices move between the quote and the transaction, so purchases add a small safety margin. The contracts are always authoritative.',
  },
];

interface AirInfoDropdownProps {
  children: ReactNode;
}

export const AirInfoDropdown = ({ children }: AirInfoDropdownProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="w-full">
      <div className="relative inline-flex items-center justify-center">
        {children}
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="absolute left-[calc(100%+0.5rem)] top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-cheese hover:text-cheese hover:bg-cheese/10 px-2 py-1 h-auto whitespace-nowrap"
          >
            <OpenMojiIcon emoji="ℹ️" size={18} />
            <span className="text-xs font-semibold uppercase tracking-wide hidden sm:inline">Info</span>
          </Button>
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent className="overflow-hidden">
        <div className="mt-6">
          <div className="max-w-3xl mx-auto rounded-xl border border-cheese/20 bg-card/80 backdrop-blur-sm p-6 text-left shadow-[0_0_30px_rgba(234,179,8,0.08)]">
            <h2 className="text-xl font-bold text-cheese mb-1">How CHEESEAir works</h2>
            <p className="text-sm text-muted-foreground mb-6">
              A token and NFT airdrop dashboard for WAX, paid for in CHEESE.
            </p>

            <div className="space-y-6">
              {sections.map((section, idx) => (
                <div key={idx} className="space-y-2">
                  <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-cheese" />
                    {section.title}
                  </h3>
                  {section.body.split('\n\n').map((paragraph, i) => (
                    <p key={i} className="text-sm text-muted-foreground leading-relaxed pl-4">
                      {paragraph}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
