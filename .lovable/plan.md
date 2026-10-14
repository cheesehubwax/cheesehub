# CHEESEFolio — personal WAX profit and loss tracker

A new dapp at `/folio` that shows the signed-in wallet's tokens, what you paid for them, what they're worth now, and your profit or loss on every buy and sell. Everything is read from the WAX blockchain automatically. The scanned history is saved in your own browser, so later visits load instantly and only new transactions are fetched.

## What the user sees

1. **Connect wallet.** CHEESEFolio only ever shows the account you're signed in with. There's no box to look up other accounts.
2. **First visit: history scan.** A progress bar shows "Scanning history for benoisballzz… 1,240 transactions found". A light account takes a few seconds; heavy traders can take a minute or more. If you leave mid-scan, it picks up where it stopped next time.
3. **Portfolio overview:**
   - Total value in WAX and USD, with 24h change
   - Total realised profit/loss (from sells) and unrealised profit/loss (tokens you still hold)
   - A chart of portfolio value over time: 7D / 30D / 90D / ALL
4. **Holdings table.** One row per token: amount, average buy price, current price, value, profit/loss in WAX and %, and how the token arrived (bought, farmed, airdropped, received).
5. **Token detail.** Click a token to see every buy and sell with its date, price, venue (Alcor / Defibox / Taco) and a waxblock link, plus a price chart with your buys and sells marked on it.
6. **Activity feed.** All parsed transactions, filterable by type.
7. **Controls:** "Rescan from scratch", "Clear saved data", and CSV export of the history and holdings.
8. Standard CHEESE branding: an emoji heading with a BETA tag, an About link, and a header link below CHEESEAnal.

## Return visits

- The portfolio appears straight away from the saved copy.
- A quiet background check fetches only transactions newer than the last one saved, then updates totals.
- Current balances are always re-read live from the chain. If the saved history disagrees with your real balance, the token is flagged "history incomplete" rather than showing a wrong profit/loss.

## How transactions are classified (version 1)

| Type | Treated as |
|---|---|
| Alcor swaps (one or more hops), Defibox and Taco swaps | Buy of the token received, sell of the token sent, both at the swap price |
| Alcor order book fills | Buy or sell at the fill price |
| Farm reward claims, airdrops, incoming transfers from others | Free acquisition, cost 0 (shown separately) |
| Outgoing transfers to other accounts | Removal at average cost, no profit/loss |
| Nulled tokens | Removal, cost written off |
| Adding or removing liquidity | Tokens move in and out of an "In liquidity" bucket at average cost |

Profit/loss uses the **weighted average cost** method by default. Each token's value is shown in WAX, and USD uses the WAX/USD price at the time of each trade.

## Where prices come from

- **Trade prices:** taken from the swap itself (amount in versus amount out), so no outside price is needed.
- **Current prices:** live from Alcor, the same source CHEESESwap uses.
- **Chart history:** the existing CHEESEAnal snapshot data for CHEESE/HOLE pairs, plus a new lightweight daily workflow that records WAX prices for the top ~200 Alcor tokens (one small file per day, no per-user data). Before that workflow existed, the chart falls back to prices from your own trades.

## Privacy

- Your parsed history and totals are stored only in your browser. Nothing is uploaded and there's no account or server.
- Note: WAX transactions are public, so this is privacy of the analysis, not of the underlying data.

## Build order

1. Saved-history storage, the history scanner (resumable, incremental) and the transaction classifier, with tests built from real recorded transactions.
2. Average-cost profit/loss engine, with tests for buys, partial sells, free rewards, transfers and liquidity.
3. Overview, holdings table, token detail and activity pages.
4. Daily token-price workflow and the portfolio value chart.
5. CSV export, About guide, header and homepage links, and the admin ecosystem guide entry.
6. End-to-end check with the signed-in wallet against real accounts, including benoisballzz.

## Technical details

- Storage: IndexedDB via `idb-keyval`-style wrapper, one store per account (`actions`, `cursor`, `derived`), plus a schema version so classifier upgrades re-derive from the saved raw actions without a rescan.
- Scanner: `fetchActionsUnion`-style reads over `resolveEndpoints('hyperion-v2')` with a timestamp cursor (`after=`), not skip paging (skip stops at 10,000 rows); union across providers and de-duplicate by `global_sequence`.
- Classifier: groups actions by `trx_id`; matches transfers to and from `swap.alcor`, `swap.box`, `swap.taco`, `alcordexmain`, LP contracts and `eosio.null`; pure functions in `src/lib/folio/` with fixture tests.
- Reconciliation: derived holdings are compared with live `get_currency_balance`; a mismatch above precision marks the token incomplete.
- Price workflow: `.github/workflows/token-price-history.yml` writing `data/token-prices/YYYY-MM-DD.json` to a data branch, following the lp-history pattern.
- New `AGENTS.md` rule: Folio data is client-only and derived from saved raw actions.

## Open choices (defaults used unless you say otherwise)

- Cost method: weighted average (FIFO could be added as a toggle later).
- Venues in version 1: Alcor, Defibox and Taco together.
- Very heavy accounts (bots): a "scan from date" option is offered once a scan passes 50,000 actions.
