# Compound All: only ever use the rewards just claimed

## The problem

Right now the compound step looks at how much of each token is **in your wallet** after the claim. If you were already holding CHEESE or WBTC before clicking, that existing balance can be pulled into the deposit. That is wrong — compounding must only ever use what the farms just paid out.

The 0.5% "buffer" was an attempt to soften this, but it solves the wrong problem: it still risks spending wallet tokens, and it holds back part of the actual reward.

## What it will do instead

1. Read your token balances immediately **before** the claim (this already happens).
2. Claim the farm rewards (unchanged, one signature).
3. Read the balances again afterwards and take the **difference**. That difference is exactly what the claim paid you, and it is the only pool of tokens compounding is allowed to touch. Anything you held beforehand is untouchable.
4. For each position, the smaller reward side goes in whole, and the other side is matched to it at the pool's current rate (so CHEESE/WAXWBTC: all the claimed WBTC goes in, and only the equal-value amount of claimed CHEESE goes with it).
5. Take the 0.75% hole.cheese fee out of each side being deposited, then deposit the rest.
6. Any claimed tokens left over after matching simply stay in your wallet, as does everything you held before.

The 0.5% buffer is removed — it is no longer needed now that only the claim delta is ever spent.

## Wording and safety

- The preview will state plainly that only the rewards from this claim are used and that existing wallet holdings are never touched.
- If a balance genuinely cannot be read either before or after the claim, that position is skipped with the honest "couldn't read your SYMBOL balance" message and the "Re-check balances" button — never treated as zero, and never guessed from your wallet total.
- If the claim delta for a token is zero, the skip says no SYMBOL arrived from this claim.

## Technical notes

- `CompoundAllDialog.tsx`: keep the pre-claim `before` read, compute `claimed[key] = max(0, after - before)` per token at the token's precision, and pass that map into `planCompound` instead of `after`. A token is only `known` when both the before and after reads succeeded. `recheckBalances` re-reads the post-claim side and recomputes against the stored `before` snapshot, so re-checking never re-claims and never widens the allowance.
- `alcorCompound.ts`: drop `COMPOUND_BUFFER_RATE` and the buffer maths in `planCompound`; allocation now works directly from the claimed amounts. Fee and deposit split per leg stay as they are (fee = 0.75% of the gross leg, floored to token precision; deposit = gross − fee).
- Ratio matching stays on the position's current pool ratio, which is the value match described.
- Tests in `src/test/alcorCompound.test.ts`: replace the buffer test with claim-delta cases (pre-existing wallet balance is never spent; full claimed amount is available; unreadable before-read yields the unknown skip), keeping the pairing, dust, shared-balance and cap coverage.
