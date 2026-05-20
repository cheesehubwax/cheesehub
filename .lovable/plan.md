# Fix: CHEESEAmp shows "Failed to load media from all gateways" while track is playing

## Problem

When a music NFT plays, CHEESEAmp shows a red "Failed to load media from all gateways" banner — but the audio actually plays. Console confirms the pattern:

1. `Video element failed, trying audio fallback`
2. `All racing gateways failed, trying remaining sequentially...`
3. A later gateway succeeds and audio plays.

The error message from the failed attempts is never cleared, so the UI keeps displaying it.

## Root cause (in `src/lib/musicPlayer.ts`)

Three places leave `_error` set or re-set it after success:

1. `tryGateways` sets `this._error = 'Failed to load media from all gateways'` before throwing. When the caller (`play`) catches that and successfully falls back to the audio element, nothing clears `_error`.
2. `tryGateways` on success only clears `_isLoading`, not `_error` from a prior failed race.
3. The `'error'` event listener attached once in `setupMediaListeners` (line 72) sets `_error = 'Failed to load media'` whenever the video element errors — even after we've already switched to the audio element and started playing. That listener fires asynchronously and overwrites the cleared state.

## Fix (single file: `src/lib/musicPlayer.ts`)

1. In `tryGateways`, clear `this._error = null` on the successful path (both racing-win and sequential-fallback success) before calling `notifyCallbacks`.
2. In `play`, on the successful audio fallback after video failure, clear `this._error = null` and call `notifyCallbacks` so the UI drops the stale banner.
3. Make the shared `'error'` event listener context-aware: only set `_error` when the element that errored is the currently active element (`this.getActiveElement() === element`). This prevents a late-firing video error from clobbering state while audio is playing.

No behavior changes for genuine all-gateways failures — `_error` is still set and surfaced when every fallback path fails.

## Scope

- One file, presentation/logic of the media player only.
- No UI component changes, no contract or data changes.
- Verify by reloading CHEESEAmp, playing a track that previously triggered the warning, and confirming the error banner no longer appears while the track plays.
