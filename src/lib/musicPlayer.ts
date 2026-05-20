import type { MusicNFT } from '@/hooks/useMusicNFTs';
import { IPFS_GATEWAYS, extractIpfsHash as sharedExtractIpfsHash } from '@/lib/ipfsGateways';

function extractIpfsHash(url: string): string | null {
  return sharedExtractIpfsHash(url);
}

export type RepeatMode = 'none' | 'one' | 'all';
export type MediaType = 'audio' | 'video';

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isLoading: boolean;
  error: string | null;
  isVideo: boolean;
  hasVideo: boolean;
}

type PlaybackCallback = (state: PlaybackState) => void;
type TrackEndCallback = () => void;

class CheeseAmpMedia {
  private audio: HTMLAudioElement;
  private video: HTMLVideoElement | null = null;
  private currentTrack: MusicNFT | null = null;
  private callbacks: Set<PlaybackCallback> = new Set();
  private trackEndCallbacks: Set<TrackEndCallback> = new Set();
  private _volume: number = 0.8;
  private _isMuted: boolean = false;
  private _isLoading: boolean = false;
  private _error: string | null = null;
  private _mediaType: MediaType = 'audio';
  private _hasVideo: boolean = false;
  private updateInterval: number | null = null;
  private videoContainer: HTMLElement | null = null;

  constructor() {
    this.audio = new Audio();
    this.audio.crossOrigin = 'anonymous';
    this.audio.volume = this._volume;

    this.setupMediaListeners(this.audio);

    // Start update interval for time updates
    this.updateInterval = window.setInterval(() => {
      const activeElement = this.getActiveElement();
      if (!activeElement.paused) {
        this.notifyCallbacks();
      }
    }, 250);
  }

  private setupMediaListeners(element: HTMLAudioElement | HTMLVideoElement) {
    element.addEventListener('play', () => this.notifyCallbacks());
    element.addEventListener('pause', () => this.notifyCallbacks());
    element.addEventListener('ended', () => {
      this.trackEndCallbacks.forEach(cb => cb());
      this.notifyCallbacks();
    });
    element.addEventListener('loadstart', () => {
      this._isLoading = true;
      this.notifyCallbacks();
    });
    element.addEventListener('canplay', () => {
      this._isLoading = false;
      this.notifyCallbacks();
    });
    element.addEventListener('error', () => {
      // Only surface element errors when this element is the active one.
      // Prevents a late-firing video error from clobbering state while audio
      // is playing via the fallback path.
      if (this.getActiveElement() !== element) return;
      this._error = 'Failed to load media';
      this._isLoading = false;
      this.notifyCallbacks();
    });
    element.addEventListener('durationchange', () => this.notifyCallbacks());
  }

  private getActiveElement(): HTMLAudioElement | HTMLVideoElement {
    return this._mediaType === 'video' && this.video ? this.video : this.audio;
  }

  getVideoElement(): HTMLVideoElement {
    if (!this.video) {
      this.video = document.createElement('video');
      this.video.crossOrigin = 'anonymous';
      this.video.playsInline = true;
      this.video.loop = false;
      this.video.volume = this._isMuted ? 0 : this._volume;
      this.setupMediaListeners(this.video);
    }
    return this.video;
  }

  mountVideo(container: HTMLElement): void {
    this.videoContainer = container;
    const video = this.getVideoElement();
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'cover';
    if (video.parentElement !== container) {
      container.appendChild(video);
    }
  }

  unmountVideo(): void {
    if (this.video && this.video.parentElement) {
      this.video.parentElement.removeChild(this.video);
    }
    this.videoContainer = null;
  }

  isVideoPlaying(): boolean {
    return this._mediaType === 'video';
  }

  getMediaType(): MediaType {
    return this._mediaType;
  }

  hasVideoAvailable(): boolean {
    return this._hasVideo;
  }

  private notifyCallbacks() {
    const state = this.getState();
    this.callbacks.forEach(cb => cb(state));
  }

  getState(): PlaybackState {
    const activeElement = this.getActiveElement();
    return {
      isPlaying: !activeElement.paused,
      currentTime: activeElement.currentTime || 0,
      duration: activeElement.duration || 0,
      volume: this._volume,
      isMuted: this._isMuted,
      isLoading: this._isLoading,
      error: this._error,
      isVideo: this._mediaType === 'video',
      hasVideo: this._hasVideo,
    };
  }

  subscribe(callback: PlaybackCallback): () => void {
    this.callbacks.add(callback);
    callback(this.getState());
    return () => this.callbacks.delete(callback);
  }

  onTrackEnd(callback: TrackEndCallback): () => void {
    this.trackEndCallbacks.add(callback);
    return () => this.trackEndCallbacks.delete(callback);
  }

  async play(track: MusicNFT, preferVideo = false, overrideAudioUrl?: string): Promise<void> {
    this._error = null;
    this._isLoading = true;
    this.currentTrack = track;
    this._hasVideo = !!(track.videoUrl || track.clipUrl);
    
    // Auto-detect video-only tracks: if no separate audio exists, default to video mode
    const isVideoOnly = !!(track.videoUrl && (!track.audioUrl || track.audioUrl === track.videoUrl));
    
    // If overrideAudioUrl is provided, always use audio mode
    const useVideo = !overrideAudioUrl && (preferVideo || isVideoOnly) && !!(track.videoUrl);
    this._mediaType = useVideo ? 'video' : 'audio';
    
    // Pause the other element
    if (useVideo) {
      this.audio.pause();
    } else if (this.video) {
      this.video.pause();
    }
    
    this.notifyCallbacks();

    const mediaUrl = overrideAudioUrl || (useVideo ? track.videoUrl! : track.audioUrl);
    const element = useVideo ? this.getVideoElement() : this.audio;
    
    try {
      await this.loadAndPlay(mediaUrl, element);
    } catch (e) {
      // If video element failed, try falling back to audio element with same URL
      if (useVideo && mediaUrl) {
        console.warn('[musicPlayer] Video element failed, trying audio fallback');
        this._mediaType = 'audio';
        try {
          await this.loadAndPlay(mediaUrl, this.audio);
          // Clear any error set by the failed video attempt so the UI
          // doesn't show a stale "Failed to load media" banner.
          this._error = null;
          this._isLoading = false;
          this.notifyCallbacks();
          return;
        } catch {
          // Fall through to error
        }
      }
      this._error = e instanceof Error ? e.message : 'Failed to load media';
      this._isLoading = false;
      this.notifyCallbacks();
    }
  }

  private async loadAndPlay(mediaUrl: string, element: HTMLAudioElement | HTMLVideoElement): Promise<void> {
    // Check if it's already a full URL
    if (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://')) {
      try {
        await this.setSrcAndPlay(element, mediaUrl);
        return;
      } catch (e) {
        // If direct URL fails and it's an IPFS gateway URL, try other gateways
        const hash = extractIpfsHash(mediaUrl);
        if (hash) {
          return this.tryGateways(hash, element);
        }
        throw e;
      }
    }

    // If it's an IPFS hash, try gateways
    const hash = extractIpfsHash(mediaUrl);
    if (hash) {
      return this.tryGateways(hash, element);
    }

    throw new Error('Invalid media URL');
  }

  private setSrcAndPlay(element: HTMLAudioElement | HTMLVideoElement, url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        element.removeEventListener('canplay', onCanPlay);
        element.removeEventListener('error', onError);
        // Don't reject — try to play anyway, browser may still be buffering
        element.play().then(resolve).catch(reject);
      }, 15000);

      const onCanPlay = () => {
        clearTimeout(timeout);
        element.removeEventListener('error', onError);
        element.play().then(resolve).catch(reject);
      };

      const onError = () => {
        clearTimeout(timeout);
        element.removeEventListener('canplay', onCanPlay);
        reject(new Error('Failed to load media'));
      };

      element.addEventListener('canplay', onCanPlay, { once: true });
      element.addEventListener('error', onError, { once: true });
      element.src = url;
      element.load();
    });
  }

  async switchMediaType(preferVideo: boolean): Promise<void> {
    if (!this.currentTrack) return;
    
    const currentTime = this.getActiveElement().currentTime;
    const wasPlaying = !this.getActiveElement().paused;
    
    await this.play(this.currentTrack, preferVideo);
    
    // Try to restore position
    const element = this.getActiveElement();
    if (element.readyState >= 1 && currentTime > 0) {
      element.currentTime = currentTime;
    }
    
    if (!wasPlaying) {
      element.pause();
    }
  }

  private async tryGateways(hash: string, element: HTMLAudioElement | HTMLVideoElement): Promise<void> {
    const TIMEOUT = 10000;
    
    // Race first 3 gateways with HEAD check
    const raceGateways = IPFS_GATEWAYS.slice(0, 3);
    let succeeded = false;
    
    const racePromise = new Promise<string>((resolve, reject) => {
      let failCount = 0;
      
      raceGateways.forEach((gateway, index) => {
        setTimeout(async () => {
          if (succeeded) return;
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);
          
          try {
            const url = `${gateway}${hash}`;
            const response = await fetch(url, { 
              method: 'HEAD',
              signal: controller.signal,
            });
            clearTimeout(timeoutId);
            
            if (response.ok && !succeeded) {
              succeeded = true;
              resolve(url);
            } else {
              failCount++;
              if (failCount >= raceGateways.length) reject(new Error('All racing gateways failed'));
            }
          } catch {
            clearTimeout(timeoutId);
            failCount++;
            if (failCount >= raceGateways.length) reject(new Error('All racing gateways failed'));
          }
        }, index * 150);
      });
    });

    try {
      const winningUrl = await racePromise;
      console.log(`[musicPlayer] Racing gateway won: ${winningUrl.split('/ipfs/')[0]}`);
      await this.setSrcAndPlay(element, winningUrl);
      this._error = null;
      this._isLoading = false;
      this.notifyCallbacks();
    } catch {
      console.warn('[musicPlayer] All racing gateways failed, trying remaining sequentially...');
      for (const gateway of IPFS_GATEWAYS.slice(3)) {
        try {
          await this.setSrcAndPlay(element, `${gateway}${hash}`);
          this._error = null;
          this._isLoading = false;
          this.notifyCallbacks();
          return;
        } catch {
          continue;
        }
      }
      this._error = 'Failed to load media from all gateways';
      this._isLoading = false;
      this.notifyCallbacks();
      throw new Error('Failed to load media from all gateways');
    }
  }

  resume(): void {
    const element = this.getActiveElement();
    if (element.src) {
      element.play().catch(console.error);
    }
  }

  pause(): void {
    this.getActiveElement().pause();
  }

  toggle(): void {
    const element = this.getActiveElement();
    if (element.paused) {
      this.resume();
    } else {
      this.pause();
    }
  }

  seek(time: number): void {
    const element = this.getActiveElement();
    if (element.readyState >= 1) {
      const duration = element.duration || 0;
      element.currentTime = Math.max(0, Math.min(time, duration || time));
      this.notifyCallbacks();
    }
  }

  setVolume(volume: number): void {
    this._volume = Math.max(0, Math.min(1, volume));
    const volumeValue = this._isMuted ? 0 : this._volume;
    this.audio.volume = volumeValue;
    if (this.video) this.video.volume = volumeValue;
    this.notifyCallbacks();
  }

  toggleMute(): void {
    this._isMuted = !this._isMuted;
    const volumeValue = this._isMuted ? 0 : this._volume;
    this.audio.volume = volumeValue;
    if (this.video) this.video.volume = volumeValue;
    this.notifyCallbacks();
  }

  getCurrentTrack(): MusicNFT | null {
    return this.currentTrack;
  }

  stop(): void {
    this.audio.pause();
    this.audio.currentTime = 0;
    if (this.video) {
      this.video.pause();
      this.video.currentTime = 0;
    }
    this.currentTrack = null;
    this._hasVideo = false;
    this._mediaType = 'audio';
    this.notifyCallbacks();
  }

  destroy(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    this.audio.pause();
    this.audio.src = '';
    if (this.video) {
      this.video.pause();
      this.video.src = '';
      this.unmountVideo();
    }
    this.callbacks.clear();
    this.trackEndCallbacks.clear();
  }
}

// Singleton instance
let mediaInstance: CheeseAmpMedia | null = null;

export function getAudioPlayer(): CheeseAmpMedia {
  if (!mediaInstance) {
    mediaInstance = new CheeseAmpMedia();
  }
  return mediaInstance;
}

export function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}