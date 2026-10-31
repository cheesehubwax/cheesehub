# Track CHEESECrypt in "Nulled by contract"

## Goal
Add a **CHEESECrypt** row to the CHEESENull per-contract breakdown. It counts every CHEESE CHEESECrypt has nulled: the old direct fees paid from users' own wallets before the contract, plus everything `crypt.cheese` nulls now and later. It gets the same lifetime, 24h/7d/30d and average columns as the other rows.

## What counts as a CHEESECrypt null
Both kinds come from the history the breakdown already reads (all CHEESE transfers to `eosio.null`), so no extra scans are needed.

1. **Since the contract:** any transfer to `eosio.null` **from `crypt.cheese`**. This covers messages, voice, joins, key creation/publishing and listings sent through `sendmsg` and `payfee`.
2. **Before the contract (direct fees):** transfers to `eosio.null` from any account whose memo is a CHEESECrypt fee label:
   - `CHEESECrypt messaging fee` (messages, voice, joins)
   - `CRYPTKEY1:` and legacy `GPKMKEY1:` (key creation/publishing)
   - `CRYPTROOM1:` (room listings, updates, unlists)
   - `CRYPTHIDE1:` and `CRYPTREPORT1:` (admin hides and room reports, 0.0001 each)
   - Legacy `GPKM1:`-era fee legs, if they used a recognised label

   Users can still send direct fees after the contract went live (anything the router doesn't handle stays direct), and these are counted the same way.
3. **Excluded:** the `0.0000 CHEESE` key-lock signature transfer (it carries no value) and the 20% `xcheeseliqst` legs (those are not nulls).

Each transfer is counted once. A `crypt.cheese` transfer is attributed by sender, and a user's direct leg by memo, so neither can match both rules.

## Display
- New row label: **CHEESECrypt**, ordered with the other contracts.
- Percent shares and the grand totals include it automatically.
- The averages start from its earliest observed null, which is the first pre-contract fee.

## Caveats
- History is the same multi-provider union, which stops at 50,000 actions. If that cap is reached, the existing "partial" flag shows. Old direct fees are read from that same pool.
- The memo prefixes are public on-chain data already, so this reveals nothing new about users.

## Technical details
- `src/lib/cheeseNullBreakdown.ts`: add `{ account: 'crypt.cheese', displayName: 'CHEESECrypt' }` to `NULL_CONTRACTS`. In the `eosio.null` attribution callback, return `'crypt.cheese'` when `from === 'crypt.cheese'` or the memo matches a prefix from a new `isCryptNullMemo()` helper. That helper imports the existing constants (`FEE_MEMO`, `KEY_PREFIX`, `LEGACY_KEY_PREFIX`, `ROOM_PREFIX`, the hide and report prefixes), so the labels can't drift.
- `src/test/cheeseNullBreakdown.test.ts`: add tests for:
  - direct pre-contract fees from users counted under CHEESECrypt
  - `crypt.cheese` nulls counted
  - xcheeseliqst legs and non-Crypt user nulls ignored
  - the earliest direct fee setting `trackedDays`
- Before building, check one real pre-contract fee transaction to confirm the legacy fee memo text. If waxcrypt-era fees used another label, add it.
- Update `AGENTS.md` with one rule on CHEESECrypt null attribution.
