# CHEESEDao rules

- Import DAO logic from `@/lib/dao` (stable entry point re-exporting daoModel, daoFees, daoActions, daoReads); keep transaction builders pure so `src/test/daoActions.test.ts` pins every signed action shape.
- Create DAO validation and transaction assembly live in `@/lib/daoCreate`; the screen only owns form state and toasts, so payment-leg order (fee, assertpoint, WAXDAO fee, createdao, optional setprofile) stays testable.
- DaoDetail owns data loading, refresh timing and vote handling; DaoInfoSection, DaoProposalList and DaoTreasurySection stay presentational.
- dao.waxdao::createdao requires proposal_cost in WAX; non-token DAOs use the "0,NULL"/"null" token sentinels.
- DAO chain reads use `resolveEndpoints('chain-api')` and AtomicAssets reads `fetchFromAtomicAPI`, never fixed host lists; NFT pictures go through `TreasuryNftImage` (shared AtomicHub→IPFS candidates) so dead gateways fall through.
- Create DAO with CHEESE but no CHEESE price falls back to the WAX fee legs (same as CHEESEFarm); never send createdao without a fee leg. Staked token weight is parsed from the asset string as integers, never float-multiplied.
- Members-only proposal teaser is a CHEESEHub display setting stored as a trailing `[cheese:members-teaser]` tag in the on-chain profile description (dao.waxdao has no config field); parse/apply via `@/lib/daoTeaser`, strip it before display, and always say chain data stays public.
- `dao.waxdao::claimvoteram` is only valid for type 5 ("Hold NFTs (Non-Custodial)") DAOs; gate the Claim Vote RAM tab and its action behind `canClaimVoteRam` so custodial DAOs never offer a request the contract rejects.
