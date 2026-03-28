

## Add Flanking Emojis to All dApp Headings

### Problem
Three dApp pages are missing the emoji decorations on either side of their heading that the other pages already have.

### Pages to update

| Page | File | Emoji |
|------|------|-------|
| CHEESEFarm | `src/pages/Farm.tsx` | 🌱 |
| CHEESEDao | `src/pages/Dao.tsx` | 🏛️ |
| CHEESELock | `src/pages/Locker.tsx` | 🔐 |

### Pattern (already used by CHEESEDrop, CHEESEUp, CHEESENull, CHEESEDrip, CHEESEAds)
```tsx
<div className="flex items-center justify-center gap-2">
  <span className="text-2xl">🌱</span>
  <h1 ...>CHEESEFarm</h1>
  <Badge>BETA</Badge>
  <span className="text-2xl">🌱</span>
</div>
```

### Changes per file

**Farm.tsx** — Add `<span className="text-2xl">🌱</span>` before the h1 and after the Badge in the heading flex container.

**Dao.tsx** — Replace the `<Users>` icon after the Badge with `<span className="text-2xl">🏛️</span>`, and add matching `<span className="text-2xl">🏛️</span>` before the h1.

**Locker.tsx** — Wrap the h1 in a flex container with `<span className="text-2xl">🔐</span>` on each side (currently the heading has no wrapper div with flex/gap).

### Files changed: 3

