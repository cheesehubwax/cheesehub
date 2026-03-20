import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { StackedMusicNFT } from '@/hooks/useMusicNFTs';
import type { RepeatMode } from '@/lib/musicPlayer';
import { getAudioPlayer } from '@/lib/musicPlayer';

interface SavedPlaylist {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: number;
  updatedAt: number;
}

interface CheeseAmpState {
  currentPlaylistId: string | null;
  playlists: SavedPlaylist[];
  recentlyPlayed: string[];
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
}

const STORAGE_KEY_PREFIX = 'cheesehub_cheeseamp_';
const DEFAULT_PLAYLIST_ID = 'library';

function getStorageKey(accountName: string): string {
  return `${STORAGE_KEY_PREFIX}${accountName}`;
}

function getDefaultState(): CheeseAmpState {
  return {
    currentPlaylistId: DEFAULT_PLAYLIST_ID,
    playlists: [],
    recentlyPlayed: [],
    volume: 0.8,
    shuffle: false,
    repeat: 'none',
  };
}

function loadState(accountName: string): CheeseAmpState {
  try {
    const saved = localStorage.getItem(getStorageKey(accountName));
    console.debug('[CHEESEAmp] Loading state for', accountName, saved ? 'found' : 'not found');
    if (saved) {
      const parsed = JSON.parse(saved);
      console.log('[CHEESEAmp] Loaded', parsed.playlists?.length || 0, 'playlists');
      return parsed;
    }
  } catch (e) {
    console.error('[CHEESEAmp] Load error:', e);
  }
  return getDefaultState();
}

function saveState(accountName: string, state: CheeseAmpState): void {
  console.log('[CHEESEAmp] Saving', state.playlists?.length || 0, 'playlists for', accountName);
  try {
    localStorage.setItem(getStorageKey(accountName), JSON.stringify(state));
  } catch (e) {
    console.error('[CHEESEAmp] Save error:', e);
  }
}

export function useCheeseAmpPlaylist(accountName: string | null, allTracks: StackedMusicNFT[]) {
  const accountRef = useRef<string | null>(accountName);
  
  const [state, setState] = useState<CheeseAmpState>(() => 
    accountName ? loadState(accountName) : getDefaultState()
  );
  
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [shuffleOrder, setShuffleOrder] = useState<number[]>([]);

  // Wrapper that updates state AND immediately saves to localStorage
  const updateState = useCallback((updater: (prev: CheeseAmpState) => CheeseAmpState) => {
    setState(prev => {
      const next = updater(prev);
      if (accountRef.current) {
        saveState(accountRef.current, next);
      }
      return next;
    });
  }, []);

  // Load state when account changes
  useEffect(() => {
    accountRef.current = accountName;
    if (accountName) {
      const loadedState = loadState(accountName);
      setState(loadedState);
      console.log('[CHEESEAmp] Load complete for', accountName, '- playlists:', loadedState.playlists.length);
    } else {
      setState(getDefaultState());
    }
  }, [accountName]);

  // Sync with audio player's current track on mount/reopen
  useEffect(() => {
    if (allTracks.length === 0) return;
    
    const audioPlayer = getAudioPlayer();
    const playingTrack = audioPlayer.getCurrentTrack();
    
    if (playingTrack) {
      const index = allTracks.findIndex(t => t.asset_id === playingTrack.asset_id);
      if (index !== -1 && currentIndex !== index) {
        setCurrentIndex(index);
      }
    }
  }, [allTracks]);

  // Get current playlist tracks
  const currentPlaylistTracks = useMemo(() => {
    if (state.currentPlaylistId === DEFAULT_PLAYLIST_ID) {
      return allTracks;
    }
    const playlist = state.playlists.find(p => p.id === state.currentPlaylistId);
    if (!playlist) return allTracks;
    return playlist.trackIds
      .map(id => allTracks.find(t => t.asset_id === id))
      .filter((t): t is StackedMusicNFT => t !== undefined);
  }, [state.currentPlaylistId, state.playlists, allTracks]);

  // Generate shuffle order when tracks or shuffle mode changes
  useEffect(() => {
    if (state.shuffle && currentPlaylistTracks.length > 0) {
      const indices = Array.from({ length: currentPlaylistTracks.length }, (_, i) => i);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      setShuffleOrder(indices);
    }
  }, [state.shuffle, currentPlaylistTracks.length]);

  const currentTrack = useMemo(() => {
    if (currentIndex < 0 || currentIndex >= currentPlaylistTracks.length) {
      return null;
    }
    const actualIndex = state.shuffle && shuffleOrder.length > 0 
      ? shuffleOrder[currentIndex] 
      : currentIndex;
    return currentPlaylistTracks[actualIndex] || null;
  }, [currentIndex, currentPlaylistTracks, state.shuffle, shuffleOrder]);

  const playTrack = useCallback((track: StackedMusicNFT) => {
    const index = currentPlaylistTracks.findIndex(t => t.asset_id === track.asset_id);
    if (index !== -1) {
      if (state.shuffle && shuffleOrder.length > 0) {
        const shuffleIndex = shuffleOrder.indexOf(index);
        setCurrentIndex(shuffleIndex !== -1 ? shuffleIndex : 0);
      } else {
        setCurrentIndex(index);
      }
      updateState(prev => ({
        ...prev,
        recentlyPlayed: [
          track.asset_id,
          ...prev.recentlyPlayed.filter(id => id !== track.asset_id),
        ].slice(0, 50),
      }));
    }
  }, [currentPlaylistTracks, state.shuffle, shuffleOrder, updateState]);

  const playNext = useCallback(() => {
    if (currentPlaylistTracks.length === 0) return null;

    let nextIndex: number;

    if (state.repeat === 'one') {
      nextIndex = currentIndex;
    } else if (currentIndex >= currentPlaylistTracks.length - 1) {
      if (state.repeat === 'all') {
        nextIndex = 0;
      } else {
        return null;
      }
    } else {
      nextIndex = currentIndex + 1;
    }

    setCurrentIndex(nextIndex);
    const actualIndex = state.shuffle && shuffleOrder.length > 0 
      ? shuffleOrder[nextIndex] 
      : nextIndex;
    return currentPlaylistTracks[actualIndex] || null;
  }, [currentIndex, currentPlaylistTracks, state.repeat, state.shuffle, shuffleOrder]);

  const playPrevious = useCallback(() => {
    if (currentPlaylistTracks.length === 0) return null;

    let prevIndex: number;

    if (currentIndex <= 0) {
      if (state.repeat === 'all') {
        prevIndex = currentPlaylistTracks.length - 1;
      } else {
        prevIndex = 0;
      }
    } else {
      prevIndex = currentIndex - 1;
    }

    setCurrentIndex(prevIndex);
    const actualIndex = state.shuffle && shuffleOrder.length > 0 
      ? shuffleOrder[prevIndex] 
      : prevIndex;
    return currentPlaylistTracks[actualIndex] || null;
  }, [currentIndex, currentPlaylistTracks, state.repeat, state.shuffle, shuffleOrder]);

  const toggleShuffle = useCallback(() => {
    updateState(prev => ({ ...prev, shuffle: !prev.shuffle }));
  }, [updateState]);

  const setRepeat = useCallback((mode: RepeatMode) => {
    updateState(prev => ({ ...prev, repeat: mode }));
  }, [updateState]);

  const cycleRepeat = useCallback(() => {
    updateState(prev => {
      const modes: RepeatMode[] = ['none', 'all', 'one'];
      const currentModeIndex = modes.indexOf(prev.repeat);
      const nextMode = modes[(currentModeIndex + 1) % modes.length];
      return { ...prev, repeat: nextMode };
    });
  }, [updateState]);

  const setVolume = useCallback((volume: number) => {
    updateState(prev => ({ ...prev, volume: Math.max(0, Math.min(1, volume)) }));
  }, [updateState]);

  // Playlist management
  const createPlaylist = useCallback((name: string, trackIds: string[] = []) => {
    const id = `playlist_${Date.now()}`;
    const newPlaylist: SavedPlaylist = {
      id,
      name,
      trackIds,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    updateState(prev => ({
      ...prev,
      playlists: [...prev.playlists, newPlaylist],
    }));
    return id;
  }, [updateState]);

  const deletePlaylist = useCallback((playlistId: string) => {
    updateState(prev => ({
      ...prev,
      playlists: prev.playlists.filter(p => p.id !== playlistId),
      currentPlaylistId: prev.currentPlaylistId === playlistId 
        ? DEFAULT_PLAYLIST_ID 
        : prev.currentPlaylistId,
    }));
  }, [updateState]);

  const addToPlaylist = useCallback((playlistId: string, trackId: string) => {
    updateState(prev => ({
      ...prev,
      playlists: prev.playlists.map(p => 
        p.id === playlistId
          ? { ...p, trackIds: [...p.trackIds, trackId], updatedAt: Date.now() }
          : p
      ),
    }));
  }, [updateState]);

  const removeFromPlaylist = useCallback((playlistId: string, trackId: string) => {
    updateState(prev => ({
      ...prev,
      playlists: prev.playlists.map(p => 
        p.id === playlistId
          ? { ...p, trackIds: p.trackIds.filter(id => id !== trackId), updatedAt: Date.now() }
          : p
      ),
    }));
  }, [updateState]);

  const selectPlaylist = useCallback((playlistId: string) => {
    updateState(prev => ({ ...prev, currentPlaylistId: playlistId }));
    setCurrentIndex(-1);
  }, [updateState]);

  return {
    currentTrack,
    currentIndex,
    currentPlaylistTracks,
    playTrack,
    playNext,
    playPrevious,
    shuffle: state.shuffle,
    repeat: state.repeat,
    toggleShuffle,
    setRepeat,
    cycleRepeat,
    volume: state.volume,
    setVolume,
    playlists: state.playlists,
    currentPlaylistId: state.currentPlaylistId,
    createPlaylist,
    deletePlaylist,
    addToPlaylist,
    removeFromPlaylist,
    selectPlaylist,
    recentlyPlayed: state.recentlyPlayed,
  };
}