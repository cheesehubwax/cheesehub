# CHEESEFolio: save and load history as a JSON file

## What the user gets
- **Save history (JSON)** button next to the CSV buttons, enabled once any history exists. Downloads `cheesefolio-<account>-<date>.json`.
- **Load history (JSON)** button, shown both in the toolbar and on the empty "Scan my history" screen, so a new browser can skip the full scan.
- Loading **merges** with whatever is already saved in this browser for the account, removing duplicates. Nothing already saved is lost.
- After loading, a short summary: "Added 1,240 new transfers (8,310 already saved). Press Sync to fetch anything newer." The next Sync only reads transfers after the newest one held.
- Clear refusals, no partial changes, when a file is: not a CHEESEFolio file, for a different account (names both), from a newer app version, damaged (checksum mismatch), or contains invalid rows.
- Files are produced and read only in the browser; nothing is uploaded.

## File format (future-proof)
```text
{
  "format": "cheesefolio",
  "version": 1,
  "exportedAt": "2026-10-21T05:48:00Z",
  "account": "abc.wam",
  "sections": {
    "history": {
      "schema": <current storage schema>,
      "transfers": [...raw saved transfers...],
      "cursors": {...},
      "syncedAt", "coverageFrom", "accountCreated",
      "checksum": "sha256 of the transfers list"
    }
    // later: "layout", "preferences", ... (each optional, each versioned)
  }
}
```
- Readers ignore unknown sections, so later layout/preference files stay loadable by older and newer versions.
- Only raw transfers are stored; classifications, prices and P/L are re-derived on load (same as today), so classifier fixes still apply to imported history.

## Merge rules
- Transfers: union by global sequence. When both sides hold the same one, keep the copy with more detail (fill record already checked/found beats unchecked). Result sorted by global sequence. Existing inline-copy de-duplication in the classifier still applies.
- Coverage start: earliest of the two. Account creation: whichever is known.
- Scan progress per history service: keep the one that has read further and finished; unfinished date windows are kept only from the side whose progress is chosen. A file never marks a service "finished" unless that file said so.
- Last synced time: the later of the two.
- Merge happens in memory, is validated, then saved in one write; a running scan is stopped first.

## Technical details
- New `src/lib/folio/portable.ts`: `exportFolio(rec)`, `parseFolioFile(text, account)` (strict validation of every transfer field type, account names, schema, checksum via `crypto.subtle`), `mergeFolio(local, imported)` returning the merged record plus counts.
- `useFolio`: add `importFile(file)` (abort sync → parse → merge → `saveFolio` → `setRec`) returning a summary or a readable error.
- `Folio.tsx`: two buttons with a hidden file input (`.json`), result shown via toast.
- Tests `src/test/folioPortable.test.ts`: round-trip export→import identical; merge de-dupes by sequence and keeps the more detailed copy; wrong account rejected; tampered checksum rejected; newer version rejected; unknown extra section ignored; cursor merge never sets "finished" from an unfinished side.
- Add one rule to `AGENTS.md` on the sectioned, versioned portable file and merge-by-sequence.
