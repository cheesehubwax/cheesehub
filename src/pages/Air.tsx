// CHEESEAir page — token and NFT airdrops on WAX, paid for in $CHEESE.
import { Layout } from '@/components/Layout';
import { ResourceGauges } from '@/components/shared/ResourceGauges';
import { AirdropProvider } from '@/components/air/AirdropContext';
import { AirSendCard } from '@/components/air/AirSendCard';
import { AirSnapshotCard } from '@/components/air/AirSnapshotCard';
import { AirDistributionCard } from '@/components/air/AirDistributionCard';
import { AirHoldersTable } from '@/components/air/AirHoldersTable';
import { AirCostPanel } from '@/components/air/AirCostPanel';
import { AirRunPanel } from '@/components/air/AirRunPanel';
import { AirSellRamCard } from '@/components/air/AirSellRamCard';

import { AirInfoDropdown } from '@/components/air/AirInfoDropdown';
import { OpenMojiIcon } from '@/components/OpenMojiIcon';
import { playRandomFart } from '@/lib/fartSounds';
import cheeseAirOrb from '@/assets/cheeseair.png';

const Air = () => (
  <Layout>
    <AirdropProvider>
      {/* Hero */}
      <section className="relative pt-20 pb-14 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
        <div className="container relative z-10">
          <div className="flex flex-col items-center gap-8">
            <div
              className="h-32 w-32 animate-float cheese-bubble rounded-full flex items-center justify-center cursor-pointer"
              onClick={playRandomFart}
            >
              <img
                src={cheeseAirOrb}
                alt="CHEESEAir"
                width={1024}
                height={1024}
                className="w-24 h-24 object-contain"
              />
            </div>

            <div className="text-center space-y-4">
              <AirInfoDropdown>
                <div className="flex items-center justify-center gap-2">
                  <OpenMojiIcon emoji="🪂" size={26} />
                  <h1 className="text-3xl md:text-4xl font-bold">
                    <span className="text-cheese">CHEESE</span>
                    <span className="text-foreground">Air</span>
                  </h1>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cheese/20 text-cheese border border-cheese/30 leading-none">
                    BETA
                  </span>
                  <OpenMojiIcon emoji="🪂" size={26} />
                </div>
              </AirInfoDropdown>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Airdrop any WAX token, NFT or RAM to token and NFT holders. Snapshot the holders,
                split the drop, and pay for the RAM, CPU and NET with $CHEESE

              </p>
            </div>
          </div>
        </div>
      </section>

      <main className="container pb-12 flex flex-col items-center gap-6">
        <ResourceGauges />

        <div className="w-full flex flex-col items-center gap-6">
          <div className="w-full max-w-lg">
            <AirSendCard />
          </div>
          <div className="w-full max-w-lg">
            <AirSnapshotCard />
          </div>
          <div className="w-full max-w-lg">
            <AirDistributionCard />
          </div>
          <div className="w-full max-w-xl">
            <AirCostPanel />
          </div>
          <div className="w-full max-w-xl">
            <AirHoldersTable />
          </div>
          <div className="w-full max-w-lg">
            <AirRunPanel />
          </div>
          <div className="w-full max-w-lg">
            <AirSellRamCard />
          </div>

        </div>




        <div className="text-center text-sm text-muted-foreground max-w-2xl">
          <p>
            Non-custodial: every transfer is signed in your own wallet. Resource purchases use the{' '}
            <a
              href="https://waxblock.io/account/ram.chz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cheese hover:underline"
            >
              ram.chz
            </a>{' '}
            and{' '}
            <a
              href="https://waxblock.io/account/cheesepowerz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cheese hover:underline"
            >
              cheesepowerz
            </a>{' '}
            smart contracts.
          </p>
        </div>
      </main>
    </AirdropProvider>
  </Layout>
);

export default Air;
