# Add CHEESERam disclosures to Terms of Use and Disclaimer

## Goal
Add CHEESERam-specific legal disclosures to the existing Terms of Use and Disclaimer pages, using the project's existing jurisdiction-neutral, non-custodial style while incorporating ASIC INFO 225 principles (clear statements that CHEESERam is not a financial product, no AFSL/licence, no consumer protections if unregulated, and that Australian laws may apply to offers made to Australian users).

## Current state
- `src/components/shared/TermsContent.tsx` is a shared component used by both `/terms` and the `TermsDialog` modal. It currently does not mention CHEESERam.
- `src/pages/Disclaimer.tsx` has a "Platform Features & dApps" section (7.1–7.10) that describes each dApp. CHEESERam is absent.
- CHEESERam mechanics (from `src/lib/cheeseRam.ts` and prior implementation):
  - Contract: `ram.chz`
  - Users send CHEESE to buy WAX RAM; users can sell RAM back for CHEESE.
  - CHEESE received is partially or wholly nulled to `eosio.null`.
  - Contract holds WAX reserves (staked and liquid); WAX is used to purchase RAM on-chain.
  - Quotes use a live Alcor market rate subject to a contract reference-rate deviation guard, plus buy/sell spreads and a sell haircut.
  - No custody by CHEESEHub; all transactions are user-signed and executed on-chain.

## Proposed changes

### 1. Disclaimer — add CHEESERam subsection (7.11)
Insert after Section 7.10 (CHEESESwap) in `src/pages/Disclaimer.tsx`:

```text
7.11 CHEESERam

CHEESERam is powered by the ram.chz smart contract on the WAX blockchain. It provides a non-custodial interface that allows users to send CHEESE in exchange for WAX RAM, and to sell WAX RAM back to the contract in exchange for CHEESE. CHEESEHub does not hold, pool, or control any WAX, CHEESE, or RAM at any time; all transactions are constructed in the user's browser and signed by the user's own wallet provider.

CHEESE received by the ram.chz contract is routed according to fixed, immutable on-chain logic. A portion is permanently nulled to eosio.null, and other portions may be directed to ecosystem functions such as xCHEESE liquidity provision, CHEESEPowerz, CHEESEBurner, or buyback mechanisms. WAX received from RAM sales is held by the contract as reserves and may be staked to generate vote rewards or kept liquid to fund future RAM purchases. These allocations are determined entirely by the contract and cannot be altered by CHEESEHub or any individual.

Price quotes displayed in CHEESERam are estimates only. The contract uses a stored reference rate and a maximum deviation guard against live Alcor market rates, together with buy spreads, sell spreads, and a sell haircut. The actual rate applied on-chain may differ from the quoted rate due to market movement, pool depth changes, or the deviation guard selecting the reference rate. CHEESEHub does not set, guarantee, or control the price.

CHEESERam is not a financial product, investment scheme, derivative, non-cash payment facility, or financial service. It is a utility function for acquiring and disposing of blockchain network resources (RAM). No return, profit, yield, or price appreciation is promised or implied. RAM is a consumable network resource and not an asset with guaranteed value or liquidity.

If you access CHEESEHub from Australia, Australian laws (including the Corporations Act 2001 and the ASIC Act) may apply to the offering of products or services to you. CHEESEHub does not hold an Australian financial services licence and does not provide financial product advice. You should consider whether CHEESERam could be a financial product or financial service in your jurisdiction and seek independent legal advice.
```

### 2. Terms of Use — add CHEESERam bullets to Section 8 (User Responsibilities)
Add to the bullet list in `src/components/shared/TermsContent.tsx` Section 8:

```text
- You acknowledge that CHEESERam is a utility for acquiring and disposing of WAX blockchain RAM using CHEESE. It is not a financial product, investment, or managed service, and CHEESEHub does not hold or control any RAM, WAX, or CHEESE on your behalf.
- You acknowledge that CHEESE sent to the ram.chz contract may be permanently nulled or routed to other ecosystem functions by fixed contract logic, and that this does not constitute, imply, or guarantee an increase in the price or value of CHEESE.
- You acknowledge that CHEESERam price quotes are estimates based on live market data and a contract reference rate, and that the actual on-chain execution rate may differ due to spreads, deviation guards, slippage, or market movement.
- You acknowledge that RAM is a network resource, not a financial asset, and that its utility or value may change as network conditions change.
```

### 3. Terms of Use — add CHEESERam risk to Section 13 (Risk Warnings)
Add one bullet to the risk list:

```text
- Resource-conversion risk: CHEESERam involves converting CHEESE into WAX RAM and vice versa. RAM is a consumable blockchain resource with no guaranteed resale value or liquidity. Quote rates may differ from execution rates, and you may receive less RAM or less CHEESE than estimated.
```

### 4. Update effective date
Update the "Last updated" text in:
- `src/pages/Terms.tsx`
- `src/components/shared/TermsDialog.tsx`
- `src/pages/Disclaimer.tsx`

to the current date at build time (August 2026).

## Out of scope
- No changes to CHEESERam smart contract code or frontend functionality.
- No changes to other dApp disclosures unless required for consistency.
- No jurisdiction-specific legal advice; the drafted language is a disclosure template and should be reviewed by a qualified legal professional before reliance.

## Verification
- Build the project and confirm no TypeScript/JSX errors in edited files.
- Visually review `/terms` and `/disclaimer` to ensure new CHEESERam content renders correctly and list numbering remains consistent.
