# Inline CHEESESwap route controls

## Goal
Keep manual allocation controls inside the existing Multiroute box, directly beneath the pool/path they control, instead of showing a separate manual-control block above the route list.

## Changes
- Keep the existing Auto/Manual switch in the Multiroute heading.
- In Manual mode, render each selected route once: its venue, token path, fees, and current percentage on the first line, with its slider immediately below.
- Place compact minus and plus buttons beside each slider; each press changes that route by exactly 1% and proportionally adjusts the other selected routes so the total remains exactly 100%.
- Make the slider easier to drag by increasing its usable track/thumb area while retaining 1% steps and keyboard accessibility.
- Keep route removal and the “Add a pool route” selector within the same Multiroute box, below the affected route rows.
- Remove the duplicate manual route labels and percentage-number field from the separate control block.

## Safety and behavior
- Preserve spend-only Manual mode, the six-route maximum, fresh requoting, disabled signing while a quote updates, per-leg safeguards, and atomic execution.
- Clamp minus/plus changes at 0% and 100%; a route reaching 0% is removed only under the existing removal rule.
- Disable controls that cannot change further, including the sole route fixed at 100%.
- Add tests for exact 1% stepping, boundary behavior, and the invariant that allocations always total 100%.

## Verification
- Run type checks and focused swap-allocation tests.
- Open CHEESESwap at desktop and mobile widths, enter a spend amount, switch to Manual, and confirm each slider appears beneath its matching route without duplicated route sections or overflow.
