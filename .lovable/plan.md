

## 1:1 CHEESEDao Replica from bewbzz/cheesehub

### Summary of Gaps

The current DAO module is a simplified skeleton. The original has **~5,000 lines** of rich functionality across 14 files. Here is what needs to change:

**Missing Components (7 new files):**
- `ClaimVoteRam.tsx` (308 lines) — Reclaim RAM from past proposal votes
- `DaoStaking.tsx` (544 lines) — Token/NFT staking with stake/unstake UI per DAO type
- `EditDaoProfile.tsx` (140 lines) — Dialog for editing description, avatar, cover image, socials
- `EditProposalCost.tsx` (122 lines) — Dialog for editing proposal cost (creator only)
- `NFTVotePicker.tsx` (207 lines) — Pick eligible NFTs for Type 5 DAO voting
- `TreasuryDeposit.tsx` (245 lines) — Deposit tokens to DAO treasury
- `TreasuryNFTDeposit.tsx` (353 lines) — Deposit NFTs to DAO treasury with virtualized grid

**Major Rewrites (5 files):**

1. **`src/lib/dao.ts`** — Current: ~450 lines. Original: ~2,200 lines. Missing:
   - `fetchDaoProfiles()` (profiles table + socials)
   - `fetchUserDaos()` (staked tokens/NFTs + Type 5 NFT hold check)
   - `fetchTokenReceiversFromHyperion()` (Hyperion fallback for token transfer proposals)
   - Enhanced `fetchProposals()` with Hyperion fallback, inconclusive status, and better status logic
   - `fetchDaoTreasury()` (tokenvault table)
   - `fetchDaoTreasuryNFTs()` (nftvault + AtomicAssets API with fallback endpoints)
   - `fetchUserNFTs()`, `fetchVotedNFTs()`, `fetchUserStakedTokens()`, `fetchUserStakedNFTs()`, `fetchUserTokenBalance()`
   - `checkDaoMembership()`, `checkType4Registration()`
   - Build actions: `buildCreateDaoAction`, `buildSetProfileAction`, `buildSetProfileActionWithSocials`, `buildCreateProposalAction`, `buildMultiOptionProposalAction`, `buildRankedChoiceProposalAction`, `buildTokenTransferProposalAction`, `buildNFTTransferProposalAction`, `buildVoteAction` (enhanced), `buildMultiOptionVoteAction`, `buildRankedChoiceVoteAction`, `buildStakeTokenActions`, `buildUnstakeTokenAction`, `buildStakeNFTAction`, `buildUnstakeNFTAction`, `buildTokenDepositAction`, `buildDepositToTreasuryAction`, `buildNFTDepositAction`, `buildDepositNFTToTreasuryAction`, `buildRegisterForBalanceVotingAction`, `buildRecountProposalAction`, `buildJoinDaoAction`, `buildLeaveDaoAction`
   - Fee constant update: `265.00000000 WAX`

2. **`src/components/dao/DaoDetail.tsx`** — Current: 200 lines (simple tabs). Original: 894 lines with:
   - Sidebar navigation (Info, Stake, New Proposal, Active, Past, Treasury sections)
   - Page mode + Dialog mode support
   - DAO profile display with IPFS gateway fallback for logos/covers
   - Membership check and member badge
   - Social links (Twitter, Discord, Telegram, Website, YouTube, Medium, AtomicHub, WaxDAO)
   - Edit Profile and Edit Proposal Cost dialogs (creator-only)
   - Treasury section with token balances, NFT display, deposit forms
   - Vote tracking with localStorage persistence and blockchain merge
   - Proposal creation permissions based on proposer_type and membership

3. **`src/components/dao/ProposalCard.tsx`** — Current: 153 lines (basic Yes/No/Abstain). Original: 968 lines with:
   - All 5 voting types: Yes/No/Abstain, Most Votes Wins, Ranked Choice, Token Transfer, NFT Transfer
   - NFTVotePicker integration for Type 5 DAOs
   - Staked weight display and auto-fetch
   - Vote weight calculation based on DAO type
   - Finalize + Recount actions
   - Claim Vote RAM inline
   - Rich vote visualization with progress bars per choice
   - Expandable description
   - Token/NFT transfer details display

4. **`src/components/dao/CreateDao.tsx`** — Current: 150 lines (basic). Original: 567 lines with:
   - All 5 DAO types with type-specific configuration
   - Gov schemas (collection + schema pairs) for NFT-based DAOs
   - Radio group for DAO type selection with descriptions
   - Collapsible advanced settings
   - Profile setup (description, avatar IPFS, cover image)
   - Social links setup in creation flow
   - CHEESE fee payment integration (`useWaxdaoFeePricing`)
   - Inline help tooltips and FAQ accordion
   - Auto-scroll to anchor sections

5. **`src/components/dao/CreateProposal.tsx`** — Current: 95 lines (basic). Original: 273 lines with:
   - 5 proposal types: Yes/No/Abstain, Token Transfer, Most Votes, Ranked Choice, NFT Transfer
   - Token transfer form (recipient, amount, token selector from WAX_TOKENS)
   - NFT transfer form (recipient, select NFTs from treasury)
   - Custom choices management (add/remove options)
   - Proposal cost display and payment

**Minor Updates (4 files):**
- `BrowseDaos.tsx` — Filter to Type 4 & 5 DAOs only, use `useNavigate` instead of callback
- `DaoCard.tsx` — IPFS gateway fallback, `useNavigate` for routing, richer display
- `MyDaos.tsx` — Use `fetchUserDaos()` instead of filtering all DAOs
- `Dao.tsx` (page) — Route-based DAO detail (`/dao/:daoName`), updated hero

**Routing:**
- Add `/dao/:daoName` route in `App.tsx` for direct DAO links

### Implementation Order

1. **`src/lib/dao.ts`** — Complete rewrite to match original (all functions, types, interfaces)
2. **7 new components** — Create all missing components from original source
3. **5 component rewrites** — DaoDetail, ProposalCard, CreateDao, CreateProposal, BrowseDaos, DaoCard, MyDaos
4. **`src/pages/Dao.tsx`** — Update page with routing support
5. **`src/App.tsx`** — Add `/dao/:daoName` route

