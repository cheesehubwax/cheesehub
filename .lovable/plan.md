# CHEESECrypt: Trust Strength Badges

A small badge that shows a "strength mark" for strangers and room join requests, built from public on-chain signals. It helps you decide whether to accept someone. It never claims to verify who a person is.

## Where it appears
- Public inbox request cards (strangers)
- Room join requests (owners and admins)
- Direct chat header when the other person is not a friend
- Tapping the badge opens a breakdown showing each signal, its points, and a disclaimer

## Signals and weights

1. Premium CHEESE name (`.cheese` / `.chz` account): **+40**
2. Account age: under 7 days **-15**, 7-30 days **+3**, 30 days-1 year **+8**, 1-3 years **+16**, 3-5 years **+24**, 5 years or more **+32**
3. CHEESE wallet balance: 1-99 **+2**, 100-999 **+6**, 1k-9,999 **+12**, 10k-49,999 **+20**, 50k+ **+30**
4. CHEESE staked in the faucet (`cheesecheese`): 100-4,999 **+8**, 5k-19,999 **+16**, 20k-49,999 **+24**, 50k+ **+32**
5. Liquidity provider, measured by total CHEESE held across all Alcor CHEESE pools: under 100 **+2**, 100-999 **+8**, 1k-4,999 **+16**, 5k-19,999 **+24**, 20k-49,999 **+32**, 50k+ **+40**. Add **+5** if the CHEESE sits in 2 or more different pools.
6. CHEESE NFT collector (`cheesenftwax` collection): 1-4 **+4**, 5-19 **+10**, 20-49 **+18**, 50+ **+25**
7. CHEESECrypt key age, measured from the account's first published key (a small reward for early users): under 30 days **+0**, 30 days-6 months **+3**, 6-12 months **+6**, 1 year or more **+10**. A key that was replaced keeps its first date. The key must still be published.
8. Local context (no network calls): published CHEESECrypt key **+10**, shared rooms **+5** each (up to +15), past conversation with you **+5**

## Strength marks
- Warning (under 10 points, or account under 7 days old)
- Low: 10-29
- Moderate: 30-59
- Good: 60-89
- Strong: 90+

If a signal can't be read (for example a node is down), it shows as "unknown" and is left out of the score. It is never counted as zero, and the badge says the score is partial.

## Wording and legal safety
- Use "strength" and "signals". Never use "verified", "trusted identity" or "safe".
- The breakdown always says: "Based on public blockchain data only. It does not confirm who someone is. Use your own judgement."
- No negative labels based on reports. This avoids defamation risk.
- The scores and weights are fixed and published in About, so nobody can claim the scoring is hidden or arbitrary.
- Nothing is stored centrally or put on-chain. Each viewer's device works out the score.

## Performance
- Signals load only when a badge is on screen.
- Cache times: name and age 24 hours; balance, stake, liquidity and NFTs 1 hour.
- All lookups use the existing endpoint-health ordering and fallback.

## Technical details
- `src/lib/cryptTrust.ts`: pure scoring functions with the tier tables above, plus `scoreTrust(signals)` that returns the total, the mark, a per-signal breakdown and a partial flag.
- `src/hooks/useCryptTrust.ts`: react-query fetchers:
  - age from `get_account.created`
  - balance from `cheeseburger::accounts` via `get_currency_balance`
  - faucet stake from the `cheesecheese::staketable` row for the account
  - Alcor CHEESE amounts per pool from the existing pooled-position helpers (owner index on the per-pool `positions` table, amounts sized from the pool's current price), summed across pools with the distinct pool count
  - NFT count from the AtomicAssets accounts API filtered by collection
  - key age from the earliest `CRYPTKEY1:` (or legacy `GPKMKEY1:`) memo the account authorized in its history (cache 24 hours)
  - local context from Messenger state
- `src/components/crypt/CryptTrustBadge.tsx` (compact badge) and `CryptTrustBreakdown.tsx` (popover), shown in `PublicInbox.tsx`, `PublicRooms.tsx` join requests and `CryptChatHeader.tsx`.
- A "Trust strength" entry in `CryptAbout.tsx` listing the weights.
- `src/test/cryptTrust.test.ts`: checks the tier edges for each signal (for example 99 vs 100 CHEESE, a 7-day-old account, 49,999 vs 50k pooled), the +5 bonus for 2 pools, the mark thresholds, that unknown signals are left out and set the partial flag, and the under-7-days Warning override.
- A rule added to `src/components/crypt/AGENTS.md` and a memory entry recording the weights.
