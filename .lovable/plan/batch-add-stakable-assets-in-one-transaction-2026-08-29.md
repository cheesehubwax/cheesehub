# Batch-add stakable assets in one transaction

Today the "Add Stakable Asset" form in Manage Stakable Assets accepts a single template (or schema / collection / attribute) per submission, so configuring 20 templates with identical rewards means 20 wallet signatures.

The farm contract's `settmpvalues` / `setschvalues` / `setcolvalues` / `setattvalues` actions already accept a **list** of values, so many entries with the same hourly reward can go into a single action and a single transaction.

## What changes for the user

- Template farms: the "Template ID" field accepts multiple IDs — comma, space, or newline separated (e.g. `12345, 12346, 12350`). Paste a list, enter the hourly reward once, tick Terms, sign once.
- The field becomes a small textarea with helper text ("One or more template IDs, separated by commas or new lines") and a live count ("3 templates will be added").
- Same batching for the other farm types, so the pattern is consistent:
  - Schema farms: one collection + multiple schema names.
  - Collection farms: multiple collection names.
  - Attribute farms: one attribute name + multiple values (e.g. `legendary, epic`).
- Duplicate and empty entries are ignored; invalid template IDs (non-numeric) are rejected with a toast naming the bad entry, before any signing prompt.
- All entries in a batch share the reward amounts entered — that is the condition for batching, matching the request.
- Existing single-entry usage is unchanged: type one ID and it behaves exactly as before.
- Success toast reads e.g. "3 Stakable Assets Added!"; the config list refreshes once afterwards.

## Technical notes

- `src/lib/farm.ts`: extend the four `buildSet*ValuesAction` builders to accept either a single entry or an array of entries and emit all of them in the action's `values` vector. Keep the current single-argument signatures working (overload or accept `string | string[]` / `number | number[]`) so no other caller breaks.
- `src/components/farm/ManageStakableAssets.tsx`:
  - Parse the input into a deduped array (split on `,`, whitespace, newlines).
  - Validate: at least one entry, template IDs numeric, reward values > 0 (existing check).
  - Build one action with all entries and pass it to the existing `executeTransaction` call (unchanged Greymass Fuel path, TX ID verification, Terms gate).
  - Guard against oversized batches: if more than 50 entries, split into chunks of 50 and submit them as multiple actions inside the **same** transaction, so it still stays one signature.
- Erase/remove behaviour is untouched.
