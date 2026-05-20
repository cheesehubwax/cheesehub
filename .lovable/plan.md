# Fix: video clipped in CHEESEAmp player and theater mode

## Problem
When playing a music video in CHEESEAmp, portions of the video are cut off in both the small player view and the expanded/theater view.

## Root cause
In `src/lib/musicPlayer.ts`, `mountVideo()` sets the video element's `objectFit` to `'cover'`. Combined with the aspect-square small container and the fullscreen theater container, `cover` crops any video whose aspect ratio doesn't match the container — which is most music videos (typically 16:9 against a square / arbitrary screen).

```ts
video.style.objectFit = 'cover'; // crops the video
```

## Fix (one line, one file)
Change the video element's `object-fit` to `contain` so the whole frame is always visible (letterboxed against the black background that's already in place).

`src/lib/musicPlayer.ts` — `mountVideo`:
```ts
video.style.objectFit = 'contain';
```

The container in `MediaDisplay.tsx` already has `bg-black`, so letterbox bars look intentional. No change needed in `MediaDisplay.tsx`.

## Verification
- Play a 16:9 video NFT in the small player — full frame visible, black bars top/bottom.
- Enter theater mode — full frame visible, black bars on sides for ultrawide displays.
- Cover art display path is unaffected (uses `<img>` with its own classes).
