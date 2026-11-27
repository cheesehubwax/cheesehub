# CHEESEWallet rules

- Alcor farm logic lives in `src/lib/alcor/*` (constants, types, parse, chain, reads, actions, time) behind the stable `src/lib/alcorFarms.ts` entry point; import from the entry point so callers never depend on the split.
- Pure resource/account helpers live in `src/lib/walletResources.ts` (re-exported by `WalletResources.tsx`) so figures stay testable without rendering.
- Screens own state and transactions; cards in `wallet/alcor/` are presentational, memoized, and receive stable `useCallback` handlers.
- Wallet chain reads take their order from `resolveEndpoints()`, never a local server list; NFT/pack images use the shared `IpfsImage` with a base-path-aware fallback so GitHub Pages resolves it.
- Dialog pieces live beside their screen: `wallet/alcor/` (Compound/Create Farm rows, pickers, pure `createFarm.ts`/`compoundBalances.ts`) and `wallet/transfer/` (sidebar, balances grid, send form); the dialog keeps the form state so entries survive switching sections.
- The pre-mounted transfer dialog reads token balances only while open, so page loads (including /crypt) never send account-named balance scans.
