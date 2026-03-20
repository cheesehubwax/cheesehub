import { useEffect, useRef, useCallback } from 'react';
import { getAudioPlayer } from '@/lib/musicPlayer';
import { useMusicNFTs, type StackedMusicNFT } from '@/hooks/useMusicNFTs';
import type { RepeatMode } from '@/lib/musicPlayer';

const STORAGE_KEY_PREFIX = 'cheesehub_cheeseamp_';

interface PlaybackSettings {
  shuffle: boolean;
  repeat: RepeatMode;
  currentPlaylistId: string;
  playlists: { id: string; trackIds: string[] }[];
}

function loadSettings(accountName: string): PlaybackSettings {
  try {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}${accountName}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        shuffle: parsed.shuffle ?? false,
        repeat: parsed.repeat ?? 'none',
        currentPlaylistId: parsed.currentPlaylistId ?? 'library',
        playlists: parsed.playlists ?? [],
      };
    }
  } catch {
    // Ignore errors
  }
  return {
    shuffle: false,
    repeat: 'none',
    currentPlaylistId: 'library',
    playlists: [],
  };
}

/**
 * This hook manages auto-advancing to the next track when a song ends.
 * It should be mounted at a persistent level (e.g., WalletConnect) so it
 * continues working even when the CHEESEAmp dialog is minimized/closed.
 */
export function useCheeseAmpAutoAdvance(accountName: string | null) {
  const { stackedNfts } = useMusicNFTs();
  const shuffleOrderRef = useRef<number[]>([]);
  
  const getNextTrack = useCallback((): StackedMusicNFT | null => {
    if (!accountName || stackedNfts.length === 0) return null;
    
    const audioPlayer = getAudioPlayer();
    const currentTrack = audioPlayer.getCurrentTrack();
    if (!currentTrack) return null;
    
    const settings = loadSettings(accountName);
    
    let tracks: StackedMusicNFT[];
    if (settings.currentPlaylistId === 'library') {
      tracks = stackedNfts;
    } else {
      const playlist = settings.playlists.find(p => p.id === settings.currentPlaylistId);
      if (!playlist) {
        tracks = stackedNfts;
      } else {
        tracks = playlist.trackIds
          .map(id => stackedNfts.find(t => t.asset_id === id))
          .filter((t): t is StackedMusicNFT => t !== undefined);
      }
    }
    
    if (tracks.length === 0) return null;
    
    const currentIndex = tracks.findIndex(t => t.asset_id === currentTrack.asset_id);
    if (currentIndex === -1) return null;
    
    if (settings.repeat === 'one') {
      return tracks[currentIndex];
    }
    
    if (settings.shuffle) {
      if (shuffleOrderRef.current.length !== tracks.length) {
        const indices = Array.from({ length: tracks.length }, (_, i) => i);
        for (let i = indices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        shuffleOrderRef.current = indices;
      }
      
      const shuffleIndex = shuffleOrderRef.current.indexOf(currentIndex);
      const nextShuffleIndex = shuffleIndex + 1;
      
      if (nextShuffleIndex >= tracks.length) {
        if (settings.repeat === 'all') {
          const indices = Array.from({ length: tracks.length }, (_, i) => i);
          for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
          }
          shuffleOrderRef.current = indices;
          return tracks[shuffleOrderRef.current[0]];
        }
        return null;
      }
      
      return tracks[shuffleOrderRef.current[nextShuffleIndex]];
    }
    
    const nextIndex = currentIndex + 1;
    if (nextIndex >= tracks.length) {
      if (settings.repeat === 'all') {
        return tracks[0];
      }
      return null;
    }
    
    return tracks[nextIndex];
  }, [accountName, stackedNfts]);

  const getPreviousTrack = useCallback((): StackedMusicNFT | null => {
    if (!accountName || stackedNfts.length === 0) return null;
    
    const audioPlayer = getAudioPlayer();
    const currentTrack = audioPlayer.getCurrentTrack();
    if (!currentTrack) return null;
    
    const settings = loadSettings(accountName);
    
    let tracks: StackedMusicNFT[];
    if (settings.currentPlaylistId === 'library') {
      tracks = stackedNfts;
    } else {
      const playlist = settings.playlists.find(p => p.id === settings.currentPlaylistId);
      if (!playlist) {
        tracks = stackedNfts;
      } else {
        tracks = playlist.trackIds
          .map(id => stackedNfts.find(t => t.asset_id === id))
          .filter((t): t is StackedMusicNFT => t !== undefined);
      }
    }
    
    if (tracks.length === 0) return null;
    
    const currentIndex = tracks.findIndex(t => t.asset_id === currentTrack.asset_id);
    if (currentIndex === -1) return null;
    
    if (settings.shuffle && shuffleOrderRef.current.length === tracks.length) {
      const shuffleIndex = shuffleOrderRef.current.indexOf(currentIndex);
      const prevShuffleIndex = shuffleIndex - 1;
      
      if (prevShuffleIndex < 0) {
        if (settings.repeat === 'all') {
          return tracks[shuffleOrderRef.current[tracks.length - 1]];
        }
        return tracks[shuffleOrderRef.current[0]];
      }
      
      return tracks[shuffleOrderRef.current[prevShuffleIndex]];
    }
    
    const prevIndex = currentIndex - 1;
    if (prevIndex < 0) {
      if (settings.repeat === 'all') {
        return tracks[tracks.length - 1];
      }
      return tracks[0];
    }
    
    return tracks[prevIndex];
  }, [accountName, stackedNfts]);

  // Subscribe to track end events
  useEffect(() => {
    if (!accountName) return;
    
    const audioPlayer = getAudioPlayer();
    
    const unsubscribe = audioPlayer.onTrackEnd(() => {
      const nextTrack = getNextTrack();
      if (nextTrack) {
        audioPlayer.play(nextTrack).catch(console.error);
      }
    });
    
    return unsubscribe;
  }, [accountName, getNextTrack]);

  // Listen for skip next/previous events from mini player
  useEffect(() => {
    if (!accountName) return;
    
    const audioPlayer = getAudioPlayer();
    
    const handleSkipNext = () => {
      const nextTrack = getNextTrack();
      if (nextTrack) {
        audioPlayer.play(nextTrack).catch(console.error);
      }
    };
    
    const handleSkipPrevious = () => {
      const prevTrack = getPreviousTrack();
      if (prevTrack) {
        audioPlayer.play(prevTrack).catch(console.error);
      }
    };
    
    window.addEventListener('cheeseamp-skip-next', handleSkipNext);
    window.addEventListener('cheeseamp-skip-previous', handleSkipPrevious);
    
    return () => {
      window.removeEventListener('cheeseamp-skip-next', handleSkipNext);
      window.removeEventListener('cheeseamp-skip-previous', handleSkipPrevious);
    };
  }, [accountName, getNextTrack, getPreviousTrack]);
}