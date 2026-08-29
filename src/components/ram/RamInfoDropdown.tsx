import { useState, type ReactNode } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { OpenMojiIcon } from '@/components/OpenMojiIcon';
import { Button } from '@/components/ui/button';

const sections = [
  {
    title: 'Buy RAM with CHEESE',
    body: 'Send CHEESE to ram.chz. The contract values your CHEESE in WAX using the live Alcor CHEESE/WAX pool, minus a 0.5% spread, then spends that much WAX from its own liquid WAX reserve on eosio::buyram for the recipient.\n\nYour CHEESE is never sold to fund the RAM. It is split instead: 80% (plus any rounding remainder) goes to eosio.null and is gone forever, and 20% goes to xcheeseliqst for liquid staking.',
  },
  {
    title: 'Sell RAM back for CHEESE',
    body: 'Transfer RAM bytes to ram.chz. The contract sells the RAM for WAX and pays you CHEESE from its own pool at the Alcor rate minus a 0.5% spread. The spread and the buyback keep the pool balanced instead of letting bots grind it.\n\nNone of the WAX is kept as reserve — every sale\'s proceeds are split four ways: 25% self-staked to CPU, 25% to cheesepowerz, 25% to cheeseburner, and 25% used to buy CHEESE on Alcor. That bought-back CHEESE never enters the payout pool: it is burned to eosio.null the moment it arrives.',
  },
  {
    title: 'Top up the payout pool',
    body: 'Anyone can top the payout pool up: send CHEESE to ram.chz with the memo deposit. A deposit funds sells and returns no RAM, so it is a donation to the pool rather than a trade.',
  },
  {
    title: 'Costs and limits',
    body: '0.5% CHEESERam spread per side, plus WAX\'s own 0.5% system fee on sellram and the Alcor pool fee — a full buy-then-sell round trip costs roughly 1.5–2%.\n\nBuys are bounded by the configured min/max CHEESE amount and by a per-trade pool-impact cap; oversized trades are rejected rather than filled at a distorted rate.\n\nSells are bounded by min/max byte size and switch off automatically whenever the CHEESE payout pool falls below its floor.',
  },
  {
    title: 'Why this matters for CHEESE',
    body: 'Burns on both sides: buys null 80% of the CHEESE outright, and sells buy CHEESE back off the market and null that too.\n\nReal utility: CHEESE becomes a direct on-ramp for one of WAX\'s most-used resources — RAM.\n\nFeeds the wider protocol: sell proceeds top up staked CPU, cheesepowerz and cheeseburner instead of sitting idle.\n\nTwo-way market: sellers are paid from a dedicated pool, so the token keeps moving while the burn side stays one-way.\n\nSelf-refilling reserve: every buy also harvests the contract\'s own WAX vote rewards back into the reserve (at most once per 24h), so the RAM float tops itself up.\n\nAnti-arb spreads: a small per-side spread and a pool-impact cap mean arbitrage loops pay the protocol instead of draining the reserve. Genuine users pay a tiny, predictable edge.',
  },
];

interface RamInfoDropdownProps {
  children: ReactNode;
}

export const RamInfoDropdown = ({ children }: RamInfoDropdownProps) => {
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
            <h2 className="text-xl font-bold text-cheese mb-1">How CHEESERam works</h2>
            <p className="text-sm text-muted-foreground mb-6">
              A RAM gateway for the CHEESE token on WAX.
            </p>

            <div className="space-y-6">
              {sections.map((section, idx) => (
                <div key={idx} className="space-y-2">
                  <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-cheese" />
                    {section.title}
                  </h3>
                  {section.body.split('\n\n').map((paragraph, pidx) => (
                    <p key={pidx} className="text-sm text-muted-foreground leading-relaxed pl-3.5">
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
