import { create } from 'zustand';

interface CheeseAmpState {
  isMinimized: boolean;
  /** True once CHEESEAmp has been opened in this page session; gates the background NFT scan. */
  hasBeenOpened: boolean;
  setMinimized: (minimized: boolean) => void;
  markOpened: () => void;
}

export const useCheeseAmpStore = create<CheeseAmpState>()((set) => ({
  isMinimized: false,
  hasBeenOpened: false,
  setMinimized: (minimized) => set({ isMinimized: minimized }),
  markOpened: () => set({ hasBeenOpened: true }),
}));
