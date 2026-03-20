

## Disable Royalties & Global Account Until Contract Is Live

### Summary
The `cheeseamphub` account doesn't exist yet, so all royalty logging and global library fetching need to be disabled. CHEESEAmp becomes a personal NFT player only.

### Changes

**1. `src/lib/cheeseAmpRoyalties.ts`** — Add `ROYALTIES_ENABLED = false` flag. All exported functions (`logPlay`, `logPlayImmediate`, `bufferPlay`, `flushPlayBuffer`, `getBufferedPlayCount`) early-return as no-ops when disabled.

**2. `src/components/music/CheeseAmpPlayer.tsx`**
- Remove the `useMusicNFTs(CHEESEAMP_GLOBAL_ACCOUNT)` call (the account doesn't exist)
- Remove or hide the `'global'` view mode tab/option so users only see their own library and playlists
- Remove the `logPlay` call on line 189 (inside the `viewMode === 'global'` guard)
- Remove the "pending" buffered play count badge (lines 335-341)

**3. `src/components/WalletConnect.tsx`**
- Remove `handleTrackPlayed` callback and stop passing it to `useCheeseAmpAutoAdvance`
- Remove the `flushPlayBuffer` effect that fires when wallet opens
- Clean up unused imports from `cheeseAmpRoyalties`

**4. `src/hooks/useCheeseAmpAutoAdvance.ts`** — Remove the `onTrackPlayed` parameter and the royalty callback in the `onTrackEnd` handler. The hook just handles auto-advance, no play logging.

### Re-enabling later
When the contract and global account are live, flip `ROYALTIES_ENABLED` to `true` and restore the global view mode in CheeseAmpPlayer.

