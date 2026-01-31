import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface MusicNFT {
  asset_id: string;
  name: string;
  artist?: string;
  collection: string;
  image: string;
  audio_url?: string;
  video_url?: string;
  duration?: number;
}

export type RepeatMode = 'none' | 'one' | 'all';

interface CheeseAmpState {
  // Current track
  currentTrack: MusicNFT | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  
  // Playlist
  playlist: MusicNFT[];
  currentIndex: number;
  
  // Player state
  volume: number;
  isMuted: boolean;
  repeatMode: RepeatMode;
  isShuffled: boolean;
  
  // UI state
  isExpanded: boolean;
  isMiniPlayerVisible: boolean;
  
  // Actions
  setCurrentTrack: (track: MusicNFT | null) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setPlaylist: (tracks: MusicNFT[]) => void;
  setCurrentIndex: (index: number) => void;
  setVolume: (volume: number) => void;
  setIsMuted: (isMuted: boolean) => void;
  setRepeatMode: (mode: RepeatMode) => void;
  setIsShuffled: (isShuffled: boolean) => void;
  setIsExpanded: (isExpanded: boolean) => void;
  setIsMiniPlayerVisible: (visible: boolean) => void;
  
  // Playback controls
  play: (track?: MusicNFT) => void;
  pause: () => void;
  playNext: () => void;
  playPrevious: () => void;
  togglePlay: () => void;
  toggleMute: () => void;
  toggleRepeat: () => void;
  toggleShuffle: () => void;
  
  // Utility
  addToPlaylist: (track: MusicNFT) => void;
  removeFromPlaylist: (assetId: string) => void;
  clearPlaylist: () => void;
}

export const useCheeseAmpStore = create<CheeseAmpState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentTrack: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      playlist: [],
      currentIndex: -1,
      volume: 0.8,
      isMuted: false,
      repeatMode: 'none',
      isShuffled: false,
      isExpanded: false,
      isMiniPlayerVisible: false,

      // Setters
      setCurrentTrack: (track) => set({ currentTrack: track }),
      setIsPlaying: (isPlaying) => set({ isPlaying }),
      setCurrentTime: (time) => set({ currentTime: time }),
      setDuration: (duration) => set({ duration }),
      setPlaylist: (tracks) => set({ playlist: tracks }),
      setCurrentIndex: (index) => set({ currentIndex: index }),
      setVolume: (volume) => set({ volume }),
      setIsMuted: (isMuted) => set({ isMuted }),
      setRepeatMode: (mode) => set({ repeatMode: mode }),
      setIsShuffled: (isShuffled) => set({ isShuffled }),
      setIsExpanded: (isExpanded) => set({ isExpanded }),
      setIsMiniPlayerVisible: (visible) => set({ isMiniPlayerVisible: visible }),

      // Playback controls
      play: (track) => {
        const state = get();
        if (track) {
          // Find track in playlist or add it
          const existingIndex = state.playlist.findIndex(t => t.asset_id === track.asset_id);
          if (existingIndex >= 0) {
            set({
              currentTrack: track,
              currentIndex: existingIndex,
              isPlaying: true,
              isMiniPlayerVisible: true,
            });
          } else {
            set({
              currentTrack: track,
              playlist: [...state.playlist, track],
              currentIndex: state.playlist.length,
              isPlaying: true,
              isMiniPlayerVisible: true,
            });
          }
        } else if (state.currentTrack) {
          set({ isPlaying: true });
        }
      },

      pause: () => set({ isPlaying: false }),

      playNext: () => {
        const state = get();
        const { playlist, currentIndex, repeatMode, isShuffled } = state;

        if (playlist.length === 0) return;

        let nextIndex: number;

        if (isShuffled) {
          nextIndex = Math.floor(Math.random() * playlist.length);
        } else if (currentIndex < playlist.length - 1) {
          nextIndex = currentIndex + 1;
        } else if (repeatMode === 'all') {
          nextIndex = 0;
        } else {
          set({ isPlaying: false });
          return;
        }

        set({
          currentIndex: nextIndex,
          currentTrack: playlist[nextIndex],
          currentTime: 0,
        });
      },

      playPrevious: () => {
        const state = get();
        const { playlist, currentIndex, currentTime, repeatMode } = state;

        if (playlist.length === 0) return;

        // If more than 3 seconds into the track, restart it
        if (currentTime > 3) {
          set({ currentTime: 0 });
          return;
        }

        let prevIndex: number;
        if (currentIndex > 0) {
          prevIndex = currentIndex - 1;
        } else if (repeatMode === 'all') {
          prevIndex = playlist.length - 1;
        } else {
          set({ currentTime: 0 });
          return;
        }

        set({
          currentIndex: prevIndex,
          currentTrack: playlist[prevIndex],
          currentTime: 0,
        });
      },

      togglePlay: () => {
        const state = get();
        set({ isPlaying: !state.isPlaying });
      },

      toggleMute: () => {
        const state = get();
        set({ isMuted: !state.isMuted });
      },

      toggleRepeat: () => {
        const state = get();
        const modes: RepeatMode[] = ['none', 'all', 'one'];
        const currentModeIndex = modes.indexOf(state.repeatMode);
        const nextMode = modes[(currentModeIndex + 1) % modes.length];
        set({ repeatMode: nextMode });
      },

      toggleShuffle: () => {
        const state = get();
        set({ isShuffled: !state.isShuffled });
      },

      // Playlist management
      addToPlaylist: (track) => {
        const state = get();
        const exists = state.playlist.some(t => t.asset_id === track.asset_id);
        if (!exists) {
          set({ playlist: [...state.playlist, track] });
        }
      },

      removeFromPlaylist: (assetId) => {
        const state = get();
        const newPlaylist = state.playlist.filter(t => t.asset_id !== assetId);
        let newIndex = state.currentIndex;

        // Adjust current index if needed
        if (state.currentTrack?.asset_id === assetId) {
          if (newPlaylist.length === 0) {
            set({
              playlist: newPlaylist,
              currentTrack: null,
              currentIndex: -1,
              isPlaying: false,
            });
            return;
          }
          // Play next track
          newIndex = Math.min(state.currentIndex, newPlaylist.length - 1);
          set({
            playlist: newPlaylist,
            currentIndex: newIndex,
            currentTrack: newPlaylist[newIndex],
          });
        } else {
          // Adjust index if removing a track before current
          const removedIndex = state.playlist.findIndex(t => t.asset_id === assetId);
          if (removedIndex < state.currentIndex) {
            newIndex = state.currentIndex - 1;
          }
          set({
            playlist: newPlaylist,
            currentIndex: newIndex,
          });
        }
      },

      clearPlaylist: () => set({
        playlist: [],
        currentTrack: null,
        currentIndex: -1,
        isPlaying: false,
        isMiniPlayerVisible: false,
      }),
    }),
    {
      name: 'cheese-amp-storage',
      partialize: (state) => ({
        volume: state.volume,
        isMuted: state.isMuted,
        repeatMode: state.repeatMode,
        isShuffled: state.isShuffled,
      }),
    }
  )
);
