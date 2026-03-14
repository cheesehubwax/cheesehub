

## Fix DaoDetail: Match Original cheesehub Layout

### What's Wrong
The current DaoDetail renders as a **separate page with horizontal tabs** across the top. The original cheesehub uses:
1. A **Dialog overlay** (not a separate page) when clicking a DAO from Browse/MyDaos
2. A **left sidebar menu** with sections (Info, Stake, New Proposal, Active, Past, Treasury) instead of horizontal tabs
3. A **page mode** fallback for direct `/dao/:daoName` URL access that renders inline with the same sidebar layout
4. Vote tracking with localStorage persistence + blockchain merge via `voteStorage`

### Changes Required

**1. Rewrite `DaoDetail.tsx` (~900 lines) to match original exactly:**
- Props change: `{ dao?: DaoInfo; open?: boolean; onClose?: () => void; pageMode?: boolean; daoName?: string }` instead of `{ daoName: string; onBack: () => void }`
- Left sidebar navigation with `Section` type: `"info" | "stake" | "new-proposal" | "active" | "past" | "treasury"`
- Menu items with icons, badges (proposal counts), and unvoted indicators
- Dialog mode: wraps content in `<Dialog>` with `<ScrollArea>`
- Page mode: renders inline with same sidebar + content layout
- IPFS gateway fallback with index-based cycling (not find-based)
- Vote tracking: load from localStorage on mount, merge with blockchain votes, optimistic UI updates on vote
- Lazy treasury loading (only fetches when treasury section is selected)
- Creator/author permission checks for Edit Profile and Edit Proposal Cost
- Type 5 DAOs hide the Stake tab
- `handleVote` callback with optimistic proposal vote count updates + delayed background refresh

**2. Update `BrowseDaos.tsx`:**
- Remove `useNavigate` routing
- Instead, manage `selectedDao` state locally
- Render `<DaoDetail dao={selectedDao} open={!!selectedDao} onClose={() => setSelectedDao(null)} />` as a dialog overlay
- Filter to Type 4 & 5 DAOs only (matching original)

**3. Update `DaoCard.tsx` (~125 lines):**
- Remove `onClick` prop, no more navigation
- Richer card layout matching original: logo with IPFS gateway fallback, stats grid (threshold, vote duration), token/NFT info, proposal cost, created date, proposer type badge
- "View DAO" button that calls a callback or navigates

**4. Update `MyDaos.tsx`:**
- Same dialog pattern as BrowseDaos - open DaoDetail as dialog overlay on click

**5. Update `Dao.tsx` page:**
- When `daoName` param exists, render `<DaoDetail pageMode daoName={daoName} />` inline (not as separate page with `onBack`)
- Remove the `onBack` navigation pattern

**6. Update `ProposalCard.tsx`:**
- Accept `hasVoted`, `userVote`, `onVote` props to integrate with DaoDetail's vote tracking
- Pass vote data through from DaoDetail's `votedProposals` state

### Layout Structure (original)
```text
┌─────────────────────────────────────────┐
│  Dialog Header: Logo + Name + Badges    │
├────────────┬────────────────────────────┤
│  Sidebar   │  Content Area             │
│            │                           │
│  DAO Info  │  (renders active section) │
│  Stake     │                           │
│  New Prop  │                           │
│  Active(3) │                           │
│  Past (5)  │                           │
│  Treasury  │                           │
│            │                           │
└────────────┴────────────────────────────┘
```

### Key Behavioral Details
- Sidebar items highlight with `bg-primary/10` when active, show `ChevronRight` indicator
- Active proposals badge pulses/highlights when there are unvoted proposals
- Treasury loads lazily only when that section is first selected
- Vote persistence: localStorage saves immediately, blockchain fetch merges after 3s delay
- Dialog prevents close on interact outside (`onInteractOutside={e => e.preventDefault()}`)
- Edit Profile button visible to authors AND creator (not just creator)

