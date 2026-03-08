// Fart/orb sound effects - plays a random sound when clicking orbs
// Note: Audio files would need to be added to src/assets/ for full functionality

const FART_SOUNDS: string[] = [];

export function playRandomFart() {
  if (FART_SOUNDS.length === 0) return;
  const src = FART_SOUNDS[Math.floor(Math.random() * FART_SOUNDS.length)];
  const audio = new Audio(src);
  audio.play().catch(() => {});
}
