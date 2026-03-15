import cheeseOrb from '@/assets/cheese-orb-sound.mp3';
import cheeseDaoOrb from '@/assets/cheese-dao-orb-sound.mp3';
import cheeseNullOrb from '@/assets/cheese-null-orb-sound.mp3';
import cheeseUpOrb from '@/assets/cheese-up-orb-sound.mp3';
import fart01 from '@/assets/farts/fart-01.mp3';
import fart02 from '@/assets/farts/fart-02.mp3';
import fart03 from '@/assets/farts/fart-03.mp3';
import fart04 from '@/assets/farts/fart-04.mp3';
import fart05 from '@/assets/farts/fart-05.mp3';
import fart06 from '@/assets/farts/fart-06.mp3';
import fart07 from '@/assets/farts/fart-07.mp3';
import fart08 from '@/assets/farts/fart-08.mp3';
import fart09 from '@/assets/farts/fart-09.mp3';
import fart10 from '@/assets/farts/fart-10.mp3';

const FART_SOUNDS: string[] = [
  cheeseOrb,
  cheeseDaoOrb,
  cheeseNullOrb,
  cheeseUpOrb,
  fart01,
  fart02,
  fart03,
  fart04,
  fart05,
  fart06,
  fart07,
  fart08,
  fart09,
  fart10,
];

export function playRandomFart() {
  if (FART_SOUNDS.length === 0) return;
  const src = FART_SOUNDS[Math.floor(Math.random() * FART_SOUNDS.length)];
  const audio = new Audio(src);
  audio.play().catch(() => {});
}
