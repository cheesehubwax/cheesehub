# Plan: Fix "Collecting history" on the ALL tab

## What's actually happening

Nothing is broken. I fetched the live data file on the `ram-price-data` branch and it currently contains **exactly one** recorded sample:

```text
[{"t":1788057534923,"waxPerKb":0.44823751,"cheesePerKb":0.2245,"waxPerCheese":1.99659,"usdPerKb":0.00193732}]
```

The chart only draws when it has 2 or more points (one point can't make a line), so every history range falls back to the placeholder text. The second sample lands on the next 4-hourly run, after which 24H/ALL start drawing. So the current behaviour is "working as coded" — but the message is misleading and the wait feels like a bug.

## What to change (presentation only)

Make the panel honest and useful while history is thin, in `src/components/ram/RamPricePanel.tsx`:

1. **Render a single sample instead of hiding it.** When a history range has exactly 1 point, duplicate it into two points so both charts draw a flat line at that recorded value — the same visual the WAX chart already gives when the price is stable. No more dead panel.
2. **Replace the vague placeholder.** Show the real state instead of "Collecting history":
   - 0 samples: `No samples recorded yet — first one lands within 4 hours.`
   - Range empty but samples exist (e.g. ALL has data but 24H window is empty): `No samples in this range yet — try ALL.`
3. **Add a sample counter to the footer** for history ranges, e.g. `1 sample • recorded every 4 hours since 30 Aug 2026`, pluralised. Makes it obvious the recorder is alive and how much data exists.
4. **Leave the LIVE tab untouched** — it already behaves correctly with session data.

## Optional: don't wait 4 hours

If you'd rather see a real line today, run the recorder a few times by hand: repo → **Actions** → **RAM Price History** → **Run workflow**. Each run appends one sample, so three or four runs spaced a few minutes apart gives an immediately drawable chart. No code change needed for this, and it doesn't affect the scheduled runs.

## Technical notes

- Change is scoped to `RamPricePanel.tsx`; no changes to `useRamPriceHistory.ts`, the sampler script, or the workflow.
- The single-point duplication happens in the existing `chartData` memo, keyed off range so LIVE is unaffected.
- The hook already sorts and filters records, so the counter can read `records.length` and the sliced range length directly.
