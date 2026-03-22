

## Rename CHEESEShip → CHEESEDrop + sort official drops oldest-first

### Changes

**1. `src/components/Header.tsx` (line 19)**
- Change `label: "CHEESEShip"` → `label: "CHEESEDrop"`, `suffix: "Ship"` → `suffix: "Drop"`

**2. `src/pages/Index.tsx` (lines 182-195)**
- Replace all "CHEESEShip" / "Ship" text with "CHEESEDrop" / "Drop"

**3. `src/pages/Disclaimer.tsx` (lines 130-132)**
- Replace "CHEESEShip" with "CHEESEDrop"

**4. `src/pages/Terms.tsx` (line 97)**
- Replace "CHEESEShip" with "CHEESEDrop"

**5. `README.md` (line 8)**
- Replace "CHEESEShip" with "CHEESEDrop"

**6. `src/pages/Drops.tsx` (lines 34-42)**
- After filtering official drops, sort ascending by drop ID (oldest first):
  `.sort((a, b) => Number(a.id) - Number(b.id))`

### Files changed
6 files, all string replacements + one `.sort()` call

