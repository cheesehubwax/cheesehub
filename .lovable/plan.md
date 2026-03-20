

## On-Chain Playlist Saving (User Pays RAM)

### Overview
Add a "Save to Chain" feature so playlists persist on the WAX blockchain via the `cheeseamphub` contract. Local storage remains the default — on-chain saving is opt-in per playlist. On login, any on-chain playlists are fetched and merged into local state.

### New File: `src/lib/cheeseAmpOnChain.ts`
- **`savePlaylistOnChain(session, name, trackIds[])`** — builds a `saveplaylist` action on `cheeseamphub` with `ram_payer: user`
- **`deletePlaylistOnChain(session, name)`** — sends `delplaylist` action (reclaims RAM)
- **`fetchOnChainPlaylists(accountName)`** — reads `get_table_rows` from `cheeseamphub`, table `playlists`, scope = account, using the existing `fetchTableRows` from `waxRpcFallback.ts`
- Uses the existing `useWaxTransaction` pattern for signing
- Includes a `ONCHAIN_PLAYLISTS_ENABLED` flag (like `ROYALTIES_ENABLED`) — set to `false` initially if the contract actions aren't deployed yet

### Update: `src/hooks/useCheeseAmpPlaylist.ts`
- Add `syncStatus` per playlist: `'local' | 'synced' | 'saving' | 'error'`
- New state field `syncStatuses: Record<string, SyncStatus>`
- On account load: call `fetchOnChainPlaylists`, merge on-chain playlists into local state (on-chain data wins for name conflicts)
- Expose new callbacks:
  - `saveToChain(playlistId)` — takes the session, builds action, calls transaction
  - `removeFromChain(playlistId)` — deletes on-chain copy
- Return `syncStatuses` map and the new callbacks

### Update: `src/components/music/CheeseAmpPlayer.tsx`
- Import `Link2` / `Upload` / `Cloud` icons from lucide-react
- In the playlists list, add a small icon per playlist:
  - Local-only: faded chain icon + "Save to Chain" on context menu
  - Synced: green chain icon
  - Saving: spinner
- Context menu additions: "Save to Chain" and "Remove from Chain"
- Access `session` from `useWax()` (already imported) to pass to save/delete callbacks
- Disable save button with tooltip "Contract not yet live" when `ONCHAIN_PLAYLISTS_ENABLED = false`

### Contract Action Format (expected)
```text
saveplaylist {
  user: name           // authorization + ram_payer
  playlist_name: string
  asset_ids: uint64[]  // NFT asset IDs
}

delplaylist {
  user: name
  playlist_name: string
}

Table: playlists (scope = user account)
Row: { playlist_name: string, asset_ids: uint64[] }
```

### RAM Cost
~550 bytes for a 50-track playlist ≈ 0.03–0.06 WAX. User pays and reclaims on delete.

### Files
- `src/lib/cheeseAmpOnChain.ts` (new)
- `src/hooks/useCheeseAmpPlaylist.ts` (update)
- `src/components/music/CheeseAmpPlayer.tsx` (update)

