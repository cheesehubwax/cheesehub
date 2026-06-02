## Goal

Elevate the official `cheesefarm` above the rest of the farms by showing a single highlighted card centered between the hero subtitle and the Browse/Create/My Farms tab bar on `/farm`. It will still appear in the Browse Farms grid below as well.

## Changes

### `src/pages/Farm.tsx`

1. Fetch farms with React Query (same `["farms"]` key as `BrowseFarms`, so it shares cache and only loads once):
   - `useQuery({ queryKey: ["farms"], queryFn: fetchAllFarms, staleTime: 60_000 })`
2. Find the featured farm: `farms.find(f => f.farm_name === "cheesefarm")`.
3. Render a new section between the hero `</section>` and the `<div className="container pb-12">` that holds the tabs:
   - Wrapper: `container` with `pb-8 flex justify-center`.
   - Inner: `w-full max-w-md` so the card sits centered and roughly matches a single grid column width.
   - Above the card: small centered label "⭐ Featured Farm" using `text-cheese text-xs uppercase tracking-wider` for visual elevation.
   - Card: reuse `<FarmCard farm={featuredFarm} />` wrapped in a div that adds a cheese-gold glow + border highlight:
     - `rounded-xl p-[2px] bg-gradient-to-br from-cheese/60 via-cheese/20 to-cheese/60 shadow-[0_0_30px_-5px_hsl(var(--cheese)/0.4)]`
   - Skip the section entirely if `featuredFarm` is undefined or while loading (no skeleton, to avoid layout jank).
4. Do not modify `BrowseFarms` — the farm continues to render in the grid as well.

### Notes

- No changes to `FarmCard` internals; the highlight is purely a wrapping border/glow so the card stays visually consistent with the grid version.
- Hidden when viewing `/farm/:farmName` detail route (the early return already handles that).
- No logic, fetching, or contract changes.

## Out of scope

- No filter changes in BrowseFarms.
- No new badge inside FarmCard.
- No mobile-specific layout tweaks beyond `max-w-md` (already responsive).
