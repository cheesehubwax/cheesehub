# CHEESEFolio audit and tidy — staged plan

Goal: apply the same anti-entropy treatment CHEESEAir received, without blocking or breaking features still being built. Each stage is small, ships on its own, keeps every existing check passing, and changes no numbers the user sees unless a stage explicitly fixes a proven bug.

## Ground rules (all stages)
- Behaviour freeze per stage: refactors must produce identical values (holdings, Total Cost, P/L, Realisable Now) — locked by tests first.
- New Folio features in progress go into the new structure as it lands; no parallel old/new copies left behind.
- No new markdown scratch files; findings go into one short audit note that is deleted when Folio is done. Rules go into AGENTS.md (replace, never duplicate).
- Unknown prices/rates stay unknown; live balances stay the truth.

## Stage 1 — Lock the numbers (tests only, no code changes)
- Golden-ledger test: a fixed raw history fixture (trades, gifts, LP add/remove, Alcor deals, duplicate inline copies) asserting holdings, Total Cost, realised/unrealised P/L, disposal P/L and acquisitions.
- Sync tests: deepest-provider-to-end rule, sequence dedup, creator-copy dedup, capped concurrency, provider dropout mid-scan.
- Storage tests: per-account isolation, JSON export/import round trip with checksums, newest-edit portfolio merge.
- Outcome: a safety net for every later stage.

## Stage 2 — Sync engine (`scanner.ts`, `useFolio.ts`)
- Split scanner (488 lines) into: provider paging, merge/dedup, gap detection (creator trust), Alcor/order-book leftovers.
- Single cancellable scan lifecycle per account: abort on account switch/unmount, no overlapping scans, no state writes after abort.
- Explicit partial-sync state shown to the user (instead of silently incomplete history).
- Confirm endpoint order always comes from the health resolver.

## Stage 3 — Valuation safety (`pooled.ts`, `prices.ts`, `holdings.ts`, `fx*`)
- Verify every unreadable venue/price/rate path yields "unknown" and hides P/L, never zero.
- Price polling: foreground-only, single interval owner, refetch on focus, no leaked timers.
- Remove any duplicated pricing/precision helpers shared with the wallet/token registry.

## Stage 4 — UI decomposition (`FolioParts.tsx` 666 lines, `Folio.tsx` 421 lines)
- Split into focused files: summary boxes, token row, mobile card, disposal P/L panel, gift dialog, sync status.
- Page becomes layout only; data comes from focused hooks (holdings, sync, portfolios, display currency).
- Keep the five summary boxes order and compact rows exactly as today.

## Stage 5 — Render performance
- Memoize token rows by per-token primitive props so price ticks or toggles redraw only changed rows.
- Render-count tests like CHEESEAir: changing currency, portfolio, or Card/Table view refreshes only what changed.

## Stage 6 — Cleanup and handover
- Delete dead exports, unused types and the temporary audit note.
- Update AGENTS.md Folio rules (merge where possible), roadmap.md.
- Live check in the preview with a real account: sync, holdings, LP rows, import/export.

## Handling ongoing Folio building
- Before each stage, I'll check roadmap.md for open Folio feature work; if a feature touches the same files, it is finished or folded into that stage first.
- Stages 1 and 3 are safe to run anytime; Stages 2 and 4 are the ones to schedule around active feature work.

## Not changing
- No contract, fee, or Crypt changes. No new data stored off-device (keeps Folio local-only — no privacy or custody concerns).

Recommended order: 1 → 2 → 3 → 4 → 5 → 6, one stage per approval.
