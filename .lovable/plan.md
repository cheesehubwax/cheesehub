

## Replace Terms Popup with Inline Checkboxes

### Summary
Remove the modal Terms of Use confirmation dialog and replace it with a simple inline checkbox on each relevant form. The submit button stays disabled until the checkbox is ticked. No more popup interruption.

### Components to update (9 files)

Each file gets the same pattern change:
- Remove `useTermsConfirmation` hook import and usage
- Remove `<TermsConfirmationDialog>` component
- Add a `const [termsAgreed, setTermsAgreed] = useState(false)` state
- Add an inline checkbox + label before the submit button:
  ```
  ☐ I agree to the Terms of Use (link)
  ```
- Add `!termsAgreed` to the submit button's `disabled` condition
- Change `onClick={() => requireTerms(handler)}` back to `onClick={handler}`

**Files:**
1. `src/components/locker/CreateLock.tsx`
2. `src/components/locker/CreateLiquidityLock.tsx`
3. `src/components/farm/CreateFarm.tsx`
4. `src/components/dao/CreateDao.tsx`
5. `src/components/dao/TreasuryDeposit.tsx`
6. `src/components/drip/CreateDrip.tsx`
7. `src/components/bannerads/RentSlotDialog.tsx`
8. `src/components/bannerads/BulkRentDialog.tsx`
9. `src/components/drops/CartDrawer.tsx`

### Cleanup (2 files)
- Delete `src/hooks/useTermsConfirmation.ts`
- Delete `src/components/shared/TermsConfirmationDialog.tsx`

### Inline checkbox design
- Uses existing `<Checkbox>` component from `@/components/ui/checkbox`
- Small text with a link to `/terms` opening in new tab
- Resets to unchecked when the dialog/form reopens (for dialog-based UIs like RentSlotDialog)
- No sessionStorage persistence — user must check the box each time they transact

### Files changed: 11
- 9 component files updated
- 2 files deleted

