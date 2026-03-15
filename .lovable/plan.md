

## FarmCard Reward Pool Layout Update

The fonts are already identical between DaoCard and FarmCard — both use the same Tailwind typography classes (`font-semibold`, `text-foreground`, `font-mono`, etc.). No font changes needed.

### Change: Spread Reward Pools Horizontally

Currently, reward pools stack vertically (one per line). We'll change them to flow horizontally across the bottom of the card with space underneath for overflow.

**File: `src/components/farm/FarmCard.tsx`** (lines 105-117)

Replace the vertical `space-y-1` list with a horizontal `flex flex-wrap gap-2` layout:
- Remove the "Reward Pool" label to save space
- Display each pool as a compact inline chip: `[TokenLogo] 1.2K CHEESE`
- Use `flex-wrap` so pools wrap to a second line if needed
- Keep adequate bottom padding for the wrapped line

