# CHEESEDao fixes

## 1. CHEESE payment falls back to WAX
If CHEESE is picked but the CHEESE price can't load, Create DAO will pay the normal 265 WAX fee instead, exactly like CHEESEFarm. Transactions will no longer go out without a fee. The success toast and button wording stay the same.

## 2. Voting power rounding
A staked amount like 12.3456 CHEESE will count as 123456 units, not 123455. Only the rounding changes.

## 3. Claim Vote RAM back on every DAO
Add a "Claim Vote RAM" item to the DAO page side menu for all DAO types. It opens the existing claim tool, which lists ended proposals with a Claim button for each. It shows only when a wallet is connected.

## 4. Shared live server health
CHEESEDao blockchain reads will use the shared live health-checked server order, with the same failover. The fixed list in CHEESEDao goes away.

## 5. Treasury NFT pictures
Treasury and staked NFT pictures will use the shared picture loader, which works through AtomicHub's resizer and then IPFS gateways. If one source fails it tries the next, and if all fail you see the blank placeholder. The staked NFT lookup will also use the shared AtomicAssets server list instead of one fixed server.

## Checks
- Update the existing tests: CHEESE-unavailable now gives WAX payment legs; 12.3456 gives 123456; reads use resolved endpoints; picture URLs come from the shared helper.
- Run all DAO tests, then open a real DAO in a test browser and confirm the Treasury NFT pictures load, the Claim Vote RAM item appears, and there are no errors.
- No real wallet transactions are signed.

## Technical details
- `daoCreate.ts`: change the WAX branch to `else if (i.waxdao.isAvailable)`, matching `farmCreate.ts`.
- `daoReads.ts` `fetchUserStakedTokens`: parse the integer and decimal parts of the asset string as integers (no float multiply).
- `daoReads.ts`: replace `DAO_RPC_ENDPOINTS` with `resolveEndpoints('chain-api')` inside `daoRpcFetch`; route the staked-asset fetch through `fetchFromAtomicAPI`.
- Treasury images: store the raw `img` value and render it through `useIpfsImageSrc`/`preferredIpfsImageUrl` in a small memoized tile in `DaoTreasurySection.tsx`.
- `DaoDetail.tsx`: add a `ram` section that renders the existing `ClaimVoteRam` (it's currently imported but unused). Update `src/components/dao/AGENTS.md`.
