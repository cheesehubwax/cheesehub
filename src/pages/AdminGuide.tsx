import { Layout } from '@/components/Layout';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FlowDiagram, type FlowStep } from '@/components/admin/FlowDiagram';
import { ShieldCheck, ArrowLeft } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';

/* ── helper badges ── */
function ContractBadge({ name }: { name: string }) {
  return <Badge variant="outline" className="font-mono text-[11px]">{name}</Badge>;
}
function OwnerBadge({ owner }: { owner: string }) {
  const color = owner === 'CHEESE team'
    ? 'bg-cheese/20 text-cheese border-cheese/30'
    : owner === 'WaxDAO'
      ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
      : owner === 'NFTHive'
        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
        : 'bg-muted text-muted-foreground border-border';
  return <Badge className={`${color} text-[11px]`}>{owner}</Badge>;
}

/* ── flow data ── */
const burnerFlow: FlowStep[] = [
  {
    label: 'Vote Rewards (WAX)',
    items: [
      { pct: '20%', dest: 'Re-staked as CPU', highlight: 'stake' },
      { pct: '5%', dest: 'cheesepowerz (CPU/NET for users)', highlight: 'power' },
      { pct: '75%', dest: 'Swapped to CHEESE on Alcor', highlight: 'swap' },
    ],
  },
  {
    label: 'Resulting CHEESE',
    items: [
      { pct: '85%', dest: 'Burned (eosio.null)', highlight: 'burn' },
      { pct: '15%', dest: 'xcheeseliqst (liquidity)', highlight: 'liq' },
    ],
  },
];

const adsFlow: FlowStep[] = [
  {
    label: 'Ad Payment (WAX)',
    items: [
      { pct: '25%', dest: 'cheeseburner', highlight: 'burn' },
      { pct: '25%', dest: 'cheesepowerz', highlight: 'power' },
      { pct: '50%', dest: 'Swapped to CHEESE on Alcor', highlight: 'swap' },
    ],
  },
  {
    label: 'Resulting CHEESE',
    items: [
      { pct: '66%', dest: 'Burned (eosio.null)', highlight: 'burn' },
      { pct: '34%', dest: 'xcheeseliqst (liquidity)', highlight: 'liq' },
    ],
  },
];

const feefeeCheesePath: FlowStep[] = [
  {
    label: 'User pays CHEESE (20% discount)',
    items: [
      { pct: '66%', dest: 'Burned (eosio.null)', highlight: 'burn' },
      { pct: '34%', dest: 'xcheeseliqst (liquidity)', highlight: 'liq' },
    ],
  },
  {
    label: 'User receives',
    items: [
      { pct: '—', dest: 'WAXDAO tokens (inline, two-pool pricing)', highlight: 'neutral' },
    ],
  },
];

const feefeeWaxPath: FlowStep[] = [
  {
    label: 'User pays 265 WAX',
    items: [
      { pct: '215', dest: 'Swapped to WAXDAO for user via Alcor Pool 1236', highlight: 'swap' },
      { pct: '50', dest: 'Sent to cheeseburner', highlight: 'burn' },
    ],
  },
];

const powerupFlow: FlowStep[] = [
  {
    label: 'User sends CHEESE to cheesepowerz contract',
    items: [
      { pct: '100%', dest: 'CHEESE burned (eosio.null)', highlight: 'burn' },
    ],
  },
  {
    label: 'Contract calculates WAX equivalent via Alcor pool rate',
    items: [
      { pct: '—', dest: 'WAX from contract reserves used for eosio powerup action', highlight: 'power' },
    ],
  },
  {
    label: 'WAX reserves funded by',
    items: [
      { pct: '5%', dest: 'cheeseburner (vote reward allocation)', highlight: 'stake' },
      { pct: '25%', dest: 'cheesebannad (ad revenue allocation)', highlight: 'fee' },
      { pct: '—', dest: 'WAX vote rewards (direct staking rewards)', highlight: 'swap' },
    ],
  },
];

const nullWaxFlow: FlowStep[] = [
  {
    label: 'User calls burn() → claims WAX vote rewards',
    items: [
      { pct: '20%', dest: 'Re-staked as CPU (increases vote weight)', highlight: 'stake' },
      { pct: '5%', dest: 'Sent to cheesepowerz account', highlight: 'power' },
      { pct: '75%', dest: 'Swapped to CHEESE on Alcor (pool 1252)', highlight: 'swap' },
    ],
  },
];

const nullCheeseFlow: FlowStep[] = [
  {
    label: 'Resulting CHEESE from swap',
    items: [
      { pct: '85%', dest: 'Burned (eosio.null)', highlight: 'burn' },
      { pct: '15%', dest: 'xcheeseliqst (liquidity)', highlight: 'liq' },
    ],
  },
];

/* ── dApp sections ── */
interface DApp {
  id: string;
  name: string;
  contracts: string[];
  owner: string;
  description: string;
  feeNote?: string;
  flows?: { title: string; steps: FlowStep[] }[];
  pricingNote?: string;
}

const dapps: DApp[] = [
  {
    id: 'null',
    name: 'CHEESENull',
    contracts: ['cheeseburner'],
    owner: 'CHEESE team',
    description: 'Automated CHEESE burn engine powered by the cheeseburner smart contract. Users call the burn() action which claims WAX vote rewards from staked accounts, swaps the majority to CHEESE via Alcor DEX, and burns 85% of the resulting CHEESE. The remaining 15% goes to the xcheeseliqst liquidity pool. A portion of WAX is also re-staked and allocated to the powerup contract. No CHEESE is sent by the user — burns are funded entirely by vote rewards. No caller reward.',
    flows: [
      { title: 'WAX Vote Rewards Split', steps: nullWaxFlow },
      { title: 'Resulting CHEESE Split', steps: nullCheeseFlow },
    ],
  },
  {
    id: 'ads',
    name: 'CHEESEAds',
    contracts: ['cheesebannad'],
    owner: 'CHEESE team',
    description: 'Banner ad rental system for CHEESEHub. Users rent ad slots for a daily WAX fee. Revenue is split between burning, powerups, and liquidity.',
    pricingNote: '100 WAX/day exclusive • 70 WAX/day shared (30% off) • cheesepromoz accounts get 50% discount (stacks with shared)',
    flows: [{ title: 'Fee Flow', steps: adsFlow }],
  },
  {
    id: 'feefee',
    name: 'CHEESEFeeFee',
    contracts: ['cheesefeefee'],
    owner: 'CHEESE team',
    description: 'Fee routing contract used by WaxDAO-powered dApps (Farm, DAO). Users can pay creation fees in CHEESE (at a 20% discount) or in WAX. The contract handles token swaps and distributes proceeds to burning and liquidity.',
    flows: [
      { title: 'CHEESE Payment Path', steps: feefeeCheesePath },
      { title: 'WAX Payment Path', steps: feefeeWaxPath },
    ],
  },
  {
    id: 'powerup',
    name: 'CHEESEUp',
    contracts: ['cheesepowerz'],
    owner: 'CHEESE team',
    description: 'Smart contract that converts CHEESE into CPU/NET resources for WAX users. Users send CHEESE (with configurable min/max limits) to the cheesepowerz contract. The contract burns 100% of the received CHEESE, calculates the WAX equivalent using the live Alcor pool rate, then executes the eosio powerup action from its WAX reserves. Memo format supports custom CPU/NET split and gifting to other accounts. WAX reserves are replenished by cheeseburner (5%) and cheesebannad (25%).',
    feeNote: 'No platform fee on top. User pays in CHEESE which is fully burned. WAX reserves fund the powerup.',
    flows: [{ title: 'PowerUp Flow', steps: powerupFlow }],
  },
  {
    id: 'amp',
    name: 'CHEESEAmp',
    contracts: ['cheeseamphub'],
    owner: 'CHEESE team',
    description: 'Music NFT player with royalty payouts. NFT collections are deposited to the contract. Each play is logged with a 5-minute cooldown per user. Collection creators can claim CHEESE royalties based on play count (configurable CHEESE per play) from the contract\'s CHEESE balance.',
    feeNote: 'Royalties paid from contract balance — no fee taken from listeners.',
  },
  {
    id: 'drip',
    name: 'CHEESEDrip',
    contracts: ['waxdaoescrow'],
    owner: 'WaxDAO',
    description: 'Escrow-based token drip service. Creators deposit tokens and set a schedule; receivers claim payouts over time. Managed entirely by the WaxDAO escrow contract.',
    feeNote: 'No CHEESE-specific fees. Fees (if any) set by WaxDAO.',
  },
  {
    id: 'drops',
    name: 'CHEESEDrops',
    contracts: ['nfthivedrops', 'nft.hive'],
    owner: 'NFTHive',
    description: 'NFT drops marketplace powered by NFTHive. Creators list NFT drops with configurable pricing and quantities. Purchases are handled by the nfthivedrops contract.',
    feeNote: 'Fees set by NFTHive. No CHEESE-specific fee routing.',
  },
  {
    id: 'farm',
    name: 'CHEESEFarm',
    contracts: ['farms.waxdao'],
    owner: 'WaxDAO',
    description: 'NFT staking farms for earning token rewards. Farm creation costs 265 WAX (or CHEESE equivalent via cheesefeefee). Uses WaxDAO\'s non-custodial V2 staking — NFTs stay in the user\'s wallet.',
    feeNote: 'Creation fee: 265 WAX or CHEESE equivalent (routed through cheesefeefee).',
  },
  {
    id: 'dao',
    name: 'CHEESEDao',
    contracts: ['dao.waxdao'],
    owner: 'WaxDAO',
    description: 'DAO creation and governance platform. Create DAOs, submit proposals, vote, and manage treasuries. DAO creation costs 265 WAX (or CHEESE equivalent via cheesefeefee).',
    feeNote: 'Creation fee: 265 WAX or CHEESE equivalent (routed through cheesefeefee).',
  },
  {
    id: 'lock',
    name: 'CHEESELock',
    contracts: ['waxdaolocker'],
    owner: 'WaxDAO',
    description: 'Token and liquidity locking service. Lock fungible tokens or Alcor liquidity positions for a specified duration. Managed by the WaxDAO locker contract.',
    feeNote: 'Fees managed by WaxDAO.',
  },
  {
    id: 'swap',
    name: 'CHEESESwap',
    contracts: ['swap.alcor'],
    owner: 'Alcor',
    description: 'Embedded Alcor DEX swap widget. Allows users to swap between CHEESE, WAX, WAXDAO, and other tokens directly within CHEESEHub.',
    feeNote: 'Swap fees set by Alcor DEX. No additional CHEESE fees.',
  },
  {
    id: 'wallet',
    name: 'CHEESEWallet',
    contracts: [],
    owner: 'CHEESE team',
    description: 'Client-side wallet management suite. Includes token transfers, WAX staking/unstaking, resource management, NFT sending, vote producer, and Alcor farm position management. No smart contract — all transactions are signed client-side.',
    feeNote: 'No platform fees. Standard WAX network fees apply.',
  },
];

export default function AdminGuide() {
  const { isWhitelisted, isLoading: accessLoading, isConnected } = useAdminAccess();

  if (accessLoading) {
    return (
      <Layout>
        <section className="py-12 px-4">
          <div className="max-w-4xl mx-auto space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
            <Skeleton className="h-64 w-full" />
          </div>
        </section>
      </Layout>
    );
  }

  if (!isConnected || !isWhitelisted) {
    return (
      <Layout>
        <section className="py-24 px-4">
          <div className="max-w-md mx-auto text-center space-y-4">
            <ShieldCheck size={48} weight="duotone" className="mx-auto text-muted-foreground" />
            <h1 className="text-xl font-semibold">Not Authorized</h1>
            <p className="text-muted-foreground text-sm">
              {!isConnected ? 'Connect your wallet to access this page.' : 'Your account is not whitelisted for admin access.'}
            </p>
          </div>
        </section>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="py-8 px-4">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
              <ArrowLeft size={14} /> Back to Dashboard
            </Link>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShieldCheck size={28} weight="duotone" className="text-cheese" />
              CHEESE Ecosystem Guide
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Complete documentation of every dApp, its contracts, ownership, and fee flows.
            </p>
          </div>

          {/* Intro */}
          <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground space-y-2">
            <p><strong className="text-foreground">CHEESEHub</strong> is a unified platform for the CHEESE ecosystem on the WAX blockchain. It bundles multiple dApps — some built by the CHEESE team, others powered by WaxDAO, NFTHive, or Alcor — into a single interface.</p>
            <p>This guide explains what each dApp does, which smart contracts power it, who owns those contracts, and how fees flow through the system.</p>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className="rounded bg-red-500/20 text-red-300 px-2 py-0.5">Burn</span>
            <span className="rounded bg-blue-500/20 text-blue-300 px-2 py-0.5">Liquidity</span>
            <span className="rounded bg-yellow-500/20 text-yellow-300 px-2 py-0.5">PowerUp</span>
            <span className="rounded bg-emerald-500/20 text-emerald-300 px-2 py-0.5">Stake</span>
            <span className="rounded bg-purple-500/20 text-purple-300 px-2 py-0.5">Swap</span>
            <span className="rounded bg-amber-500/15 text-amber-300 px-2 py-0.5">Source</span>
          </div>

          {/* Accordion */}
          <Accordion type="multiple" className="space-y-2">
            {dapps.map((dapp) => (
              <AccordionItem key={dapp.id} value={dapp.id} className="rounded-lg border bg-card px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3 text-left">
                    <span className="font-semibold">{dapp.name}</span>
                    <div className="flex gap-1.5 flex-wrap">
                      {dapp.contracts.map(c => <ContractBadge key={c} name={c} />)}
                      <OwnerBadge owner={dapp.owner} />
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">{dapp.description}</p>

                    {dapp.pricingNote && (
                      <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                        <strong>Pricing:</strong> {dapp.pricingNote}
                      </div>
                    )}

                    {dapp.feeNote && !dapp.flows && (
                      <div className="rounded-md border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                        {dapp.feeNote}
                      </div>
                    )}

                    {dapp.flows?.map((flow, fi) => (
                      <div key={fi}>
                        <h4 className="text-xs font-semibold text-foreground mb-2">{flow.title}</h4>
                        <FlowDiagram steps={flow.steps} />
                      </div>
                    ))}

                    {dapp.feeNote && dapp.flows && (
                      <div className="rounded-md border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                        {dapp.feeNote}
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>
    </Layout>
  );
}
