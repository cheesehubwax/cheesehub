

## Fix: Releases Stuck Loading (Spinning Forever)

### Root Cause
The music player's IPFS gateway racing strategy does HEAD requests with a 5-second timeout, then tries to call `element.play()`. For larger video files, this is too aggressive -- the HEAD may succeed but the actual media load/play fails, or all HEAD requests time out for slower gateways. When all gateways fail, `_isLoading` stays `true` and the spinner never stops because the error state doesn't properly clear the loading indicator in the UI.

Additionally, for video-only NFTs played as audio (fallback), the player tries to use the audio element with a video URL, which may fail if the browser can't extract audio from the format.

### Changes

**1. `src/lib/musicPlayer.ts` -- Improve gateway resilience**
- Increase the HEAD timeout from 5s to 10s
- Instead of HEAD-racing then playing, use a "set src and wait for canplay" approach as primary strategy -- this lets the browser handle buffering naturally
- Add a fallback: if video element fails, try audio element with the same URL (browsers can often play mp4 audio track via `<audio>`)
- Ensure `_isLoading = false` is always set in the catch path so the spinner stops and shows an error instead of spinning forever

**2. `src/components/music/CheeseAmpPlayer.tsx` -- Show error state instead of infinite spinner**
- When `playbackState.error` is set, show the error message with a "Retry" button instead of an infinite loading spinner
- This way users see feedback rather than an endless wheel

### Files
- `src/lib/musicPlayer.ts`
- `src/components/music/CheeseAmpPlayer.tsx`

