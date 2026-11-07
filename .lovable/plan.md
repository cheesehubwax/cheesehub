# CHEESECrypt Trust Badge (multi-signal)

## Goal
When a stranger messages you, a join request arrives, or you open a chat with a non-friend, show a small trust card. It gives a strength mark (e.g. Low / Some / Good / Strong) and a list of the reasons. Every reason is a public fact you can check on-chain. The card informs you and never blocks anyone.

## Where it shows
- Public inbox stranger requests (next to Accept / Decline / Block)
- Room join requests (owner/admin alert, toast and chat card)
- Direct chat header banner for non-friends
- Compact badge (mark + emoji) beside names; click it for the full card

## Signals (points)
Your idea:
- 🧀 **CHEESE premium name**: the account is a `.cheese` / `.chz` name (only you can create these, so it is a strong signal). Highest weight.

Extra ideas:
1. ⏳ **Account age**: tiered (under 7 days is a red flag, then 30 days, 1 year, 3+ years).
2. 🔐 **Anchor key-lock**: a published CHEESECrypt key that is locked and verified.
3. 🤝 **Mutual friends**: how many of your friends have this account in their own friends lists, if your local data shows it. Otherwise it counts the groups you share.
4. 👥 **Shared groups/rooms**: the number of CG2 rooms you are both members of.
5. 💬 **Your history**: past conversations between you, and how many messages you have exchanged.
6. 🧀 **CHEESE holder**: holds CHEESE, tiered by balance.
7. 🔒 **Long-term commitment**: has CHEESE locks or vesting (CHEESELock / CHEESEDrip).
8. 🗳️ **CHEESEDao participation**: has voted or made proposals.
9. 🔥 **Nulled CHEESE**: has nulled CHEESE or paid Crypt fees (it costs money to fake).
10. 🏠 **Room founder**: owns a public room that appears on Discover (curated).
11. 🖼️ **NFT collector**: owns NFTs from CHEESE collections.
12. ⚡ **Resource staker**: has WAX staked or powered up, meaning a real, active account.
13. 📅 **On-chain activity**: total actions or days active, which separates real accounts from fresh accounts made for a single message.
14. 🛡️ **Admin-vouched**: a cheesebannad admin publishes a public `CRYPTVOUCH1:` memo on the eosio.null fee leg. It works the same way as Discover curation. Newest memo wins and it can be revoked.

Negative flags (shown in red, which subtract points):
- Account is younger than 7 days
- You blocked them before, or they are in your blocked list
- Banned from a room you share, by that room's owner
- Reported by CRYPTREPORT1: room reports, counted only (no free text)
- A key change was recently published (safety number changed)

## Scoring
- Fixed, published weights with no hidden algorithm. The card shows every line item and how many points it adds.
- Thresholds set the mark. The weights live in one file so you can tune them later.
- A premium .cheese/.chz name or an admin vouch alone can reach "Good". Getting to "Strong" needs age plus at least one other signal.

## Data and performance
- All data is read-only chain lookups through resolveEndpoints() with fallbacks, cached through react-query (24h for age and name, 1h for balances and activity).
- Lookups are lazy: they run only when a card or badge becomes visible. A signal that can't be fetched shows as "unknown" and never counts as zero or negative.
- Nothing about the user is stored centrally and nothing new is written on-chain, apart from the optional admin vouch memos.

## Legal and liability notes (flagged)
- Wording: use "signals" and "strength", never "verified identity", "safe" or "trusted person". That avoids an implied guarantee and any KYC/identity-verification claims.
- A negative flag based on reports could be read as reputational labelling (defamation risk). Show only counts, with fixed wording ("reported N times by room members"), and no public scoreboard. The card appears only on the viewer's own screen.
- Admin vouching is a public endorsement made by you. Add a disclaimer that it is not a guarantee. Consider skipping it if you'd rather not be the one vouching.
- A full disclaimer goes in the About/Terms.

## Technical details
- `src/lib/cryptTrust.ts`: pure signal collection and scoring (weights, thresholds, unknown handling). Unit tests cover premium-name detection (`.cheese`/`.chz` suffix), the age tiers, the cap where unknown never counts as negative, and the mark thresholds.
- `src/hooks/useCryptTrust.ts`: per-account react-query fetchers (get_account `created`, CHEESE balance, lock and vesting tables, Hyperion action counts, DAO votes, AtomicAssets collections).
- `src/components/crypt/TrustBadge.tsx` and `TrustCard.tsx`: presentational only. Messenger supplies local signals (friends, groups, blocks, history).
- Optional `CRYPTVOUCH1:` reader, which reuses the CRYPTHIDE1 admin-memo pipeline, plus a management page on /admin.
- AGENTS.md rule and memory entry for the trust badge.

## Questions to confirm during build
- Should the admin vouch (#14) be included?
- Should the negative report flag be included?
