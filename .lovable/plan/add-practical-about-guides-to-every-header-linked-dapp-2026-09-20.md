# Add practical About guides to every header-linked dapp

## Goal
Give each dapp in the main header a consistent, title-adjacent **About** link that explains what users can do, how to use it, why it is useful, and the important limits or safety points. Keep contract mechanics out unless a detail directly affects a user’s decision.

## Dapps covered
- CHEESEUp
- CHEESENull
- CHEESEFarm
- CHEESEDao
- CHEESEAir
- CHEESERam
- CHEESEDrip
- CHEESELock
- CHEESEDrop

CHEESEHub Home is excluded because it is the hub rather than a dapp. CHEESEAnal and CHEESEAds are also excluded because they are not in the current header navigation.

## User-facing changes
1. Add the same compact **About** trigger beside each dapp title, matching the existing CHEESEAir/CHEESERam placement and mobile behavior.
2. Open an inline expandable guide below the title so users stay on the same page.
3. Give every guide a short introduction followed by scannable sections covering:
   - what the dapp is useful for;
   - the normal step-by-step workflow;
   - the main benefits;
   - relevant choices, limits, fees, signing expectations, and irreversible actions.
4. Tailor the content to each current experience:
   - **CHEESEUp:** choose CHEESE amount, CPU/NET split and recipient; 24-hour resources and permanently nulled CHEESE.
   - **CHEESENull:** when the public null action is available, what one click does, ecosystem benefits, cooldown, and irreversible nulling.
   - **CHEESEFarm:** browse, stake eligible NFTs, claim rewards, unstake, and create/manage farms.
   - **CHEESEDao:** browse or join DAOs, stake eligible assets, vote, make proposals, and use transparent treasuries.
   - **CHEESEAir:** token, NFT **and RAM** airdrops; snapshots, recipient selection, distribution choices, review, batching, exports, resource estimates, and safety limits. RAM guidance will explain choosing RAM, entering CHEESE or KB, sending RAM directly to recipients, automatic handling of per-recipient limits, and the liquid-pool warning/autofill.
   - **CHEESERam:** rewrite the current contract-heavy copy around buying RAM, selling spare RAM, reading quotes/reserves, practical benefits, spreads, limits, and transaction review.
   - **CHEESEDrip:** choose recipient/token/payment schedule, fund in two signatures, recipient claims, sender management, and payroll/vesting benefits.
   - **CHEESELock:** token and LP locks, selecting amounts/unlock dates, claiming after unlock, LP fee earning, and the irreversible lock period.
   - **CHEESEDrop:** browse and buy drops, cart/claim flow, create/manage drops, mint-on-demand RAM needs, visibility choices, and purchase review.
5. Rename the existing CHEESEAir and CHEESERam title triggers from **Info** to **About** for consistency.

## Technical approach
- Create one reusable About dropdown component for the shared trigger, expandable panel, typography, and responsive layout.
- Keep each dapp’s copy in a small dapp-specific About component or configuration so content stays readable and independently maintainable.
- Replace the duplicated CHEESEAir/CHEESERam presentation shell with the shared component while preserving their title placement and styling.
- Wrap each remaining dapp title row with its About guide without changing its forms, transactions, data fetching, or contract logic.
- Use the existing design tokens, Button component, collapsible behavior, icons, and keyboard-accessible controls.

## Verification
- Confirm all nine header destinations display an **About** trigger and open the correct guide.
- Check desktop and mobile layouts for title wrapping, panel width, and readable spacing.
- Verify CHEESEAir explicitly documents RAM airdrops and CHEESERam no longer leads with contract internals.
- Run the existing type checks/tests and confirm the preview builds without errors.
