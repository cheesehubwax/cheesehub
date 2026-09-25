# Add a HOLE token information popup

Add a small information button inside the HOLE/CHEESE price box on the homepage. Selecting it opens a focused popup containing the HOLE logo, verified token facts, and the supplied description.

## What the user sees

- A compact info icon in the existing HOLE/CHEESE price box, with an accessible label and tooltip.
- A popup headed **HOLE Token** with the same HOLE logo already used in the price box.
- A clear facts section:
  - **Birthdate:** 16 July 2026
  - **Total supply:** 100,000.00000000 HOLE
  - **Token contract:** `hole.cheese`
  - **Ticker:** HOLE
  - **Precision:** 8 decimals
- The supplied passage, preserved as written:

  > $HOLE is the 'Son Token' of $CHEESE. The first token contract born of the CHEESE account. 100% of supply 100k was minted and immediately paired with 0 $CHEESE. $HOLE acts like a $CHEESE 'sink' or a hole hence its name.

- The popup closes through its close icon, by clicking outside, or with Escape, and remains fully usable on mobile.

## Technical details

- Add a focused HOLE information dialog component using the project’s existing dialog and button components.
- Reuse `TokenLogo` with `hole.cheese` / `HOLE`; do not add or duplicate a logo asset.
- Mount the dialog from the homepage price bar and place its trigger only in the HOLE/CHEESE box.
- Keep all price fetching, refresh behavior, swap behavior, and the other price boxes unchanged.
- Treat the facts as fixed token metadata. The birthdate, supply and precision were checked against the WAX contract history and current `stat` row; the current token was created and fully issued on 16 July 2026.

## Verification

- Confirm the trigger opens and closes the popup by mouse and keyboard.
- Confirm the logo, five facts, and full passage display without clipping on desktop and mobile.
- Confirm the HOLE/CHEESE price and Refresh control still work normally.
- Confirm tests and the app build remain clean.
