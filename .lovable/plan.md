# Exchange logos across CHEESEAnal

## Goal
Use the supplied official Alcor, Defibox, and TacoSwap logos whenever CHEESEAnal identifies an exchange.

## Changes
- Add the three uploaded logos through the project asset service.
- Create one reusable venue-logo display so sizing, labels, and accessibility stay consistent.
- Show the matching logo in the venue filter tabs, pool table venue badges, selected pool heading, and account holdings venue column.
- Show all three logos together in the “All venues” filter while keeping its label and pool count clear.
- Keep existing filtering, analytics, and transaction logic unchanged.

## Verification
- Check `/anal` at desktop and mobile widths for clear, uncropped logos and labels.
- Confirm each venue filter still selects the correct pools and “All venues” restores the complete view.
- Confirm the preview build has no errors.
