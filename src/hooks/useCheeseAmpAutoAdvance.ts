import { useEffect, useRef } from 'react';
import { useCheeseAmpPlaylist } from './useCheeseAmpPlaylist';

export function useCheeseAmpAutoAdvance(audioRef: React.RefObject<HTMLAudioElement>) {
  const { nextTrack, currentTrack, isPlaying, setIsPlaying } = useCheeseAmpPlaylist();
  const hasEndedRef = useRef(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      if (!hasEndedRef.current) {
        hasEndedRef.current = true;
        nextTrack();
        // Reset flag after a short delay
        setTimeout(() => {
          hasEndedRef.current = false;
        }, 100);
      }
    };

    const handlePlay = () => {
      setIsPlaying(true);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, [audioRef, nextTrack, setIsPlaying]);

  // Auto-play when track changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    if (isPlaying) {
      audio.play().catch(err => {
        console.warn('Auto-play blocked:', err);
      });
    }
  }, [audioRef, currentTrack, isPlaying]);

  return null;
}
