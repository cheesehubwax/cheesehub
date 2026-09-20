import { useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2, Play, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";
import tutorialCover from "@/assets/farm-tutorial.jpg.asset.json";

const VIDEO_ID = "PIV_ojHzkS8";
const VIDEO_URL = `https://www.youtube.com/watch?v=${VIDEO_ID}`;
const PLAYER_TIMEOUT_MS = 10_000;

type PlayerState = "cover" | "loading" | "ready" | "unavailable";

type YouTubePlayer = {
  destroy: () => void;
};

type YouTubePlayerConstructor = new (
  element: HTMLElement,
  options: {
    videoId: string;
    playerVars: Record<string, number>;
    events: {
      onReady: () => void;
      onError: () => void;
    };
  },
) => YouTubePlayer;

declare global {
  interface Window {
    YT?: { Player: YouTubePlayerConstructor };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApiPromise: Promise<YouTubePlayerConstructor> | undefined;

function loadYouTubeApi(): Promise<YouTubePlayerConstructor> {
  if (window.YT?.Player) return Promise.resolve(window.YT.Player);
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise((resolve, reject) => {
    const existingCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      existingCallback?.();
      if (window.YT?.Player) resolve(window.YT.Player);
      else reject(new Error("YouTube player API was unavailable"));
    };

    const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]');
    if (existingScript) return;

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => reject(new Error("YouTube player API failed to load"));
    document.head.appendChild(script);
  });

  return youtubeApiPromise;
}

export function FarmTutorialVideo() {
  const playerHostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer>();
  const [state, setState] = useState<PlayerState>("cover");

  useEffect(() => {
    if (state !== "loading") return;

    let active = true;
    const timeout = window.setTimeout(() => {
      if (active) setState("unavailable");
    }, PLAYER_TIMEOUT_MS);

    void loadYouTubeApi()
      .then((Player) => {
        if (!active || !playerHostRef.current) return;
        playerRef.current = new Player(playerHostRef.current, {
          videoId: VIDEO_ID,
          playerVars: { autoplay: 1, playsinline: 1, rel: 0 },
          events: {
            onReady: () => {
              if (!active) return;
              window.clearTimeout(timeout);
              setState("ready");
            },
            onError: () => {
              if (!active) return;
              window.clearTimeout(timeout);
              setState("unavailable");
            },
          },
        });
      })
      .catch(() => {
        if (!active) return;
        window.clearTimeout(timeout);
        setState("unavailable");
      });

    return () => {
      active = false;
      window.clearTimeout(timeout);
      playerRef.current?.destroy();
      playerRef.current = undefined;
    };
  }, [state]);

  const showCover = state !== "ready";

  return (
    <div className="space-y-3">
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted" data-testid="farm-tutorial-player">
        {state === "loading" || state === "ready" ? (
          <div ref={playerHostRef} className="absolute inset-0 h-full w-full" />
        ) : null}

        {showCover ? (
          <div className="absolute inset-0">
            <img
              src={tutorialCover.url}
              alt="WaxDAO V2 NFT Farms explained tutorial"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/35 p-4 text-center">
              {state === "cover" ? (
                <Button type="button" size="lg" onClick={() => setState("loading")} aria-label="Play farm creation tutorial">
                  <Play className="h-5 w-5 fill-current" />
                  Play tutorial
                </Button>
              ) : null}

              {state === "loading" ? (
                <div className="flex items-center gap-2 rounded-md bg-background/90 px-4 py-2 text-sm font-medium text-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading video…
                </div>
              ) : null}

              {state === "unavailable" ? (
                <div className="max-w-sm rounded-md border border-border bg-background/95 p-4">
                  <p className="mb-3 text-sm font-medium text-foreground">The YouTube player could not load here.</p>
                  <Button asChild>
                    <a href={VIDEO_URL} target="_blank" rel="noopener noreferrer">
                      <Youtube className="h-4 w-4" />
                      Watch on YouTube
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <Button asChild variant="link" className="h-auto p-0 text-destructive hover:text-destructive/80">
        <a href={VIDEO_URL} target="_blank" rel="noopener noreferrer">
          <Play className="h-4 w-4" />
          Watch on YouTube
          <ExternalLink className="h-3 w-3" />
        </a>
      </Button>
    </div>
  );
}