import { useState, useRef, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Repeat, Shuffle, Minimize2, Music, X, List } from "lucide-react";
import { useCheeseAmpStore } from "@/stores/cheeseAmpStore";
import { useMusicNFTs } from "@/hooks/useMusicNFTs";
import { useWax } from "@/context/WaxContext";

export function CheeseAmpPlayer() {
  const { accountName } = useWax();
  const { musicNFTs, loading: nftsLoading } = useMusicNFTs(accountName || undefined);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);

  const {
    currentTrack, isPlaying, currentTime, duration, volume, isMuted,
    repeatMode, isShuffled, playlist, currentIndex, isMiniPlayerVisible,
    setCurrentTime, setDuration, setIsPlaying,
    play, pause, playNext, playPrevious, toggleMute, toggleRepeat, toggleShuffle,
    setVolume, setPlaylist, setIsMiniPlayerVisible, setIsExpanded,
  } = useCheeseAmpStore();

  // Listen for open event
  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener("open-cheese-amp", handleOpen);
    return () => window.removeEventListener("open-cheese-amp", handleOpen);
  }, []);

  // Load NFTs into playlist
  useEffect(() => {
    if (musicNFTs.length > 0 && playlist.length === 0) {
      const tracks = musicNFTs.map(nft => ({
        asset_id: nft.assetId,
        name: nft.name,
        artist: nft.artist,
        collection: nft.collectionName,
        image: nft.image,
        audio_url: nft.audio,
      }));
      setPlaylist(tracks);
    }
  }, [musicNFTs, playlist.length, setPlaylist]);

  // Audio element events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => setDuration(audio.duration || 0);
    const onEnded = () => {
      if (repeatMode === "one") {
        audio.currentTime = 0;
        audio.play();
      } else {
        playNext();
      }
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("ended", onEnded);
    };
  }, [repeatMode, playNext, setCurrentTime, setDuration]);

  // Play/pause sync
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack?.audio_url) return;

    if (audio.src !== currentTrack.audio_url) {
      audio.src = currentTrack.audio_url;
    }

    if (isPlaying) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [isPlaying, currentTrack]);

  // Volume sync
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const handleSeek = useCallback((value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  }, [setCurrentTime]);

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handlePlayTrack = (index: number) => {
    if (playlist[index]) {
      play(playlist[index]);
      setIsMiniPlayerVisible(true);
    }
  };

  return (
    <>
      <audio ref={audioRef} preload="metadata" />

      {/* Mini Player */}
      {isMiniPlayerVisible && currentTrack && !isOpen && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border/50 p-3">
          <div className="container flex items-center gap-4">
            <img
              src={currentTrack.image || "/placeholder.svg"}
              alt={currentTrack.name}
              className="h-12 w-12 rounded object-cover"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{currentTrack.name}</p>
              <p className="text-xs text-muted-foreground truncate">{currentTrack.artist || currentTrack.collection}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={playPrevious}><SkipBack className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => isPlaying ? pause() : play()}>
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={playNext}><SkipForward className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => setIsOpen(true)}><Minimize2 className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => { pause(); setIsMiniPlayerVisible(false); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Full Player Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Music className="h-5 w-5 text-primary" />
              CHEESEAmp
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Album Art */}
            <div className="aspect-square max-h-64 mx-auto rounded-xl overflow-hidden bg-muted/30">
              <img
                src={currentTrack?.image || "/placeholder.svg"}
                alt={currentTrack?.name || "No track"}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Track Info */}
            <div className="text-center">
              <p className="font-semibold text-foreground truncate">{currentTrack?.name || "No track selected"}</p>
              <p className="text-sm text-muted-foreground">{currentTrack?.artist || currentTrack?.collection || ""}</p>
            </div>

            {/* Progress */}
            <div className="space-y-1">
              <Slider
                value={[currentTime]}
                max={duration || 100}
                step={1}
                onValueChange={handleSeek}
                className="cursor-pointer"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-3">
              <Button variant="ghost" size="icon" onClick={toggleShuffle} className={isShuffled ? "text-primary" : ""}>
                <Shuffle className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={playPrevious}><SkipBack className="h-5 w-5" /></Button>
              <Button size="icon" className="h-12 w-12 rounded-full bg-primary text-primary-foreground" onClick={() => isPlaying ? pause() : play()}>
                {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-0.5" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={playNext}><SkipForward className="h-5 w-5" /></Button>
              <Button variant="ghost" size="icon" onClick={toggleRepeat} className={repeatMode !== "none" ? "text-primary" : ""}>
                <Repeat className="h-4 w-4" />
                {repeatMode === "one" && <span className="absolute text-[8px] font-bold">1</span>}
              </Button>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={toggleMute}>
                {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
              <Slider value={[isMuted ? 0 : volume]} max={1} step={0.01} onValueChange={(v) => setVolume(v[0])} className="flex-1" />
            </div>

            {/* Playlist Toggle */}
            <Button variant="outline" className="w-full" onClick={() => setShowPlaylist(!showPlaylist)}>
              <List className="h-4 w-4 mr-2" /> Playlist ({playlist.length})
            </Button>

            {showPlaylist && (
              <ScrollArea className="max-h-48">
                <div className="space-y-1">
                  {playlist.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {nftsLoading ? "Loading music NFTs..." : "No music NFTs found. Connect your wallet and ensure you have music NFTs."}
                    </p>
                  ) : (
                    playlist.map((track, i) => (
                      <div
                        key={track.asset_id}
                        className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${
                          i === currentIndex ? "bg-primary/10 text-primary" : "hover:bg-muted/30"
                        }`}
                        onClick={() => handlePlayTrack(i)}
                      >
                        <img src={track.image || "/placeholder.svg"} alt="" className="h-8 w-8 rounded object-cover" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{track.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{track.artist || track.collection}</p>
                        </div>
                        {i === currentIndex && isPlaying && <span className="text-xs">▶</span>}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
