# Marketing Copy Audit — Findings & Plan

## Summary

Good news: a full sweep of pages, components, hero copy, stats banners, tool cards, success dialogs, empty states, and homepage sections found **zero promotional language that implies investment character, price appreciation, yield, or speculative profit**. The codebase is unusually clean on this front — the vocabulary is functional/mechanical throughout (null, stake, claim, deposit), and every place where "investment"/"return"/"yield" appears is inside `Disclaimer.tsx` or `TermsContent.tsx`, used *defensively* to disclaim, not promote.

That means the substance-vs-form argument you were worried about is already in your favour: **the Terms say "not a financial product" and the UI does not contradict that with return-implying marketing.** This is exactly the alignment INFO 225 looks for.

## What the audit flagged (only 3 minor items)

1. **`src/pages/AdminGuide.tsx` line 214** — copy reads *"NFT staking farms for earning token rewards."* Internal admin-only page, not public marketing. Low risk today, but if `/adminguide` is ever made public, "earning… rewards" is INFO 225 §2 language. → **Soften to functional wording.**

2. **`src/components/wallet/AlcorFarmManager.tsx` lines 544–550** — displays a computed **APR** figure for the user's existing Alcor LP position. This is a wallet utility showing live position data (not a promise), but the label "APR" is on ASIC's watch-list of terms. → **Keep the number, retitle the label (e.g. "Current pool yield estimate") and add an inline "estimate only, not a return promise" caption.**

3. **`src/components/farm/DepositRewardsDialog.tsx` line 45** — success toast *"Rewards Deposited! 💰"* refers to the sponsor depositing reward-pool tokens (correct meaning) but is easily misread as a payout to the user. → **Retitle to "Reward pool funded" (or similar) to remove ambiguity.**

## What is explicitly clean (no action)

- `src/pages/Index.tsx` — hero, all 10 CHEESETools cards
- `src/components/home/TokenStatsBanner.tsx`, `CheesePriceBar.tsx`, `QuickLinksSection.tsx`, `CheeseHistorySection.tsx`
- `src/pages/CheeseNull.tsx` + `src/components/cheesenull/*` — no "backed by"/"value support" framing
- `src/pages/Drops.tsx` + `src/components/drops/*` — consumer-purchase framing intact
- `src/pages/Farm.tsx`, `Drip.tsx`, `Dao.tsx` — mechanical descriptions only
- `NullButton.tsx` success toast — describes the action, not a return
- `TransactionSuccessDialog.tsx`, empty states across drops/farms — neutral

## Plan of changes (only if you want them applied)

Three tiny, purely-textual edits — no logic, no layout, no components:

1. `src/pages/AdminGuide.tsx:214` — rewrite line to describe farms functionally (staking mechanics) instead of "earning rewards".
2. `src/components/wallet/AlcorFarmManager.tsx:544–550` — rename the APR label and add a one-line caption clarifying it is a real-time pool-derived estimate, not a promise.
3. `src/components/farm/DepositRewardsDialog.tsx:45` — change toast title from "Rewards Deposited! 💰" to unambiguous sponsor-side wording (e.g. "Reward pool funded").

## Optional follow-ups (not part of this plan)

- Exhaustive verbatim pass through every toast/tooltip in `MyFarms.tsx`, `BrowseFarms.tsx`, `NFTVotePicker.tsx` (audit was targeted, not line-by-line for every dialog).
- Confirm `index.html` meta description contains no investment-implying phrasing.

## Technical notes

- All three edits are single-string changes in JSX. No component structure, no routing, no state, no smart-contract interaction is touched.
- The existing Terms of Use (§13, §16) and Disclaimer already cover the semantic backstop for all three surfaces — these edits just remove the *residual* ambiguity so the UI reinforces (rather than mildly contradicts) the Terms.
