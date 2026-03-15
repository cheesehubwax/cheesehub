

## Add Fart/Orb Sound Effects to Cheese Orbs

The original CHEESEHub has 14 sound files that play randomly when clicking the floating cheese orbs. The current implementation has the `playRandomFart()` function wired up to all orb clicks, but the sound array is empty.

### Sound Files Needed

From the original repo, there are 14 MP3 files:
- `src/assets/cheese-orb-sound.mp3`
- `src/assets/cheese-dao-orb-sound.mp3`
- `src/assets/cheese-null-orb-sound.mp3`
- `src/assets/cheese-up-orb-sound.mp3`
- `src/assets/farts/fart-01.mp3` through `fart-10.mp3`

### Plan

1. **Download all 14 MP3 files** from the original GitHub repo into `src/assets/` (4 orb sounds) and `src/assets/farts/` (10 fart sounds).

2. **Update `src/lib/fartSounds.ts`** to import all 14 sound files and populate the `FART_SOUNDS` array, matching the original implementation exactly.

No other changes needed — all orb `onClick` handlers already call `playRandomFart()`.

### Limitation

Lovable cannot download binary files (MP3s) from GitHub directly. You will need to either:
- Upload the 14 MP3 files manually from the original repo's `src/assets/` directory
- Or provide them so they can be added to the project

Once the files are in place, updating `fartSounds.ts` is a single-file change.

