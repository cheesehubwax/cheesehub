import { create } from 'zustand';

interface CheeseAmpState {
  isMinimized: boolean;
  setMinimized: (minimized: boolean) => void;
}

export const useCheeseAmpStore = create<CheeseAmpState>()((set) => ({
  isMinimized: false,
  setMinimized: (minimized) => set({ isMinimized: minimized }),
}));