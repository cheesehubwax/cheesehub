import { useState, useEffect, useCallback } from 'react';
import { useWax } from '@/context/WaxContext';
import { useMusicNFTs, type StackedMusicNFT } from '@/hooks/useMusicNFTs';
import { useCheeseAmpPlaylist } from '@/hooks/useCheeseAmpPlaylist';
import { useCheeseAmpPlaylist } from '@/hooks/useCheeseAmpPlaylist';
import { getAudioPlayer, formatTime, type PlaybackState } from '@/lib/musicPlayer';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  Music2,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  Loader2,
  RefreshCw,
  List,
  Disc3,
  Plus,
  ListMusic,
  Trash2,
  Globe,
} from 'lucide-react';
import { MediaDisplay, VideoIndicator } from './MediaDisplay';

const IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://dweb.link/ipfs/',
];

function extractIpfsHash(url: string): string | null {
  if (!url) return null;
  if (url.startsWith('Qm') || url.startsWith('bafy')) return url;
  const match = url.match(/ipfs[:/]+(.+)/);
  return match ? match[1] : null;
}

interface CoverArtProps {
  src: string;
  alt: string;
  isPlaying: boolean;
}

function CoverArt({ src, alt, isPlaying }: CoverArtProps) {
  const [imgSrc, setImgSrc] = useState(src);
  const [gatewayIndex, setGatewayIndex] = useState(0);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setImgSrc(src);
    setGatewayIndex(0);
    setHasError(false);
  }, [src]);

  const handleError = () => {
    const hash = extractIpfsHash(src);
    if (hash && gatewayIndex < IPFS_GATEWAYS.length - 1) {
      const nextIndex = gatewayIndex + 1;
      setGatewayIndex(nextIndex);
      setImgSrc(`${IPFS_GATEWAYS[nextIndex]}${hash}`);
    } else {
      setHasError(true);
    }
  };

  if (hasError || !src) {
    return (
      <div className="w-full h-full bg-muted/50 flex items-center justify-center">
        <Disc3 className={cn(
          "h-4 w-4 text-cheese/50",
          isPlaying && "animate-spin"
        )} style={{ animationDuration: '3s' }} />
      </div>
    );
  }

  return (
    <img
      src={imgSrc}
      alt={alt}
      className="w-full h-full object-cover"
      onError={handleError}
    />
  );
}

export function CheeseAmpPlayer() {
  const { accountName, session } = useWax();
  const { nfts, stackedNfts, isLoading: isLoadingNfts, refetch } = useMusicNFTs();
  const [viewMode, setViewMode] = useState<'library' | 'playlists'>('library');

  const activeTracks = stackedNfts;
  const playlist = useCheeseAmpPlaylist(accountName, activeTracks);
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 0.8,
    isMuted: false,
    isLoading: false,
    error: null,
    isVideo: false,
    hasVideo: false,
  });
  const [showPlaylist, setShowPlaylist] = useState(true);
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const audioPlayer = getAudioPlayer();

  const handleCreatePlaylist = useCallback(() => {
    if (newPlaylistName.trim()) {
      playlist.createPlaylist(newPlaylistName.trim());
      setNewPlaylistName('');
      setShowCreatePlaylist(false);
    }
  }, [newPlaylistName, playlist]);

  const handleViewPlaylist = useCallback((playlistId: string) => {
    playlist.selectPlaylist(playlistId);
    setViewMode('library');
  }, [playlist]);

  const handleBackToLibrary = useCallback(() => {
    playlist.selectPlaylist('library');
    setViewMode('library');
  }, [playlist]);

  // Subscribe to playback state updates
  useEffect(() => {
    const unsubscribe = audioPlayer.subscribe(setPlaybackState);
    return unsubscribe;
  }, [audioPlayer]);

  // Sync with currently playing track when player is reopened
  useEffect(() => {
    const currentlyPlayingTrack = audioPlayer.getCurrentTrack();
    if (currentlyPlayingTrack && stackedNfts.length > 0) {
      const matchingTrack = stackedNfts.find(
        t => t.template_id === currentlyPlayingTrack.template_id
      );
      if (matchingTrack && playlist.currentTrack?.template_id !== matchingTrack.template_id) {
        playlist.playTrack(matchingTrack);
      }
    }
  }, [audioPlayer, stackedNfts, playlist]);

  const handlePlayTrack = useCallback(async (track: StackedMusicNFT) => {
    playlist.playTrack(track);
    try {
      await audioPlayer.play(track);
    } catch (error) {
      console.error('Failed to play track:', error);
    }
  }, [audioPlayer, playlist]);

  const handlePlayPause = useCallback(() => {
    if (playbackState.isPlaying) {
      audioPlayer.pause();
    } else if (playlist.currentTrack) {
      audioPlayer.resume();
    } else if (playlist.currentPlaylistTracks.length > 0) {
      handlePlayTrack(playlist.currentPlaylistTracks[0]);
    }
  }, [audioPlayer, playbackState.isPlaying, playlist, handlePlayTrack]);

  const handleNext = useCallback(async () => {
    const nextTrack = playlist.playNext();
    if (nextTrack) {
      try {
        await audioPlayer.play(nextTrack);
      } catch (error) {
        console.error('Failed to play next track:', error);
      }
    }
  }, [audioPlayer, playlist]);

  const handlePrevious = useCallback(async () => {
    if (playbackState.currentTime > 3) {
      audioPlayer.seek(0);
      return;
    }
    const prevTrack = playlist.playPrevious();
    if (prevTrack) {
      try {
        await audioPlayer.play(prevTrack);
      } catch (error) {
        console.error('Failed to play previous track:', error);
      }
    }
  }, [audioPlayer, playlist, playbackState.currentTime]);

  const handleSeek = useCallback((value: number[]) => {
    audioPlayer.seek(value[0]);
  }, [audioPlayer]);

  const handleVolumeChange = useCallback((value: number[]) => {
    audioPlayer.setVolume(value[0]);
    playlist.setVolume(value[0]);
  }, [audioPlayer, playlist]);

  const handleToggleMute = useCallback(() => {
    audioPlayer.toggleMute();
  }, [audioPlayer]);

  const handleToggleVideo = useCallback(async () => {
    try {
      await audioPlayer.switchMediaType(!playbackState.isVideo);
    } catch (error) {
      console.error('Failed to switch media type:', error);
    }
  }, [audioPlayer, playbackState.isVideo]);

  const handleToggleTheater = useCallback(() => {
    setIsTheaterMode(prev => !prev);
  }, []);

  // Handle ESC key to exit theater mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isTheaterMode) {
        setIsTheaterMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTheaterMode]);

  // Derived values
  const currentTrack = playlist.currentTrack;
  const progress = playbackState.duration > 0 
    ? (playbackState.currentTime / playbackState.duration) * 100 
    : 0;

  const isActiveLoading = isLoadingNfts;

  if (isActiveLoading && activeTracks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-cheese mb-3" />
        <p className="text-muted-foreground text-sm">
          Loading {viewMode === 'global' ? 'global' : 'music'} NFTs...
        </p>
      </div>
    );
  }

  if (stackedNfts.length === 0 && viewMode !== 'global') {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Music2 className="h-12 w-12 text-muted-foreground mb-3" />
        <p className="text-muted-foreground font-medium">No music NFTs found</p>
        <p className="text-xs text-muted-foreground mt-1 text-center">
          Collect music NFTs on WAX to play them here
        </p>
        <div className="flex gap-2 mt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={refetch}
            className="text-cheese hover:text-cheese"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setViewMode('global')}
            className="text-cheese hover:text-cheese"
          >
            <Globe className="h-4 w-4 mr-2" />
            Browse Global Library
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Music2 className="h-5 w-5 text-cheese" />
          <span className="font-bold text-lg">
            <span className="text-cheese">CHEESE</span>
            <span className="text-foreground">Amp</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {activeTracks.length} track{activeTracks.length !== 1 ? 's' : ''}
            {viewMode === 'global' && ' (Global)'}
          </span>
          {accountName && session && !isAnchorSession(session) && getBufferedPlayCount(accountName) > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs bg-cheese/20 text-cheese px-1.5 py-0.5 rounded-full cursor-help">
                    {getBufferedPlayCount(accountName)} pending
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Plays waiting to sync on-chain</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setShowPlaylist(!showPlaylist)}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={viewMode === 'global' ? refetchGlobal : refetch}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Player */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left: Now Playing */}
        <div className="flex flex-col w-64 shrink-0">
          {/* Cover Art / Video */}
          <div className="aspect-square rounded-lg overflow-hidden bg-muted/30 border border-border/50 mb-4">
            {currentTrack ? (
              <MediaDisplay
                coverArt={currentTrack.coverArt}
                videoUrl={currentTrack.videoUrl}
                alt={currentTrack.name}
                isPlaying={playbackState.isPlaying}
                isVideo={playbackState.isVideo}
                hasVideo={playbackState.hasVideo}
                onToggleVideo={handleToggleVideo}
                isTheaterMode={isTheaterMode}
                onToggleTheater={handleToggleTheater}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Disc3 className="h-16 w-16 text-cheese/30" />
              </div>
            )}
          </div>

          {/* Track Info */}
          <div className="mb-4 min-h-[48px]">
            {currentTrack ? (
              <>
                <h3 className="font-medium truncate text-sm">
                  {currentTrack.title || currentTrack.name}
                </h3>
                <p className="text-xs text-muted-foreground truncate">
                  {currentTrack.artist || currentTrack.collection}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Select a track to play</p>
            )}
          </div>

          {/* Progress Bar */}
          <div className="space-y-1 mb-4">
            <Slider
              value={[playbackState.currentTime]}
              max={playbackState.duration || 100}
              step={0.1}
              onValueChange={handleSeek}
              className="cursor-pointer"
              disabled={!currentTrack}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatTime(playbackState.currentTime)}</span>
              <span>{formatTime(playbackState.duration)}</span>
            </div>
          </div>

          {/* Transport Controls */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="flex flex-col items-center">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8",
                  playlist.shuffle && "text-cheese"
                )}
                onClick={playlist.toggleShuffle}
              >
                <Shuffle className="h-4 w-4" />
              </Button>
              <span className="text-[10px] text-cheese -mt-1">Shuffle</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={handlePrevious}
              disabled={!currentTrack && playlist.currentPlaylistTracks.length === 0}
            >
              <SkipBack className="h-5 w-5" />
            </Button>
            <Button
              variant="default"
              size="icon"
              className="h-11 w-11 rounded-full bg-cheese hover:bg-cheese/90 text-primary-foreground"
              onClick={handlePlayPause}
              disabled={playbackState.isLoading}
            >
              {playbackState.isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : playbackState.isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5 ml-0.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={handleNext}
              disabled={!currentTrack && playlist.currentPlaylistTracks.length === 0}
            >
              <SkipForward className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-8 w-8",
                playlist.repeat !== 'none' && "text-cheese"
              )}
              onClick={playlist.cycleRepeat}
            >
              {playlist.repeat === 'one' ? (
                <Repeat1 className="h-4 w-4" />
              ) : (
                <Repeat className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Volume Control */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={handleToggleMute}
            >
              {playbackState.isMuted || playbackState.volume === 0 ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
            <Slider
              value={[playbackState.isMuted ? 0 : playbackState.volume]}
              max={1}
              step={0.01}
              onValueChange={handleVolumeChange}
              className="flex-1"
            />
          </div>
        </div>

        {/* Right: Playlist/Library Panel */}
        {showPlaylist && (
          <div className="flex-1 min-w-0 border-l border-border/50 pl-4">
            {/* Tab Bar */}
            <div className="flex items-center gap-1 mb-3">
              <Button
                variant={playlist.currentPlaylistId === 'library' && viewMode === 'library' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 text-xs"
                onClick={handleBackToLibrary}
              >
                Library
              </Button>
              <Button
                variant={viewMode === 'playlists' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setViewMode('playlists')}
              >
                <ListMusic className="h-3 w-3 mr-1" />
                Playlists
              </Button>
              <Button
                variant={viewMode === 'global' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setViewMode('global')}
              >
                <Globe className="h-3 w-3 mr-1" />
                Global{globalStackedNfts.length > 0 ? ` (${globalStackedNfts.length})` : ''}
              </Button>
              
              {playlist.currentPlaylistId !== 'library' && viewMode === 'library' && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 text-xs"
                >
                  {playlist.playlists.find(p => p.id === playlist.currentPlaylistId)?.name}
                </Button>
              )}
            </div>

            {viewMode === 'playlists' ? (
              /* Playlists View */
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-muted-foreground">
                    {playlist.playlists.length} playlist{playlist.playlists.length !== 1 ? 's' : ''}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-cheese hover:text-cheese"
                    onClick={() => setShowCreatePlaylist(true)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Create
                  </Button>
                </div>
                <ScrollArea className="h-[460px]">
                  <div className="space-y-1 pr-2">
                    {playlist.playlists.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        <ListMusic className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No playlists yet</p>
                        <p className="text-xs mt-1">Create one to organize your tracks</p>
                      </div>
                    ) : (
                      playlist.playlists.map((p) => (
                        <ContextMenu key={p.id}>
                          <ContextMenuTrigger asChild>
                            <button
                              onClick={() => handleViewPlaylist(p.id)}
                              className={cn(
                                "w-full flex items-center gap-3 p-2 rounded-md text-left transition-colors hover:bg-muted/50",
                                playlist.currentPlaylistId === p.id && "bg-cheese/20"
                              )}
                            >
                              <div className="w-10 h-10 rounded bg-muted/30 flex items-center justify-center shrink-0">
                                <ListMusic className="h-5 w-5 text-cheese/70" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm truncate font-medium">{p.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {p.trackIds.length} track{p.trackIds.length !== 1 ? 's' : ''}
                                </p>
                              </div>
                            </button>
                          </ContextMenuTrigger>
                          <ContextMenuContent>
                            <ContextMenuItem
                              onClick={() => handleViewPlaylist(p.id)}
                            >
                              <Play className="h-4 w-4 mr-2" />
                              View Playlist
                            </ContextMenuItem>
                            <ContextMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => playlist.deletePlaylist(p.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Playlist
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            ) : (
              /* Library/Global Tracks View */
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-muted-foreground">
                    {playlist.currentPlaylistTracks.length} track{playlist.currentPlaylistTracks.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <ScrollArea className="h-[460px]">
                  <div className="space-y-1 pr-2">
                    {playlist.currentPlaylistTracks.map((track) => {
                      const isCurrentTrack = currentTrack?.asset_id === track.asset_id;
                      const isInLibrary = playlist.currentPlaylistId === 'library';
                      return (
                        <ContextMenu key={track.asset_id}>
                          <ContextMenuTrigger asChild>
                            <button
                              onClick={() => handlePlayTrack(track)}
                              className={cn(
                                "w-full flex items-center gap-3 p-2 rounded-md text-left transition-colors",
                                isCurrentTrack
                                  ? "bg-cheese/20 text-cheese"
                                  : "hover:bg-muted/50"
                              )}
                            >
                              <div className="w-10 h-10 rounded overflow-hidden bg-muted/30 shrink-0">
                                <CoverArt
                                  src={track.coverArt}
                                  alt={track.name}
                                  isPlaying={isCurrentTrack && playbackState.isPlaying}
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <p className={cn(
                                        "text-sm truncate font-medium",
                                        isCurrentTrack && "text-cheese"
                                      )}>
                                        {track.title || track.name}
                                      </p>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-[300px]">
                                      <p>{track.title || track.name}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <p className="text-xs text-muted-foreground truncate">
                                  {track.artist || track.collection}
                                </p>
                              </div>
                              <VideoIndicator hasVideo={track.hasVideo} />
                              {viewMode === 'global' && (
                                <Globe className="h-3 w-3 text-muted-foreground shrink-0" />
                              )}
                              {track.copies > 1 && (
                                <span className="text-xs bg-cheese/20 text-cheese px-1.5 py-0.5 rounded-full shrink-0">
                                  x{track.copies}
                                </span>
                              )}
                              {isCurrentTrack && playbackState.isPlaying && (
                                <div className="flex gap-0.5 items-end h-4">
                                  <span className="w-0.5 h-2 bg-cheese animate-pulse" style={{ animationDelay: '0ms' }} />
                                  <span className="w-0.5 h-3 bg-cheese animate-pulse" style={{ animationDelay: '150ms' }} />
                                  <span className="w-0.5 h-4 bg-cheese animate-pulse" style={{ animationDelay: '300ms' }} />
                                  <span className="w-0.5 h-2 bg-cheese animate-pulse" style={{ animationDelay: '450ms' }} />
                                </div>
                              )}
                            </button>
                          </ContextMenuTrigger>
                          <ContextMenuContent>
                            <ContextMenuItem onClick={() => handlePlayTrack(track)}>
                              <Play className="h-4 w-4 mr-2" />
                              Play
                            </ContextMenuItem>
                            {isInLibrary && playlist.playlists.length > 0 && (
                              <ContextMenuSub>
                                <ContextMenuSubTrigger>
                                  <Plus className="h-4 w-4 mr-2" />
                                  Add to Playlist
                                </ContextMenuSubTrigger>
                                <ContextMenuSubContent>
                                  {playlist.playlists.map(p => (
                                    <ContextMenuItem
                                      key={p.id}
                                      onClick={() => playlist.addToPlaylist(p.id, track.asset_id)}
                                    >
                                      {p.name}
                                    </ContextMenuItem>
                                  ))}
                                </ContextMenuSubContent>
                              </ContextMenuSub>
                            )}
                            {!isInLibrary && (
                              <ContextMenuItem
                                onClick={() => playlist.removeFromPlaylist(playlist.currentPlaylistId!, track.asset_id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Remove from Playlist
                              </ContextMenuItem>
                            )}
                          </ContextMenuContent>
                        </ContextMenu>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        )}

        {/* Create Playlist Dialog */}
        <Dialog open={showCreatePlaylist} onOpenChange={setShowCreatePlaylist}>
          <DialogContent className="sm:max-w-[320px]">
            <DialogHeader>
              <DialogTitle>Create Playlist</DialogTitle>
            </DialogHeader>
            <Input
              placeholder="Playlist name"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreatePlaylist()}
              autoFocus
            />
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowCreatePlaylist(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreatePlaylist}
                disabled={!newPlaylistName.trim()}
                className="bg-cheese hover:bg-cheese/90"
              >
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}