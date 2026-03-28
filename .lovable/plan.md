

## Strengthen Terms of Use with ASIC-Relevant Disclaimers

### Context
After reviewing ASIC INFO 225 (Digital assets: Financial products and services) against the current Terms of Use, several gaps and areas for strengthening have been identified. The current Terms are solid but could better address Australian regulatory considerations around digital assets, financial products classification, and consumer protection.

### Gaps Identified

| Area | Current Coverage | Gap |
|------|-----------------|-----|
| Financial product classification | Mentions no financial services licence | No explicit statement that CHEESE is not a financial product (not a security, managed investment scheme, derivative, or non-cash payment facility) |
| Financial advice | Partially covered | No explicit "not financial advice" disclaimer — ASIC is strict on what constitutes advice |
| Tax obligations | Not mentioned | Users are responsible for their own tax reporting — ASIC/ATO expects this |
| AML/KYC | Not mentioned | Should clarify CHEESEHub doesn't perform KYC as a non-custodial frontend |
| Staking/farming risk | Mentions staking is on-chain | Should explicitly state farming/staking is self-directed, not managed staking (ASIC treats managed staking as a potential financial product) |
| Volatility/total loss risk | Brief mention | Should have a stronger general risk warning about potential total loss of digital assets |
| No price guarantees | Covered for burning | Should be broader — no representations about future price or value of any digital asset |
| Liquidity provision risks | Mentions impermanent loss in Third-Party section | Should be more prominent, not buried in third-party section |
| Australian Consumer Law | Merchandise section exists | Could reference ACL explicitly for the merchandise/NFT drop context |
| No custody | Covered implicitly | Should explicitly state CHEESEHub never takes custody of user funds or private keys |

### Proposed New/Updated Sections in `src/pages/Terms.tsx`

**New section: "No Financial Product or Financial Advice"** (insert after section 2)
- CHEESE token is not intended to be a financial product within the meaning of the Corporations Act 2001 (Cth)
- Not a security, managed investment scheme, derivative, or non-cash payment facility
- Nothing on CHEESEHub constitutes financial product advice (general or personal)
- Users should seek independent professional advice before making any financial decisions
- No representations about future price, value, or returns of any digital asset

**New section: "Self-Directed Activity & No Custody"** (insert after current section 3)
- CHEESEHub never takes custody of user funds, tokens, NFTs, or private keys
- All staking, farming, and liquidity provision is self-directed — CHEESEHub does not pool funds, manage assets, or operate staking on behalf of users
- This is not managed staking or a staking-as-a-service arrangement
- Users retain full control of their assets at all times through their own wallet

**New section: "Risk Warnings"** (insert before Limitation of Liability)
- Digital assets are highly volatile and may lose all value
- Past performance is not indicative of future results
- Smart contract risk — bugs, exploits, or unintended behaviour may result in loss
- Liquidity risk — tokens may become illiquid or untradeable
- Impermanent loss risk for liquidity providers
- Regulatory risk — laws may change and affect the legality or value of digital assets
- No guarantee of any return, profit, or financial benefit from any activity on CHEESEHub

**New section: "Tax & Regulatory Compliance"**
- Users are solely responsible for determining and fulfilling their tax obligations relating to digital asset transactions
- CHEESEHub does not provide tax advice or tax reporting
- Users are responsible for compliance with AML/CTF laws in their jurisdiction
- CHEESEHub does not perform KYC/AML checks as it is a non-custodial, non-intermediary frontend

**Update existing section 10 (Merchandise):**
- Add explicit reference to Australian Consumer Law where applicable

**Update existing section 6 (User Responsibilities):**
- Add bullet: "You acknowledge that nothing on CHEESEHub constitutes financial product advice and that you should seek independent professional advice before making financial decisions"
- Add bullet: "You acknowledge that all staking, farming, and liquidity provision conducted through CHEESEHub is entirely self-directed and that CHEESEHub does not pool, manage, or control any user funds"

### Section Renumbering
Adding 4 new sections means all subsequent section numbers shift. The new order would be roughly:
1. Acceptance of Terms
2. Platform Description
3. **No Financial Product or Financial Advice** (new)
4. Immutable Token Contract
5. **Self-Directed Activity & No Custody** (new)
6. Open-Source Software & Transparency
7. Eligibility
8. User Responsibilities (updated)
9. Intellectual Property
10. Prohibited Use
11. Third-Party Services
12. Merchandise & Consumer Protection (updated)
13. **Risk Warnings** (new)
14. **Tax & Regulatory Compliance** (new)
15. No Warranties
16. Limitation of Liability
17. Modifications to Terms
18. Governing Law

### Important Disclaimer
These additions are based on publicly available ASIC guidance and are not legal advice. The project owner should have a qualified Australian lawyer review the final Terms before publishing, especially given ASIC's evolving position on digital assets and the pending legislative changes mentioned in INFO 225.

### Files Changed: 1
- `src/pages/Terms.tsx`

