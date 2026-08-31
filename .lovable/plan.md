# CHEESERam: stop "failed" buys that actually succeeded

## What happened

`BuyRamCard` treats every rejected promise from `session.transact()` as "the purchase failed" and shows a red error toast. But a transaction can be **signed and broadcast successfully and still make the promise reject** — most often when the RPC endpoint times out, drops the connection, or returns a 5xx *after* the transaction was already accepted into a block. That is almost certainly what happened here: two buys were pushed on-chain, the frontend never got a clean receipt back, showed an error, and you re-tried — so `zeebigcheese` paid CHEESE for RAM three times instead of once.

Nothing in the current code distinguishes "never left the browser" from "already on-chain, we just lost the answer", and nothing checks the chain before letting you press Buy again.

Note: I have not confirmed the exact error text from your two failed attempts (the console logs from that session aren't available), so the first step of the work is to capture it. The mitigation below is safe either way, because it makes the UI truthful about an unknown outcome instead of claiming failure.

## The fix

### 1. Classify post-broadcast errors as "unconfirmed", not "failed"

Add an `unconfirmed` outcome to the shared transaction error parser (`src/lib/wharfKit.ts`). When the error is a network/timeout/5xx class error, or the WharfKit error carries a resolved transaction id, the UI must **not** say the purchase failed. Instead it shows an amber warning:

> Your transaction was signed and may already be on-chain. We could not confirm it. Do not retry until you have checked — [view your account on waxblock.io].

The same treatment applies to the `duplicate transaction` error, which by definition means the transaction is already in a block.

### 2. Verify on-chain before allowing a retry

When a buy ends in the `unconfirmed` state, `BuyRamCard` polls the CHEESERam stats/history for a matching recent transfer from your account (a few attempts over ~15 seconds, using the existing multi-endpoint fallback helper). If a match is found, the card switches to the normal success dialog with the real TX ID. If not, the Buy button stays locked behind an explicit "I checked, let me retry" confirmation so a second transfer can never be fired blind.

### 3. Guard against double-submits generally

- Keep the Buy button disabled from the moment it is pressed until the whole flow (including the verification poll) finishes, so a slow wallet round-trip cannot produce two in-flight transfers.
- Apply the identical treatment to the Sell RAM card and the Fund WAX Pool claim, which share the same error-handling shape.

### 4. Surface the diagnosis

Log the raw error (message, cause chain, and any resolved transaction id) under a clear `[CHEESERam]` prefix so if this recurs the exact endpoint failure is visible in the console rather than being flattened into a generic toast.

## Technical notes

- `src/lib/wharfKit.ts`: extend `TransactErrorInfo` with an `unconfirmed` type; detect it from network/timeout/5xx patterns, `duplicate transaction`, and the presence of `error.transaction`/`error.resolved` on the thrown object. Existing `cancelled`, Fuel, CPU/NET, and RLS-style branches stay as they are.
- `src/components/ram/BuyRamCard.tsx` and `SellRamCard.tsx`: new `unconfirmed` UI state (amber panel with a waxblock.io link plus an acknowledge button) replacing the plain `toast.error` on that branch; retry stays blocked while the state is active.
- New helper in `src/lib/cheeseRam.ts` to look up a recent CHEESE transfer from an account to `ram.chz` for post-hoc confirmation, going through the existing endpoint-fallback + Hyperion path.
- `src/components/ram/FundWaxPoolCard.tsx`: reuse the same `unconfirmed` messaging.
- No contract, schema, or business-logic changes; presentation and error handling only.

## Not covered

The three purchases that already went through are final on-chain and cannot be reversed from the frontend.
