# CHEESERam: stop "failed" buys that actually succeeded

## What happened

The error you remember — "Could not reach the blockchain endpoint or Greymass Fuel service. Check your internet connection and try again." — is the network/timeout branch of the shared error parser in `src/lib/wharfKit.ts`. It fires whenever the thrown error mentions fetch/network/timeout/502/503.

That message is misleading in exactly your situation. Because `zeebigcheese` had no free CPU, the transaction went through the Greymass Fuel resource provider: the plugin cosigns and pushes the transaction, then the reply has to come back over the network. When that reply is lost or times out, the transaction is already in a block — but the frontend throws, lands in the network branch, and tells you it failed and to retry. You retried twice, so three CHEESE transfers to `ram.chz` landed while the UI reported two failures.

So the origin isn't a contract or accounting bug: it's the frontend treating an unknown outcome as a definite failure, and then inviting an immediate retry.

## The fix

### 1. A third outcome: "unconfirmed"

Add an `unconfirmed` type to `TransactErrorInfo` in `src/lib/wharfKit.ts`, and route the ambiguous cases into it instead of into `fuel_unreachable`:

- network / fetch / timeout / 502 / 503 errors (the one you hit),
- `duplicate transaction` (which by definition means it is already on-chain),
- any thrown error that still carries a resolved transaction id.

Genuinely pre-broadcast failures keep their current, accurate messages: user cancellation, Fuel explicitly *declining* to sponsor, insufficient balance, and contract assertion errors. Only the "we lost the answer" cases change.

The `unconfirmed` copy replaces "check your internet connection and try again" with the opposite instruction:

> Your transaction was signed and may already be on-chain. We could not confirm it. Check your account on waxblock.io before retrying — retrying may buy RAM twice.

### 2. Verify on-chain instead of guessing

On an `unconfirmed` result, the buy card polls for a matching recent CHEESE transfer from your account to `ram.chz` (a handful of attempts over roughly 15 seconds, through the existing multi-endpoint fallback path). If one is found, the normal success dialog appears with the real TX ID and the "failure" never reaches you. If nothing is found, the amber unconfirmed panel stays, with a waxblock.io link and an explicit "I checked — let me retry" button that is the only way to re-enable Buy.

### 3. No blind double-submits

- The Buy button stays disabled from the first press until the entire flow — including the verification poll — has settled, so a slow Fuel round-trip can't leave room for a second press.
- The same handling goes onto Sell RAM and the Fund WAX Pool claim, which share the identical error shape.

### 4. Better diagnostics for next time

Log the raw error object with its full cause chain and any resolved transaction id under a `[CHEESERam]` prefix, so a recurrence shows which endpoint or Fuel step actually broke instead of being flattened into a toast.

## Technical notes

- `src/lib/wharfKit.ts`: extend `TransactErrorInfo` with `unconfirmed`; move the network/timeout/5xx patterns, `duplicate transaction`, and "error carries a transaction id" into it; leave `cancelled`, the explicit Fuel-declined branch, CPU/NET billing, and balance/assertion branches untouched.
- New helper in `src/lib/cheeseRam.ts` that looks up recent CHEESE transfers from a given account to `ram.chz` for post-hoc confirmation, reusing the existing endpoint-fallback / Hyperion reader.
- `src/components/ram/BuyRamCard.tsx` and `SellRamCard.tsx`: an `unconfirmed` UI state (amber panel, waxblock.io link, acknowledge-to-retry button) in place of the plain error toast on that branch.
- `src/components/ram/FundWaxPoolCard.tsx`: reuse the same messaging.
- Presentation and error-handling only — no contract, schema, or pricing-logic changes.

## Worth knowing

Buying from an account with no free CPU will keep depending on Fuel, so this class of timeout can recur. The fix makes it harmless rather than preventing it. If you want, a follow-up can also warn before signing when your CPU headroom is near zero.

The three purchases that already went through are final on-chain and can't be undone from the frontend.
