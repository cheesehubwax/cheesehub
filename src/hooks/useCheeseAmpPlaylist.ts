import { useCallback } from 'react';
import { useCheeseAmpStore, type MusicNFT } from '@/stores/cheeseAmpStore';

export function useCheeseAmpPlaylist() {
  const {
    playlist,
    currentIndex,
    isPlaying,
    volume,
    currentTrack,
    setPlaylist,
    setCurrentIndex,
    setIsPlaying,
    setVolume,
    clearPlaylist,
    addToPlaylist: storeAddToPlaylist,
    removeFromPlaylist: storeRemoveFromPlaylist,
    playNext,
    playPrevious,
    togglePlay,
  } = useCheeseAmpStore();

  const addToPlaylist = useCallback((track: MusicNFT) => {
    storeAddToPlaylist(track);
  }, [storeAddToPlaylist]);

  const removeFromPlaylist = useCallback((assetId: string) => {
    storeRemoveFromPlaylist(assetId);
  }, [storeRemoveFromPlaylist]);

  const playTrack = useCallback((index: number) => {
    if (index >= 0 && index < playlist.length) {
      setCurrentIndex(index);
      setIsPlaying(true);
    }
  }, [playlist.length, setCurrentIndex, setIsPlaying]);

  const nextTrack = useCallback(() => {
    playNext();
  }, [playNext]);

  const previousTrack = useCallback(() => {
    playPrevious();
  }, [playPrevious]);

  return {
    playlist,
    currentTrack,
    currentTrackIndex: currentIndex,
    isPlaying,
    volume,
    addToPlaylist,
    removeFromPlaylist,
    playTrack,
    nextTrack,
    previousTrack,
    togglePlay,
    setVolume,
    clearPlaylist,
    setPlaylist,
    setIsPlaying,
  };
}
