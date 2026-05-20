## Problems

1. **Black bars top/bottom on widescreen videos** — After switching `object-fit` from `cover` to `contain`, 16:9 videos correctly show their full frame inside the square (`aspect-square`) cover-art slot, which produces letterboxing. Visually awkward.
2. **Some videos don't show at all** — When the video element fails its first load, `play()` silently falls back to the audio element. `_mediaType` flips to `'audio'`, so `isVideo` becomes `false`, the video container unmounts, and the user sees only cover art while audio plays. There is no signal that video was attempted and failed.
3. **Endless loading / nothing plays** — `play()` has no request-token guard. If the user clicks a second track while the first is still in `tryGateways`/`setSrcAndPlay`, the older in-flight promise keeps running against the shared audio/video element. Its late `canplay`/`error`/timeout handlers mutate `_isLoading`, `_error`, and even call `element.play()` again, clobbering the newer load and sometimes leaving `_isLoading=true` forever.

## Fix

### 1. `src/lib/musicPlayer.ts` — request-token guard

Add a monotonic `_playToken` counter on `CheeseAmpMedia`. Each `play()` call captures its own token at the start. Every state mutation (`_isLoading`, `_error`, `notifyCallbacks`) and every continuation after an `await` checks `if (token !== this._playToken) return;` before mutating. Apply at these points:
- after `loadAndPlay` resolves or throws inside `play()`
- inside the audio-fallback branch (both success and inner catch)
- inside `tryGateways` success path (after `setSrcAndPlay` resolves)
- inside `tryGateways` sequential-fallback loop (each iteration)
- inside `tryGateways` final error path

This ensures only the most recent `play()` call can update player state, so stale failures from a superseded load can't strand the UI in "loading" or show a phantom error.

Also: in `setSrcAndPlay`, before assigning `element.src = url`, call `element.pause()` and remove any prior `canplay`/`error` listeners that may still be attached from a superseded call. (Track them on the element via a private symbol map, or just store the last pair in instance fields `_pendingCanPlay`/`_pendingError` per-element and detach them at the top of `setSrcAndPlay`.)

### 2. `src/lib/musicPlayer.ts` — preserve `hasVideo` after audio fallback

In the catch block of `play()` where we fall back to audio, keep `_hasVideo` true and set a new flag `_videoFailed = true`. Expose it on `PlaybackState`. This lets the UI show a small "video unavailable, playing audio" indicator instead of silently hiding the video affordance.

### 3. `src/components/music/MediaDisplay.tsx` — adapt to video aspect ratio

Replace the fixed square video container with one that uses the actual video aspect ratio:
- Add `onloadedmetadata` handling (via the audio player exposing the active video element, or a callback from `mountVideo`) to read `videoWidth` / `videoHeight`.
- Apply `aspectRatio: ${w} / ${h}` inline style to the video container when in non-theater mode, so widescreen videos render as a wide box (no top/bottom bars) and portrait videos render tall. The outer card already allows flex sizing in `CheeseAmpPlayer.tsx`'s left column (`w-64`), so width stays 256px and height adjusts.
- In theater mode keep `inset-0` full-screen with `object-fit: contain` (letterboxing only where the user's screen ratio differs — unavoidable and expected for fullscreen video).

Keep cover-art / front-art / back-art display in the existing square slot (only the video sub-view changes shape).

### 4. `src/components/music/MediaDisplay.tsx` — re-mount video on track change

`useEffect` deps are `[isVideo, showingArt]`, so when switching from one video track to another the singleton video element stays in place but no remount is triggered. If the element was detached or its src is stale, the new track's frame never appears. Add the current track's identifier (pass `currentTrack.asset_id` down as a prop, or read it from `audioPlayer.getCurrentTrack()` via subscription) to the deps and call `mountVideo` again on change.

## Verification

- Play a 16:9 music video → small player shows the full widescreen frame with no black bars; container is wider/shorter than the cover-art square.
- Play a portrait video → tall container, full frame visible.
- Theater mode → fullscreen with letterboxing only against the viewport edges as needed.
- Spam-click several different tracks rapidly → loading spinner clears on the final selection; no "Failed to load media" banner from earlier loads; final track plays.
- Play a track whose `videoUrl` is broken → audio still plays, and the UI shows a "video unavailable" hint instead of silently switching modes.

## Open question

For widescreen videos: do you want the small player container to **reshape** to the video's aspect ratio (no black bars, but the player's left column changes height per track), or stay a fixed square with letterboxing? The plan above assumes reshape — confirm before I implement.