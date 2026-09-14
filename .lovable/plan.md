# CHEESEAnal pool-history dropdown selector

## Goal
In the CHEESEAnal pool history section, turn the pair title into a button that opens a dropdown menu listing every pool in the same USD-descending order as the table above. Selecting a pool from the menu updates the charts and provider table below, so users do not have to scroll back to the table to switch pools.

## What will change

### 1. `src/components/anal/AnalPoolDetail.tsx`
- Add two props:
  - `pools: LpPoolSnapshot[]` — the currently visible pool list (already filtered by venue).
  - `onSelectPool: (key: string) => void` — callback that sets the selected pool key.
- Sort the received `pools` by USD value descending to match `AnalPoolTable`.
- Replace the static pair title row with a `Select` from `@/components/ui/select`.
  - The `SelectTrigger` is styled like a button and contains the current pair title: overlapped pair logos, `CHEESE / SYMBOL`, and the venue badge.
  - The `SelectContent` lists every pool.
  - Each `SelectItem` displays:
    - `PairLogos` for the pool's paired token.
    - The pair name (`CHEESE / SYMBOL`).
    - `VenueLabel` for the exchange.
- Keep the existing "Pool history CSV" export button beside the title.
- If `pools` is empty, disable the dropdown and show the current title as before.

### 2. `src/pages/CheeseAnal.tsx`
- Pass `current?.pools ?? []` and `setPoolKey` into `<AnalPoolDetail />` so the dropdown can update the page-level selection state.

## Out of scope
- No changes to workflow/snapshot data.
- No changes to chart colors, value boxes, or table columns.
- No new routes or backend calls.

## Verification
- TypeScript typecheck passes.
- Production build passes.
- Browser check on `/anal` confirms:
  - The pool-history title is clickable and opens a dropdown.
  - Dropdown items match the table order and show pair logos, pair name, and venue.
  - Selecting a pool updates the charts and provider list without scrolling.
