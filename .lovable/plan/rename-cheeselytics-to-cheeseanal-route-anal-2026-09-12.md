# Rename CHEESELytics to CHEESEAnal, route /anal

## What changes

**Routing (user-facing)**
- `src/App.tsx`: route becomes `/anal` (import updated to renamed page). Still no header/nav link — URL-only, exactly as today.

**Frontend branding (user-facing)**
- `src/pages/CheeseLytics.tsx` → `src/pages/CheeseAnal.tsx`: heading renders `CHEESE` + `Anal`, orb alt text "CHEESEAnal", comments updated. Everything else (BETA badge, layout, charts) untouched.

**Internal renames (no behavior change)**
- `src/components/lytics/` → `src/components/anal/`, components renamed:
  - `LyticsOverview` → `AnalOverview`
  - `LyticsPoolTable` → `AnalPoolTable`
  - `LyticsPoolDetail` → `AnalPoolDetail`
  - `LyticsAccountPanel` → `AnalAccountPanel`
  - `format.ts` stays (imports updated)
- `src/hooks/useLpHistory.ts`: react-query keys `cheeseLytics` → `cheeseAnal` (fresh cache; harmless).
- "CHEESELytics" comment/branding strings updated in: `src/lib/lpPools.ts`, `src/lib/lpLive.ts`, `src/lib/lpCsv.ts`, `src/hooks/useLpHistory.ts`, `scripts/lp-history/sample.ts`, `scripts/lp-history/README.md`, `.github/workflows/lp-history.yml` (workflow display name only).

## Explicitly NOT changed
- The `lp-history-data` branch, data file paths, workflow file name, and script directory name — renaming these would break the data pipeline and stored history for zero user-visible benefit.
- No header link added.

## Verification
- Typecheck + build pass.
- Playwright: `/anal` loads the page with CHEESEAnal heading and charts; `/cheeselytics` shows 404 (old URL retired — flag if you'd rather keep a redirect).
