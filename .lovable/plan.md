## Fix

In theater mode, instead of `fixed inset-0` with a letterboxed `<video>`, center a container sized to the video's actual aspect ratio. The video fills that container exactly — no crop, no black bars around the frame. The area outside the container is a dimmed backdrop (click-to-exit).

### Changes

**`src/components/music/MediaDisplay.tsx`**
- When `isTheaterMode` is true, render a fixed full-viewport backdrop (`fixed inset-0 z-50 bg-black/90 flex items-center justify-center`) that is no longer the video container itself.
- Inside it, render the video container as a centered child with:
  - `max-w-[95vw] max-h-[95vh]`
  - `aspectRatio: String(videoAspectRatio ?? 16/9)` inline style
  - Width auto-derived: use `width: 95vw` capped by `max-h-[95vh]` via aspect-ratio (browsers handle this automatically with `aspect-ratio` + both max constraints).
- Keep `object-fit: contain` on the `<video>` (safe fallback before metadata loads, and identical to `fill` once container matches aspect).
- While `videoAspectRatio` is null (metadata not yet loaded), fall back to `16/9`.
- Move the hover controls overlay and ESC hint so they're positioned relative to the inner video container, not the full backdrop.
- Backdrop click (outside the video container) exits theater mode — wire to `onToggleTheater`. Stop propagation on the inner container so clicks on controls don't exit.

**No changes** to `src/lib/musicPlayer.ts` (keeps `objectFit = 'contain'`) or `CheeseAmpPlayer.tsx`.

### Result

- 16:9 video on any viewport → container is wide rectangle, no bars.
- Portrait video → container is tall rectangle, no bars.
- Square → square container.
- Backdrop fills the rest of the screen (dimmed), matching standard video-player theater UX.
