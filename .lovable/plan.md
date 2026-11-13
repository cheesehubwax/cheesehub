# Accept Terms once at sign-in, keep 3 specific warnings

## What changes for users
- First time you connect a wallet, a "Terms of Use" window appears with the full terms and an **Accept & Connect** button. Declining cancels the connection.
- Once accepted, the generic "I have read and agree to the Terms of Use" checkbox disappears from every form across CHEESEHub.
- If the Terms are updated later, the window appears once more on your next visit.
- Returning users who are already signed in but never accepted the current version see the same window before they can sign anything.

## The 3 kept confirmations (wording replaces the generic checkbox)
1. **Token Locks** (normal lock + liquidity lock): "I understand this on-chain lock is permanent and cannot be reversed or unlocked early by anyone."
2. **Banner Ad Rentals** (single + bulk): "I confirm this ad contains no malicious links, scams, or illegal material."
3. **ALCORBridge** (widget + deposit address): "I acknowledge that bridging is executed by Alcor Exchange contracts and CHEESEHub never holds these funds."

## Forms losing the generic checkbox
RAM buy/sell, CHEESEAir run + sell RAM, Compound All, Wojak Unbox, Drops cart, DAO create + treasury deposit, Drip create, Farm create + deposit rewards, and all CHEESECrypt dialogs (composer, groups, rotate, paid actions, profile/key share, public rooms, room reports, instant chat, admin moderation panel).

## Legal note
- Acceptance before wallet connection is standard clickwrap and is stronger than repeated checkboxes. The Terms link stays visible in the footer and in the gate.
- Acceptance is stored only in this browser (per version). On a new device or after clearing browser data, users accept again. Nothing is recorded on-chain or on a server, so there is no central acceptance log. That is a privacy plus, but it means CHEESEHub cannot prove acceptance for a specific account. Flagging this so you know.

## Technical details
- New `src/lib/termsAcceptance.ts`: `TERMS_VERSION` constant (tied to the "Last updated" date), `hasAcceptedTerms()`, `acceptTerms()` via localStorage key `cheesehub_terms_accepted`.
- New `src/components/shared/TermsGateDialog.tsx`: scrollable `TermsContent`, Accept & Connect / Cancel.
- `WaxContext.login()`: show the gate first when not accepted; restored sessions without acceptance open the gate and block `transact` until accepted (declining logs out).
- New `src/components/shared/RiskAcknowledgement.tsx`: checkbox with custom sentence; used by CreateLock, CreateLiquidityLock, RentSlotDialog, BulkRentDialog, Bridge page, DepositAddressPanel.
- Remove `TermsCheckbox` state/disabled gating from all other listed files; delete `TermsCheckbox.tsx` once unused. Keep `TermsDialog` for footer/gate links.
- Update `airdropRendering.test.tsx` for the removed checkbox; add tests: version mismatch re-prompts, accepted version skips, each of the 3 forms still disables its button until ticked.
- Update memory: replace the Core "Mandatory Terms of Use checkbox" rule and `mem://logic/terms-confirmation-gate` with the sign-in gate + 3 narrow confirmations.
