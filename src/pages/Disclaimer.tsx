import { Layout } from "@/components/Layout";

export default function Disclaimer() {
  return (
    <Layout>
      <div className="container max-w-3xl py-12 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-cheese mb-2">Clause</h1>
          <p className="text-sm text-muted-foreground">Last updated: March 2025</p>
        </div>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-cheese">1. General Clause</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            CHEESEHub is a community-built interface that provides access to decentralised applications and smart contracts on the WAX blockchain. The information presented on this platform is for general informational purposes only and does not constitute financial, legal, tax, or investment advice. No representation or warranty, express or implied, is made regarding the accuracy, completeness, or reliability of any content on this platform. Use of CHEESEHub is entirely at your own risk.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-cheese">2. Nature of CHEESE</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            CHEESE is a memecoin — a cryptocurrency token created primarily for entertainment and community engagement. It has no intrinsic value, is not backed by any asset or reserve, and carries no promise of return. CHEESE is governed by a decentralised autonomous organisation (DAO) with members located in countries around the world. Any member of the DAO may, propose, vote on and even execute proposals should they pass. CHEESE is not intended to be, and should not be treated as, a security, managed investment scheme, derivative, non-cash payment facility, investment contract, or regulated instrument under the laws of any jurisdiction.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            CHEESE was not issued through an initial coin offering (ICO), token sale, fundraising event, or any mechanism designed to raise capital for a commercial enterprise. The token does not represent equity, debt, a share of profits, or any contractual right against any person or entity. There is no expectation that the efforts of any individual, team, or issuer will generate returns for token holders — the token contract is immutable and no party has the ability to influence its supply, functionality, or value.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-cheese">3. Immutable Token Contract</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The CHEESE token is issued by the <code className="text-foreground bg-muted px-1 rounded">cheeseburger</code> smart contract on the WAX blockchain. The owner and active keys of this contract have been permanently nulled to <code className="text-foreground bg-muted px-1 rounded">eosio.null</code>, rendering the contract immutable. This means no individual, group, or entity — including the CHEESE DAO — has the ability to modify, upgrade, pause, or otherwise alter the contract's code or behaviour. No new tokens can be minted beyond the fixed maximum supply, and no tokens can be frozen, seized, or blacklisted. While immutability provides transparency and resistance to tampering, it also means that any bugs, vulnerabilities, or unintended behaviour in the contract cannot be patched or corrected.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-cheese">4. Open-Source Software & Public Hosting</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            CHEESEHub is open-source software hosted publicly on GitHub. The entire source code of this frontend interface is freely available for inspection, review, and audit by any member of the public. CHEESEHub does not operate as a proprietary platform or commercial service — it is a community-maintained codebase that serves as an interface to independently deployed smart contracts on the WAX blockchain.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            All smart contracts accessible through CHEESEHub — including but not limited to <code className="text-foreground bg-muted px-1 rounded">cheeseburger</code>, <code className="text-foreground bg-muted px-1 rounded">cheesefeefee</code>, <code className="text-foreground bg-muted px-1 rounded">cheesebannad</code>, and <code className="text-foreground bg-muted px-1 rounded">cheeseamphub</code> — are deployed on the WAX blockchain and their source code is publicly available and auditable on-chain. Smart contracts on the WAX blockchain are inherently transparent; any user can independently verify the logic, permissions, and behaviour of any contract before interacting with it.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            While open-source transparency allows for public scrutiny and community-driven security review, it does not constitute a formal security audit. Open-source software is provided without warranty, and no guarantee is made that the code is free from bugs, vulnerabilities, or exploits. Users interact with all smart contracts and this interface entirely at their own risk, and are encouraged to conduct their own independent review of both the frontend code and any on-chain contracts before use.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            CHEESEHub is hosted and served directly via GitHub Pages, a static site hosting service provided by GitHub, Inc. The platform does not operate its own web servers, backend infrastructure, or databases. All content is delivered as static files from GitHub's infrastructure. This means there is no server-side processing, no user data collection or storage by CHEESEHub, and no proprietary hosting arrangement. GitHub Pages is subject to GitHub's own Terms of Service and acceptable use policies. CHEESEHub has no control over GitHub's infrastructure, uptime, availability, or content delivery — any interruption, suspension, or modification of service by GitHub is beyond the control of the CHEESEHub community.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-cheese">5. Financial Services</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            CHEESEHub does not hold a financial services licence, authorisation, or registration in any jurisdiction. The platform is not regulated or supervised by any financial regulator, securities commission, or government authority. CHEESEHub does not provide financial product advice, deal in financial products, or operate as a financial services provider. Any interaction with tokens, smart contracts, or blockchain protocols through this platform is conducted on a peer-to-peer, permissionless basis. At no time does CHEESEHub have custody of your assets nor your private keys. CHEESEWallet is merely an interface for your ACTUAL wallet (Anchor Greymass or WAX Cloud Wallet). All performable actions are actionable directly from these interfaces.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            All swap functionality offered through CHEESEHub (including the embedded CHEESESwap interface) is strictly non-custodial. Swap routes are constructed in the user's browser and executed directly against third-party automated market maker contracts (Alcor Exchange's <code className="text-foreground bg-muted px-1 rounded">swap.alcor</code>) on the WAX blockchain. CHEESEHub never holds, pools, custodies, transmits, or controls user funds at any point during a swap, does not act as a counterparty, and does not operate a fiat on-ramp or off-ramp. CHEESEHub is not a digital currency exchange provider, money transfer service, or financial market operator.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            CHEESEHub does not perform Know Your Customer (KYC), Anti-Money Laundering (AML), or Counter-Terrorism Financing (CTF) checks. As a non-custodial, non-intermediary frontend interface, CHEESEHub does not hold, transmit, pool, or exercise control over user funds at any time. Users are solely responsible for ensuring their own compliance with applicable AML/CTF and identity verification requirements in their jurisdiction.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Reward token deposits to third-party <code className="text-foreground bg-muted px-1 rounded">farms.waxdao</code> NFT staking contracts are permissionless and non-refundable to the depositor; deposited tokens are distributed to stakers by the contract and can only be withdrawn by the original farm creator. CHEESEHub does not custody, control, or have access to deposited rewards at any time.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-cheese">6. No Dealing, Advising or Market Making</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            CHEESEHub does not deal in digital assets, arrange for any person to deal in digital assets, make a market for digital assets, operate a financial market or exchange, or provide financial product advice of any kind. The platform is a passive, read-only interface that displays publicly available blockchain data and allows users to construct and sign their own transactions through their own wallets.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Features such as staking, farming, token locking, and NFT drops are direct interactions between the user and independently deployed smart contracts on the WAX blockchain. CHEESEHub does not intermediate, execute, settle, or arrange these transactions. The user initiates and signs every action through their own wallet provider — CHEESEHub merely renders the interface. Any price information displayed on the platform is sourced from publicly available on-chain data and third-party decentralised exchanges (such as Alcor Exchange) for informational purposes only. Price displays do not constitute a recommendation, forecast, or representation about the future value or performance of any digital asset.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Certain platform operations — such as creating a DAO, opening a farm, or other fee-based actions — utilise a deterministic smart contract (<code className="text-foreground bg-muted px-1 rounded">cheesefeefee</code>) to perform atomic on-chain token conversions within a single user-signed transaction. For example, a user may pay a fee in CHEESE, and the contract automatically converts the necessary portion to the required token (e.g., WAXDAO) to complete the action. This conversion is executed by fixed, immutable contract logic — the contract does not exercise discretion, negotiate prices, select counterparties, or hold funds between transactions. If any step in the atomic transaction fails, the entire transaction reverts and the user retains their tokens. This automated fee routing is a deterministic utility function and does not constitute dealing, intermediation, market making, or the arrangement of deals in digital assets.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-cheese">7. Platform Features & dApps</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            CHEESEHub provides a unified interface to a variety of decentralised applications (dApps) deployed on the WAX blockchain. Each feature interacts with one or more independently deployed smart contracts. CHEESEHub does not own, operate, or control these contracts — it merely renders a user-friendly interface for constructing and signing transactions. The following subsections describe each feature and its relevant disclosures.
          </p>

          <div className="space-y-4 pl-4">
            <div>
              <h3 className="text-base font-semibold text-cheese">7.1 CHEESENull</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                CHEESENull is a community-driven, voluntary function powered by the <code className="text-foreground bg-muted px-1 rounded">cheeseburner</code> smart contract. It claims accrued WAX vote rewards and distributes them across multiple ecosystem purposes via fixed, immutable contract logic. Not all value is used to purchase and burn CHEESE — a portion is restaked to sustain the contract's CPU resources, a portion funds network powerups via CHEESEUp (<code className="text-foreground bg-muted px-1 rounded">cheesepowerz</code>), and the remainder is swapped for CHEESE, of which a majority is permanently burned and a smaller portion is sent to the xCHEESE liquidity staking pool. This distribution is determined entirely by on-chain logic and cannot be altered by any party. The nulling of CHEESE should not, under any circumstances, be perceived or assumed to add value to the token. A reduction in circulating supply does not constitute, imply, or guarantee an increase in price, value, or financial return. CHEESENull is a community engagement and ecosystem infrastructure function — it is not a value-accrual mechanism, investment strategy, or managed fund.
              </p>
            </div>

            <div>
              <h3 className="text-base font-semibold text-cheese">7.2 CHEESEUp</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                CHEESEUp is powered by the <code className="text-foreground bg-muted px-1 rounded">cheesepowerz</code> smart contract. Users send CHEESE to receive CPU and NET resources on the WAX blockchain. 100% of the CHEESE sent is permanently burned; the WAX used to fund the powerup comes from the contract's own reserves, which are replenished by other ecosystem functions. CHEESEUp is a utility function and does not constitute a financial service, exchange, or investment product.
              </p>
            </div>

            <div>
              <h3 className="text-base font-semibold text-cheese">7.3 CHEESEAds (Banner Advertising)</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                CHEESEAds is powered by the <code className="text-foreground bg-muted px-1 rounded">cheesebannad</code> smart contract. Users may rent banner advertisement slots on CHEESEHub by paying a fee in WAX. Ad content is user-submitted and displayed via IPFS. Revenue collected by the contract is distributed via fixed, immutable contract logic across ecosystem functions including burning, powerups, and liquidity provision. CHEESEHub does not create, endorse, or control the content of any advertisement displayed through CHEESEAds. CHEESEHub does not guarantee ad visibility, impressions, or any commercial outcome from renting a banner slot.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                <strong className="text-foreground">Content Policy:</strong> CHEESEHub reserves the right to moderate and remove any advertisement from the frontend display that violates the following content guidelines. Prohibited content includes, but is not limited to: racism, hate speech, discrimination, pornography, sexually explicit material, graphic violence, illegal goods or services, scams, phishing, impersonation, gambling services, crypto casinos, betting platforms, lotteries, any other form of wagering (whether fiat or cryptocurrency-based), or any content that violates applicable law. Moderation decisions are made at the sole discretion of CHEESEHub moderators. Removal of an ad from the frontend display does not affect on-chain slot data or the underlying smart contract state.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                <strong className="text-foreground">Appeal Process:</strong> If you believe your advertisement was removed in error, you may appeal the decision by joining the official CHEESE Telegram group at{" "}
                <a href="https://t.me/cheeseonwaxofficial" target="_blank" rel="noopener noreferrer" className="text-cheese underline hover:text-cheese/80">t.me/cheeseonwaxofficial</a>{" "}
                and contacting the moderation team directly. Appeals will be reviewed on a case-by-case basis.
              </p>
            </div>

            <div>
              <h3 className="text-base font-semibold text-cheese">7.4 CHEESEAmp</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                CHEESEAmp is powered by the <code className="text-foreground bg-muted px-1 rounded">cheeseamphub</code> smart contract. It is a music NFT player that tracks play counts and distributes royalties to NFT creators based on on-chain logic. No fee is taken from listeners. CHEESEAmp is a community utility for music NFT holders and creators and does not constitute a streaming service, financial product, or investment mechanism.
              </p>
            </div>

            <div>
              <h3 className="text-base font-semibold text-cheese">7.5 CHEESEFarm</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                CHEESEFarm provides an interface to NFT staking farms powered by the <code className="text-foreground bg-muted px-1 rounded">farms.waxdao</code> smart contract, which is owned and operated by WaxDAO — a third party not affiliated with or controlled by CHEESEHub or the CHEESE DAO. Staking is non-custodial; NFTs remain in the user's wallet at all times. Farm creation fees paid in CHEESE are routed through the <code className="text-foreground bg-muted px-1 rounded">cheesefeefee</code> deterministic fee router. No return, yield, or reward rate is promised or guaranteed.
              </p>
            </div>

            <div>
              <h3 className="text-base font-semibold text-cheese">7.6 CHEESEDao</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                CHEESEDao provides an interface to decentralised autonomous organisation governance powered by the <code className="text-foreground bg-muted px-1 rounded">dao.waxdao</code> smart contract, which is owned and operated by WaxDAO — a third party not affiliated with or controlled by CHEESEHub or the CHEESE DAO. DAO creation fees paid in CHEESE are routed through the <code className="text-foreground bg-muted px-1 rounded">cheesefeefee</code> deterministic fee router. CHEESEHub does not control, moderate, or endorse any proposal, vote, or governance action taken through any DAO created via this interface.
              </p>
            </div>

            <div>
              <h3 className="text-base font-semibold text-cheese">7.7 CHEESEDrop</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                CHEESEDrop provides an interface to NFT drops and CHEESE merchandise powered by the <code className="text-foreground bg-muted px-1 rounded">nfthivedrops</code> smart contract, which is owned and operated by NFTHive — a third party not affiliated with or controlled by CHEESEHub or the CHEESE DAO. Users may purchase CHEESE NFTs and merchandise through this portal. All goods purchased are covered by applicable consumer protection laws in your jurisdiction and may be returned undamaged for a full refund at any time. No CHEESE-specific fee routing applies to purchases. Users interact directly with the NFTHive contract and are responsible for reviewing the terms of each individual drop or listing before purchasing. No CHEESE-specific fee routing applies to purchases. Users interact directly with the NFTHive contract and are responsible for reviewing the terms of each individual drop or listing before purchasing.
              </p>
            </div>

            <div>
              <h3 className="text-base font-semibold text-cheese">7.8 CHEESELock</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                CHEESELock provides an interface to token and liquidity locking via the <code className="text-foreground bg-muted px-1 rounded">waxdaolocker</code> smart contract, which is owned and operated by WaxDAO — a third party not affiliated with or controlled by CHEESEHub or the CHEESE DAO. Locked tokens are held by the smart contract for the duration specified by the user. CHEESEHub does not have custody of locked tokens and cannot unlock, transfer, or modify any lock.
              </p>
            </div>

            <div>
              <h3 className="text-base font-semibold text-cheese">7.9 CHEESEWallet</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                CHEESEWallet is a client-side wallet management interface. It does not have its own smart contract and does not custody, store, or transmit private keys. All transactions are constructed in the browser and signed by the user's own wallet provider (Anchor Greymass or WAX Cloud Wallet). CHEESEWallet is a convenience interface — all actions it provides are also available directly through the user's wallet application.
              </p>
            </div>

            <div>
              <h3 className="text-base font-semibold text-cheese">7.10 CHEESESwap (Alcor Swap Widget)</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                CHEESESwap provides an embedded interface for token swaps powered entirely by Alcor Exchange's smart contracts (including <code className="text-foreground bg-muted px-1 rounded">swap.alcor</code>) deployed on the WAX blockchain. Alcor Exchange is a third-party decentralised exchange not affiliated with, owned by, or controlled by CHEESEHub or the CHEESE DAO. CHEESEHub does not custody, hold, pool, or have access to any user funds at any point during a swap. All swap transactions are constructed in the user's browser, signed by the user's own wallet provider, and executed directly against Alcor's on-chain smart contracts. CHEESEHub does not execute, intermediate, settle, match, or arrange any swap on behalf of any user. Swap routing, price calculations, and minimum received amounts are determined by Alcor's public API and on-chain pool liquidity — CHEESEHub merely displays this information for convenience. Price quotes, price impact estimates, and output amounts shown in the interface are indicative only and may differ from the final on-chain execution due to slippage, pool depth changes, or concurrent transactions. CHEESEHub makes no guarantee regarding swap execution, pricing accuracy, or availability of the Alcor API. Users are solely responsible for reviewing and confirming all transaction details before signing.
              </p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">
            All features listed above are interfaces to independently deployed smart contracts on the WAX blockchain. CHEESEHub does not have custody of user funds at any time. All transactions are user-initiated, user-signed, and executed on-chain. Users interact with all dApps entirely at their own risk and are encouraged to independently verify the logic and permissions of any smart contract before use.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-cheese">8. Liquidity Provision & Farming</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Liquidity provision on Alcor Exchange is a voluntary, self-directed activity. Users interact directly with Alcor's independently deployed smart contracts on the WAX blockchain — not with CHEESEHub. CHEESEHub merely provides an interface to view farming opportunities and construct transactions; it does not pool user funds, manage liquidity positions, or exercise day-to-day control over any user's assets. This is not managed staking, staking-as-a-service, or a managed investment arrangement. CHEESEHub does not pool user funds or exercise any discretion over staking or farming activities.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Users retain full custody and control of their funds at all times. They may join a liquidity pool, claim accrued rewards, or withdraw their funds at any time without restriction, lock-up period, or penalty. No annual percentage rate (APR), annual percentage yield (APY), or any other return is promised, guaranteed, or implied. Reward rates fluctuate based on on-chain conditions including pool depth, trading volume, and the total number of participants.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The allocation of farming rewards is determined by the CHEESE DAO through decentralised community governance. Any member of the DAO may propose changes to reward allocations, and such proposals are decided by community vote — not by any centralised party, management team, or promoter. This governance model reinforces that no single entity directs, controls, or manages the returns available to liquidity providers.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Providing liquidity serves a functional utility purpose: it supports the depth and stability of the CHEESE trading pair on Alcor Exchange, contributing to the overall health and security of the protocol's infrastructure on the WAX blockchain. Users should be aware of the risks associated with liquidity provision, including but not limited to impermanent loss, smart contract risk, and market volatility. Users are solely responsible for conducting their own research and assessing whether liquidity provision is appropriate for their circumstances.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-cheese">9. Tax Obligations</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The tax treatment of cryptocurrency and digital assets varies by jurisdiction. In many countries, crypto assets are treated as property, commodities, or taxable assets, and transactions involving them — including buying, selling, swapping, staking, or receiving rewards — may give rise to capital gains tax, income tax, goods and services tax, or other tax obligations. You are solely responsible for determining your own tax obligations, reporting all relevant transactions to the appropriate tax authority, and maintaining adequate records. CHEESEHub does not provide tax advice. You should consult a qualified tax professional in your jurisdiction before engaging in any cryptocurrency transactions.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-cheese">10. International Users</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            CHEESEHub is accessible globally but makes no representation that its content or services are appropriate or available for use in any particular jurisdiction. Users are responsible for ensuring that their use of CHEESEHub complies with all applicable local, national, and international laws and regulations. If the use of this platform or any associated tokens is prohibited or restricted in your jurisdiction, you must not use them.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-cheese">11. Risk Warnings</h2>
          <ul className="text-sm text-muted-foreground leading-relaxed list-disc list-inside space-y-2">
            <li>Cryptocurrency markets are extremely volatile. The value of CHEESE and other tokens can fluctuate dramatically and may fall to zero.</li>
            <li>Smart contracts may contain bugs, vulnerabilities, or exploits that could result in the partial or total loss of funds. All smart contracts are auditable on chain and you are obligated to do your own research.</li>
            <li>Transactions on the blockchain are irreversible. There is no central authority, bank, or institution that can reverse or refund a transaction.</li>
            <li>There is no deposit protection, insurance, or compensation scheme covering crypto assets on the WAX Blockchain.</li>
            <li>Past performance is not indicative of future results. You should never invest more than you can afford to lose.</li>
            <li>If you are inexperienced with blockchain or decentralised protocols, it is recommended that you proceed with extreme caution and even ask for help in the appropriate channels.</li>
            <li>Regulatory risk — laws and regulations governing digital assets may change in any jurisdiction, potentially affecting the legality, value, or availability of tokens and platform features. Users should monitor the regulatory environment in their jurisdiction and seek independent legal advice where necessary.</li>
            <li>Counterparty and protocol risk — third-party smart contracts and services integrated via CHEESEHub (including but not limited to Alcor Exchange, WaxDAO, and NFTHive) are independently operated and may fail, be exploited, become unavailable, or cease operations without notice. CHEESEHub bears no responsibility for the performance, security, or availability of any third-party protocol.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-cheese">12. Liability</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            To the fullest extent permitted by applicable law, the owner of this website, the CHEESE DAO, its contributors, members, developers, and any individuals or entities associated with the development or maintenance of CHEESEHub accept no liability for any direct, indirect, incidental, consequential, or punitive damages arising from the use of this platform, the CHEESE token, or any associated smart contracts. This includes, but is not limited to, loss of funds, loss of profits, loss of data, or any other losses howsoever arising.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-cheese">13. Not Professional Advice</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Nothing on CHEESEHub constitutes legal, financial, tax, accounting, or investment advice. Before making any decisions related to cryptocurrency, you should seek independent professional advice from a qualified adviser licensed in your jurisdiction. Do not rely solely on information provided by this platform when making financial or tax decisions. Nothing on this platform should be interpreted as a representation about the future value, performance, or suitability of any digital asset.
          </p>
        </section>
      </div>
    </Layout>
  );
}
