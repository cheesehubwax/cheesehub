

## Replace Lucide Icons with Emojis Across CHEESEUp and CHEESENull

### Files and Replacements

**1. `src/components/powerup/PowerupStatsBar.tsx`**
- Remove `lucide-react` import entirely
- Replace icon references with emoji strings:
  - `Zap` (Total Powerups) → ⚡
  - `Flame` (WAX Burnt) → 🔥
  - `Flame` (CHEESE Nulled) → 🔥
- Change `statItems` to use `emoji: string` instead of `icon: Component`, render as `<span>`

**2. `src/components/powerup/PowerupLeaderboard.tsx`**
- Remove `Flame, Zap, Trophy, RefreshCw` from lucide import
- `SORT_OPTIONS` icons: `Flame` → 🔥, `Zap` → ⚡
- CHEESEBoard header: `Trophy` → 🏆
- Refresh button: `RefreshCw` → 🔄

**3. `src/components/powerup/PowerUpCard.tsx`**
- Remove `Zap, Cpu, Wifi, Loader2, CheckCircle` from lucide import
- CPU label icon: `Cpu` → 🖥️
- NET label icon: `Wifi` → 📡
- Power Up button: `Zap` → ⚡, `Loader2` spinner → ⏳
- Success dialog: `CheckCircle` → ✅, `Cpu` → 🖥️, `Wifi` → 📡

**4. `src/components/powerup/RecipientInput.tsx`**
- Remove `User, Check, X` from lucide import
- `User` → 👤
- `Check` → ✅
- `X` → ❌

**5. `src/components/powerup/ResourceEstimate.tsx`**
- Remove `Cpu, Wifi, Clock, TrendingUp, Loader2, AlertCircle, RefreshCw` from lucide import
- `Loader2` → ⏳, `AlertCircle` → ⚠️, `RefreshCw` → 🔄
- `Clock` → ⏰, `Cpu` → 🖥️, `Wifi` → 📡, `TrendingUp` → 📈

**6. `src/components/cheesenull/NullStats.tsx`**
- Remove `RefreshCw, Clock, CheckCircle, TrendingUp, Droplet, Zap` from lucide import
- `Droplet` (xCHEESE) → 💧, `Zap` (CheesePowerz) → ⚡, `TrendingUp` (Compound) → 📈
- `CheckCircle` (Ready) → ✅, `Clock` (Cooldown) → ⏰
- `RefreshCw` (Refresh) → 🔄

**7. `src/components/cheesenull/NullTotalStats.tsx`**
- Remove `TrendingUp, Droplet, Flame, Zap` from lucide import
- `Flame` → 🔥, `Droplet` → 💧, `Zap` → ⚡, `TrendingUp` → 📈

**8. `src/components/cheesenull/NullerLeaderboard.tsx`**
- Remove `Flame, Zap, Trophy, RefreshCw` from lucide import
- Same mapping as PowerupLeaderboard: `Flame` → 🔥, `Zap` → ⚡, `Trophy` → 🏆, `RefreshCw` → 🔄

**9. `src/components/cheesenull/NullButton.tsx`**
- Remove `Loader2` from lucide import
- Replace spinner with ⏳

### Implementation Notes
- Emojis render inline as `<span>` elements with appropriate sizing classes
- The `animate-spin` on RefreshCw/Loader2 won't apply to emojis — for refresh we just show 🔄 statically (or use `animate-spin` on the span if desired)
- All 9 files touched, no structural changes beyond icon→emoji swap

