# CHEESEDao cleanup plan (no behaviour changes)

Goal: make CHEESEDao easier and safer to maintain without changing anything a user sees or signs. Fees, wording, layout, transactions and contract calls stay exactly the same. Each stage ends with tests passing, a clean build and a live check of the DAO page before the next stage starts.

## Stage 1 - Safety net first (tests before touching anything)
Lock in today's behaviour so any accidental change is caught:
- Every transaction builder: exact contract, action name, permission and data for create DAO, profile edits, proposals (standard, multi-option, ranked choice, token transfer, NFT transfer), votes (all three types), stake/unstake tokens and NFTs, treasury deposits, join/leave, finalize, recount, claim vote RAM, edit proposal cost.
- Fee amounts: 265 WAX DAO creation fee, proposal cost transfers, fee token list and precision lookup.
- Pure helpers: IPFS URL building, DAO type / voting type labels, 30-day expiry rule.
- Read parsing: proposal and DAO row parsing using recorded sample rows (no live network in tests).

## Stage 2 - Split the 1,353-line DAO file by job
Split into focused files, keeping the original file as a single re-export entry point so none of the 14 importing screens change:
- daoModel: types, constants, labels, IPFS helper
- daoFees: fee tokens, token precision cache, fee/announce actions
- daoActions: all transaction builders (moved verbatim)
- daoReads: all chain/API reads (moved verbatim, same endpoint fallback order)
Code is moved, not rewritten. Stage 1 tests must pass unchanged.

## Stage 3 - Slim down Create DAO screen (772 lines)
- Move form defaults, validation and building the creation transaction into a pure, tested helper.
- Move the small presentational pieces (section header, hints, info tooltips, fee/inline-action notice) into their own files.
- The screen keeps the same fields, order, messages and the same single signed transaction.

## Stage 4 - Slim down DAO detail screen (609 lines)
- Extract the header/profile card, treasury panel and proposal list sections into presentational files; the detail screen keeps owning data loading and state.
- Keep the same tabs, refresh timing and vote handling.

## Stage 5 - Rules file and final sweep
- Add a DAO rules file (contract names, table indexes, fee rules, "import from the entry point").
- Remove anything proven unused (checked by search, not guessed).
- Full DAO test run, build, and a live check of Browse, My DAOs, a DAO detail page and the Create form.

## Things I found but will NOT change unless you say so
1. The Create DAO help text says the fee contract "burns fees". Your rule is "nulled". Should I change that wording to "nulled"? (Not changed in this plan.)
2. Any other oddities I find along the way get listed for you at the end, not fixed silently.

## Risks and how they are handled
- Signed transactions: protected by Stage 1 exact-shape tests; any change makes a test fail.
- Imports breaking: the entry point re-exports everything, matching the farm cleanup approach.
- Live data reads: moved word for word; endpoint order still comes from the shared health resolver.
- No wallet transactions are sent during testing; I can't test real signing here, so you should do one small action (e.g. a vote) after publishing.
