import { Layout } from "@/components/Layout";

export default function Terms() {
  return (
    <Layout>
      <div className="container max-w-3xl py-12 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-cheese mb-2">Terms of Use</h1>
          <p className="text-sm text-muted-foreground">Last updated: March 2025</p>
        </div>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-cheese">1. Acceptance of Terms</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            By accessing or using CHEESEHub, you agree to be bound by these Terms of Use. If you do not agree with any part of these terms, you must not access or use the platform. Your continued use of CHEESEHub constitutes your acceptance of these terms as they may be updated from time to time.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-cheese">2. Platform Description</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            CHEESEHub is a community-built frontend interface that provides access to decentralised applications and smart contracts deployed on the WAX blockchain. CHEESEHub is not a custodial service, does not hold or control user funds, and does not have the ability to execute, reverse, or modify any blockchain transaction on behalf of any user. All interactions with smart contracts are initiated and signed directly by the user through their own blockchain wallet.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-cheese">3. No Financial Product or Financial Advice</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The CHEESE token and any other digital asset accessible through CHEESEHub are not intended to be financial products within the meaning of the <em>Corporations Act 2001</em> (Cth) or the equivalent legislation of any other jurisdiction. Without limitation, CHEESE is not a security, a managed investment scheme, a derivative, or a non-cash payment facility.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Nothing on CHEESEHub constitutes financial product advice — whether general or personal. No content, feature, data display, or interface element on this platform should be interpreted as a recommendation, endorsement, or solicitation to buy, sell, hold, stake, farm, lock, or otherwise deal in any digital asset. You should seek independent professional financial, legal, and tax advice before making any decisions relating to digital assets.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            No representations or warranties are made regarding the future price, value, utility, or returns of CHEESE or any other digital asset displayed on or accessible through CHEESEHub. Past performance is not indicative of future results.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-cheese">4. Immutable Token Contract</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The CHEESE token is issued by the <code className="text-foreground bg-muted px-1 rounded">cheeseburger</code> smart contract on the WAX blockchain, whose owner and active keys have been permanently nulled to <code className="text-foreground bg-muted px-1 rounded">eosio.null</code>. This renders the contract immutable — it cannot be modified, upgraded, paused, or controlled by any party. No new tokens can be minted beyond the fixed maximum supply, and no tokens can be frozen or seized. You acknowledge that immutability means any bugs or unintended behaviour in the contract cannot be patched, and you accept this risk by using the platform.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-cheese">5. Self-Directed Activity & No Custody</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            CHEESEHub never takes custody of user funds, tokens, NFTs, or private keys. All transactions — including staking, farming, liquidity provision, token locking, and NFT drops — are direct, self-directed on-chain interactions between you and independently deployed smart contracts on the WAX blockchain.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            CHEESEHub does not pool funds, manage assets, or operate staking or farming on behalf of users. This is not managed staking, a staking-as-a-service arrangement, or any form of managed investment. You retain full control of your assets at all times through your own blockchain wallet and are solely responsible for all decisions relating to your digital assets.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-cheese">6. Open-Source Software & Transparency</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            CHEESEHub is open-source software with its complete source code publicly hosted on GitHub. You acknowledge that: (a) the platform is a community-maintained codebase and not a proprietary commercial product; (b) all smart contracts accessible through CHEESEHub are deployed on the WAX blockchain with publicly available and on-chain auditable source code; (c) open-source availability does not constitute a formal security audit, and no guarantee is made that the code is free from bugs or vulnerabilities; and (d) you are responsible for independently reviewing any code — both frontend and on-chain contracts — before interacting with it. Any individual may fork, modify, or deploy their own instance of the CHEESEHub frontend independently.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-cheese">7. Eligibility</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You must be of legal age in your jurisdiction to use CHEESEHub. By using the platform, you represent and warrant that you meet this requirement. If the use of blockchain-based platforms, cryptocurrency, or digital assets is prohibited or restricted in your jurisdiction, you must not use CHEESEHub. It is your responsibility to ensure that your use of this platform complies with all applicable laws and regulations.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-cheese">8. User Responsibilities</h2>
          <ul className="text-sm text-muted-foreground leading-relaxed list-disc list-inside space-y-2">
            <li>You are solely responsible for the security of your blockchain wallet, private keys, and account credentials. CHEESEHub does not have access to your keys and cannot recover lost credentials.</li>
            <li>You are solely responsible for all transactions you initiate through the platform. All blockchain transactions are irreversible once confirmed.</li>
            <li>You are obligated to do your own research (DYOR) before interacting with any smart contract, token, NFT, or decentralised application accessible through CHEESEHub.</li>
            <li>You acknowledge that you understand the risks associated with blockchain technology, cryptocurrency, and decentralised finance.</li>
            <li>You acknowledge that CHEESEHub is in all instances solely a frontend portal to smart contracts on the WAX blockchain. Anyone could at any time build their own frontend to interact with these same contracts independently.</li>
            <li>You acknowledge that some smart contracts accessible through CHEESEHub — notably the WaxDAO and NFTHive contracts — are built, owned, and controlled by other individuals or entities. In the case of any issues relating to these smart contracts, you should contact the owner/s of WaxDAO or NFTHive directly.</li>
            <li>You understand that features such as staking, farming, token locking, and NFT drops are direct on-chain interactions between you and independently deployed smart contracts on the WAX blockchain. CHEESEHub does not intermediate, execute, settle, or arrange these transactions on your behalf.</li>
            <li>You are responsible for determining whether your use of any feature on this platform constitutes a regulated activity in your jurisdiction, and for complying with all applicable laws and regulations accordingly.</li>
            <li>You acknowledge that CHEESEHub does not hold a financial services licence in any jurisdiction and does not provide financial product advice, deal in financial products, or operate as a financial services provider.</li>
            <li>You acknowledge that token burning or supply-reduction mechanisms (such as CHEESENull) do not constitute, imply, or guarantee an increase in price, value, or financial return. You accept that participation in such features is voluntary and carries no expectation of profit.</li>
            <li>You acknowledge that certain platform actions involve deterministic on-chain fee routing via smart contracts (such as <code className="text-foreground bg-muted px-1 rounded">cheesefeefee</code>), which may automatically convert tokens as part of a single atomic transaction. These conversions are executed by fixed contract logic and do not constitute dealing or financial intermediation.</li>
            <li>You acknowledge that the CHEESESwap feature is solely a frontend interface to Alcor Exchange's smart contracts. CHEESEHub does not custody funds, execute swaps, or act as a counterparty. All swaps are direct on-chain interactions between you and the <code className="text-foreground bg-muted px-1 rounded">swap.alcor</code> contract. You are responsible for reviewing swap details — including output amounts, price impact, and slippage — before signing any transaction.</li>
            <li>You acknowledge that if you use CHEESEAds to rent banner ad slots, you are solely responsible for the content of your advertisements. You agree not to submit content that is racist, discriminatory, hateful, pornographic, sexually explicit, violent, defamatory, fraudulent, or otherwise illegal. CHEESEHub moderators may remove any ad from the frontend display at their sole discretion if it is deemed to violate these guidelines. Removal from the frontend does not affect on-chain slot data. If you wish to appeal a moderation decision, you may do so by joining the official CHEESE Telegram group at <a href="https://t.me/cheeseonwaxofficial" target="_blank" rel="noopener noreferrer" className="text-cheese underline hover:text-cheese/80">t.me/cheeseonwaxofficial</a> and contacting the moderation team.</li>
            <li>You acknowledge that banner advertisements displayed on CHEESEHub may contain referral or affiliate links. CHEESEHub does not endorse, recommend, or receive commission from any product, service, or platform advertised through CHEESEAds. You should exercise particular caution with advertisements promoting speculative trading or "play-to-earn" platforms, and you accept full responsibility for any interaction with advertised third-party services.</li>
            <li>You acknowledge that nothing on CHEESEHub constitutes financial product advice and that you should seek independent professional advice before making financial decisions.</li>
            <li>You acknowledge that all staking, farming, and liquidity provision conducted through CHEESEHub is entirely self-directed and that CHEESEHub does not pool, manage, or control any user funds.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-cheese">9. Intellectual Property</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The CHEESE branding and logo are not trademarked and are not owned by any individual, entity, or organisation — anyone may freely use or display them. The site content is open-source software published on GitHub and freely accessible to everyone. Third-party content displayed on the platform — including but not limited to NFTs, collection logos, token symbols, and external media — belongs to their respective owners. CHEESEHub does not claim ownership of any user-generated or third-party content displayed through the interface.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-cheese">10. Prohibited Use</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You agree not to use CHEESEHub for any unlawful purpose or in any way that could damage, disable, or impair the platform. Prohibited activities include, but are not limited to:
          </p>
          <ul className="text-sm text-muted-foreground leading-relaxed list-disc list-inside space-y-2">
            <li>Engaging in any illegal activity, including money laundering, fraud, or financing of terrorism.</li>
            <li>Maliciously exploiting smart contracts, vulnerabilities, or bugs for personal gain or to cause harm to others.</li>
            <li>Attempting to disrupt, interfere with, or compromise the security or integrity of the platform or its underlying infrastructure.</li>
            <li>Using automated systems, bots, or scripts to interact with the platform in a manner that could degrade performance or availability for other users.</li>
            <li>Submitting banner advertisements through CHEESEAds that contain racist, discriminatory, hateful, pornographic, sexually explicit, violent, defamatory, fraudulent, or otherwise illegal content.</li>
            <li>Submitting banner advertisements through CHEESEAds that promote or link to gambling services, crypto casinos, betting platforms, lotteries, or any other form of wagering — whether real-money or cryptocurrency-based.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-cheese">11. Third-Party Services</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            CHEESEHub may contain links to or integrations with third-party services, including but not limited to Alcor Exchange, AtomicHub, WaxDAO, NFTHive, and blockchain wallet providers. These third-party services are not operated or controlled by CHEESEHub. We are not responsible for the content, privacy policies, terms of service, availability, or practices of any third-party platforms. Your use of third-party services is at your own risk and subject to their respective terms. Any liquidity provision conducted via third-party decentralised exchanges such as Alcor Exchange is entirely self-directed and carries inherent risks including impermanent loss. No APR, APY, or return of any kind is promised or guaranteed by CHEESEHub. The CHEESESwap widget embedded within CHEESEHub is a convenience interface to Alcor Exchange's swap routing and does not constitute the operation of an exchange, dealing service, or trading platform by CHEESEHub.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-cheese">12. Merchandise & Consumer Protection</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Purchases of CHEESE NFTs and merchandise made through CHEESEDrop are covered by applicable consumer protection laws, including the Australian Consumer Law (Schedule 2 of the <em>Competition and Consumer Act 2010</em> (Cth)) where applicable. All goods purchased through the portal may be returned undamaged for a full refund at any time. You acknowledge that such purchases constitute consumer transactions and do not represent a financial investment, security, or speculative instrument.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-cheese">13. Risk Warnings</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You acknowledge and accept the following risks associated with using CHEESEHub and interacting with digital assets:
          </p>
          <ul className="text-sm text-muted-foreground leading-relaxed list-disc list-inside space-y-2">
            <li><strong className="text-foreground">Volatility risk:</strong> Digital assets, including CHEESE, are highly volatile and may lose all or substantially all of their value. You should only interact with digital assets if you can afford a total loss.</li>
            <li><strong className="text-foreground">Smart contract risk:</strong> Smart contracts may contain bugs, vulnerabilities, or unintended behaviour that could result in the permanent loss of funds. Open-source availability does not eliminate this risk.</li>
            <li><strong className="text-foreground">Liquidity risk:</strong> Tokens may become illiquid or untradeable at any time. There is no guarantee that a market will exist for any digital asset.</li>
            <li><strong className="text-foreground">Impermanent loss:</strong> Providing liquidity to decentralised exchange pools carries the risk of impermanent loss, where the value of deposited assets may decrease relative to simply holding them.</li>
            <li><strong className="text-foreground">Regulatory risk:</strong> Laws and regulations governing digital assets are evolving and may change in ways that adversely affect the legality, utility, or value of digital assets in your jurisdiction.</li>
            <li><strong className="text-foreground">Counterparty risk:</strong> Third-party platforms, wallets, and services integrated with or accessible through CHEESEHub may fail, be compromised, or cease operations without notice.</li>
            <li><strong className="text-foreground">No guaranteed returns:</strong> No return, profit, yield, or financial benefit of any kind is promised, guaranteed, or implied by CHEESEHub or any feature accessible through the platform.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-cheese">14. Tax & Regulatory Compliance</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You are solely responsible for determining and fulfilling any tax obligations arising from your use of CHEESEHub and your interactions with digital assets, including but not limited to capital gains tax, income tax, and goods and services tax. CHEESEHub does not provide tax advice, tax reporting, or any form of tax documentation.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You are responsible for compliance with all applicable anti-money laundering (AML) and counter-terrorism financing (CTF) laws in your jurisdiction. CHEESEHub does not perform know-your-customer (KYC) or AML checks, as it is a non-custodial, non-intermediary frontend that does not hold, transfer, or control user funds.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-cheese">15. No Warranties</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            CHEESEHub is provided on an "as is" and "as available" basis without warranties of any kind, whether express or implied. No guarantee is made regarding the uptime, accuracy, completeness, reliability, or availability of the platform or any content displayed on it. CHEESEHub may be modified, updated, interrupted, suspended, or discontinued at any time without notice or liability.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-cheese">16. Limitation of Liability</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            To the fullest extent permitted by applicable law, the owner of this website, the CHEESE DAO, its contributors, members, developers, and any individuals or entities associated with the development or maintenance of CHEESEHub accept no liability for any direct, indirect, incidental, consequential, or punitive damages arising from your use of, or inability to use, the platform. This includes, but is not limited to, loss of funds, loss of profits, loss of data, or any other losses howsoever arising.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-cheese">17. Modifications to Terms</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            These Terms of Use may be updated or modified at any time without prior notice. Changes will be effective immediately upon being published on this page. It is your responsibility to review these terms periodically. Your continued use of CHEESEHub after any modifications constitutes your acceptance of the updated terms.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-cheese">18. Governing Law</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            These Terms of Use shall be governed by and construed in accordance with the applicable laws of the jurisdiction in which any dispute arises. Given the decentralised and global nature of the CHEESE DAO and the WAX blockchain, no specific jurisdiction is designated. Users are responsible for understanding and complying with the laws applicable to them in their own jurisdiction.
          </p>
        </section>
      </div>
    </Layout>
  );
}
