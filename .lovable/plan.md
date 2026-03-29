

## Universalise Tab Styling with Yellow Active Text

### Problem
Tabs across CHEESEFarm, CHEESEDao, CHEESEDrip, CHEESELock, and CHEESEDrop all use the default shadcn/ui tab styling — white text when active. They should use cheese-yellow for the active tab text and have a consistent look across all dApp pages.

### Solution
Update the shared `TabsTrigger` component in `src/components/ui/tabs.tsx` to use cheese-yellow text when active. This single change propagates to every tab usage site-wide — no per-page edits needed.

### Change

**`src/components/ui/tabs.tsx`** — Update `TabsTrigger` default classes:
- Replace `data-[state=active]:text-foreground` with `data-[state=active]:text-[hsl(var(--cheese))]`
- This makes all active tab text cheese-yellow instead of white
- Inactive tabs remain `text-muted-foreground` (unchanged)

### Scope
- **1 file changed**: `src/components/ui/tabs.tsx`
- Affects all 12+ files using tabs — no individual file edits required

