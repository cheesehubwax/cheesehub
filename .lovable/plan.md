# Make the price / TVL refresh land in a couple of seconds

## Why it is slow today

Timed in a real browser, the refresh button asks for:

- **The whole Alcor pool list** (every pool on WAX): about 2 MB to download and 11.6 MB to unpack, just to pick out the CHEESE pools for TVL. Page load asks for it twice.
- **The whole Alcor token list** (470 KB) and **every Alcor market** (610 KB), just to read the CHEESE and WAXUSDC prices and one CHEESE/WAX market.
- The Nefty TVL figure from one fixed node (alohaeos) with **no time limit**, and the other TVL sources with no time limit either.

TVL only shows once **all five** sources have answered, and the spinner keeps going until then. On a fast server link this takes about 2 s. On a normal home or mobile connection, downloading and unpacking about 13 MB is what pushes it toward 30 s. If one source stalls, it adds even more time.

## What to change

1. **Price: read only the two tokens we need.** Alcor has a small lookup for each token (about 240 bytes each: CHEESE and WAXUSDC). Refresh reads those two lookups, so CHEESE/WAX and CHEESE/USD update in well under a second. The full token list is still used for the swap window, loaded as it is now.
2. **TVL, Alcor Swap: stop downloading every pool.** Find the CHEESE pool numbers once, and remember them in the browser for 24 hours. After that, fetch only those pools, all at the same time. New CHEESE pools are picked up at the next daily re-scan.
3. **TVL, Alcor Spot: read only the CHEESE/WAX market** (665 bytes) instead of all 610 KB of markets.
4. **Time limits on every TVL source.** Each source gets up to 8 s. Nefty's balance goes through the same backup-node reader the rest of the site uses, instead of one fixed node. A slow source no longer holds up the others.
5. **Keep the last numbers on screen while refreshing.** TVL shows its last good value right away, the same way price and supply already do, and each box updates as soon as its own data arrives.

The numbers stay the same: same sources, same maths, just much smaller downloads.

## How I'll check it

- First, confirm that each single-pool record includes the same TVL figure the full list gives. If it doesn't, work TVL out from the pool's token amounts instead, and show that the totals match the current method.
- Time the refresh in the browser before and after, with normal speed and with a simulated slower connection. The goal is price in under 1 s and TVL in about 2 to 3 s.
- Check that the price, market cap and TVL figures match the current method.

## Technical details

- `useCheesePriceData`: new small query `['cheese-price-lite']` hitting `/api/v2/tokens/cheese-cheeseburger` + `/tokens/waxusdc-eth.token`, same derivation (cheeseWax / waxusdcSys, usd_price fallback); refresh calls this instead of refetching the full `swap-tokens` list.
- `src/lib/tvl.ts`: `fetchAlcorSwapCheeseTVL` uses a statCache'd id list (`cheese-pool-ids`, 24h, rebuilt from `/swap/pools` only when missing/expired) then `mapLimit` over `/swap/pools/{id}`; `fetchAlcorSpotCheeseTVL` uses `/tickers/cheese-cheeseburger_wax-eosio.token`; all fetches get an AbortController 8 s timeout; Nefty via `chainPost('/v1/chain/get_currency_balance')`. Each source still returns 0 on failure.
- `useCheeseTVL`: `placeholderData` from statCache via `cached('cheese-tvl', ...)`; skeleton only when no value at all.
