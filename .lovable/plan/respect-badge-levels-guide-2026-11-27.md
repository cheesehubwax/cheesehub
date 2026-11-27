# Respect "Badge levels" guide

When you open your own Respect badge, a small "Badge levels" link sits in the empty space on the right of the line showing your badge and points count. Clicking it opens a small window that lists every Respect badge with its point range and a one-line description.

## What the window shows (top to bottom, highest first)

| Badge | Points | Description |
|---|---|---|
| 🏆 Huge Respect | 200+ | A deeply invested, long-standing member of the CHEESE community. |
| Big Respect | 150–199 | Strong, well-rounded public track record. |
| 🫕 Much Respect | 100–149 | Clearly invested, with several solid signals. |
| 🧀 Some Respect | 40–99 | An established account with some community involvement. |
| 🥛 No Respect | 10–39 | Few public signals so far. |
| 🪤 Warning | under 10, or account under 7 days old | Very new or almost no public history — take care. |

- Your current badge is highlighted in the list.
- A footer repeats the maximum score (260) and the existing note that Respect is only a guide from public signals.
- Only appears in your own badge view; other people's badges are unchanged.

## Technical details

- New `src/components/crypt/CryptRespectLevels.tsx`: small Dialog (`max-w-sm`), presentational; rows built from a `RESPECT_LEVELS` list exported from `src/lib/cryptTrust.ts` (mark, min, max, description), reusing the existing labels so names never drift from `markFor` cutoffs.
- `CryptTrustBreakdown.tsx`: turn the badge/points line into a `flex justify-between` row and put a small underlined "Badge levels" button at its right end, same line that opens the dialog with `current={score.mark}`.
- Test in `src/test/cryptTrust.test.ts`: each level's min score maps to that level via the scoring cutoffs (and 199→strong, 200→huge), so the guide can't contradict the real ranking.
