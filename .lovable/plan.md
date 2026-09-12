# CHEESEAir: two CSV downloads, snapshot and results

Today CHEESEAir has a single "Download CSV" button that exports the *planned* allocations before the run. That one is removed and replaced by two separate, purpose-built exports:

1. **Snapshot CSV** — the holder list exactly as loaded, so it can be kept as proof of the snapshot.
2. **Results CSV** — after the airdrop finishes: who actually received what, and the transaction each delivery landed in.

## 1. Snapshot CSV

A "Download snapshot CSV" button appears in the holder list card once a snapshot is loaded (next to the existing holder-count line).

Columns:

```text
rank,account,weight,selected
```

- `weight` is the raw snapshot value: token balance, NFT count, or current USD position value for Alcor LP.
- `selected` is yes/no, so exclusions made in the table are visible.
- Header comment row records what was snapshotted (mode, contract/symbol or collection or LP pair), the source, the snapshot time, and whether the list was truncated.
- Filename: `snapshot-<what>-<timestamp>.csv`.

## 2. Results CSV

A "Download results CSV" button appears in the run panel once the run has finished. It reports one row per recipient with the outcome of the batch that carried them.

Columns (token mode):

```text
account,amount,token,memo,status,tx_id,batch,error
```

- RAM mode: `account,cheese,est_kb,status,tx_id,batch,error` — a recipient split into several legal purchases gets one row per purchase.
- NFT mode: `account,nfts,asset_ids,collection,template_id,memo,status,tx_id,batch,error`.
- `status` is `confirmed` or `failed`; failed rows carry the batch error and no tx id.
- Skipped recipients (below the RAM minimum, or a zero NFT share) are included with status `skipped` and the reason, so the file accounts for everyone selected.
- Filename: `airdrop-results-<kind>-<timestamp>.csv`.

## 3. Remove the planned-allocations export

The existing "Download CSV" button in the run panel and the `downloadCsv` callback in the airdrop context are removed, along with their unused helpers.

## Technical notes

- `BatchLogEntry` in `src/components/air/AirdropContext.tsx` currently records only `batch`, `recipients` count, `txId`, `error`. It gains the per-recipient payload for that batch (accounts plus amount/asset ids) so the results CSV can join recipients to transactions. Batch building already iterates the recipient/assignment arrays, so the data is available where the entry is created.
- CSV building lives in a new helper module (`src/lib/airdropCsv.ts`) holding the escaping/blob-download logic and the two builders; the context exposes `downloadSnapshotCsv` and `downloadResultsCsv` in place of `downloadCsv`.
- `AirSnapshotCard.tsx` gets the snapshot button; `AirRunPanel.tsx` gets the results button, shown once the run has produced a batch log.
- No change to distribution maths, transaction building, or signing.
