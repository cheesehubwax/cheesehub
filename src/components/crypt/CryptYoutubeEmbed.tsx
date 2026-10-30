import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { getAudioPlayer } from '@/lib/musicPlayer';
import { announcePlaying, CRYPT_NOW_PLAYING } from '@/lib/cryptAudio';
import { embedUrl, nextPrivateMirror, PRIVATE_YOUTUBE_MIRRORS, privateThumbnailUrl, privateVideoUrl, type YoutubeLink } from '@/lib/cryptYoutube';

/** No remote image, probe or iframe before the reader taps play or "Preview picture"; failures never silently connect to Google. */
export function CryptYoutubeEmbed({ link }: { link: YoutubeLink }) {
  const [selection, setSelection] = useState<number | 'direct' | null>(null);
  const [warn, setWarn] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [thumb, setThumb] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  const playerDialog = useRef<HTMLDialogElement>(null);
  const source = `crypt-youtube-${useId()}`;
  const titleId = useId();
  const playing = selection !== null;
  const mirror = PRIVATE_YOUTUBE_MIRRORS[typeof selection === 'number' ? selection : 0];

  // The browser's top layer expands the SAME dialog and iframe without moving
  // either DOM node. Reparenting even an existing iframe reloads its document.
  useLayoutEffect(() => {
    const dialog = playerDialog.current;
    if (!dialog || !playing) return;
    dialog.close();
    if (expanded) dialog.showModal();
    else dialog.show();
  }, [expanded, playing]);

  useEffect(() => {
    const stop = (event: Event) => {
      if ((event as CustomEvent).detail !== source) setSelection(null);
    };
    window.addEventListener(CRYPT_NOW_PLAYING, stop);
    const unsubscribe = getAudioPlayer().subscribe(state => { if (state.isPlaying) setSelection(null); });
    return () => { window.removeEventListener(CRYPT_NOW_PLAYING, stop); unsubscribe(); };
  }, [source]);
  useEffect(() => { if (selection === null) setExpanded(false); }, [selection]);
  useEffect(() => { setSelection(null); setWarn(false); setThumb(false); setThumbFailed(false); }, [link.id, link.start]);

  const play = (choice: number | 'direct') => {
    getAudioPlayer().pause();
    announcePlaying(source);
    setWarn(false);
    setSelection(choice);
  };
  const src = selection === 'direct' ? embedUrl(link, 'direct') : privateVideoUrl(link, mirror, true);

  const frame = (
    <iframe key={src} src={src} title={link.title ?? `Video ${link.id}`} className="aspect-video w-full rounded"
      allow="autoplay; encrypted-media; picture-in-picture" referrerPolicy="no-referrer"
      sandbox="allow-scripts allow-same-origin allow-presentation" />
  );

  return (
    <div className="my-1 w-96 max-w-full rounded-md border border-border bg-background/60 p-1" onContextMenu={e => e.stopPropagation()}>
      {selection !== null ? (
        <>
          {expanded && <div className="flex aspect-video w-full items-center justify-center rounded bg-muted text-xs text-muted-foreground">⛶ Playing in expanded view</div>}
          <dialog ref={playerDialog} aria-labelledby={expanded ? titleId : undefined}
            aria-label={expanded ? undefined : (link.title ?? 'YouTube video')}
            className={expanded
              ? 'fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-3xl max-h-[90dvh] overflow-y-auto rounded-lg border border-border bg-background p-4 text-foreground shadow-lg backdrop:bg-background/80'
              : 'relative m-0 block w-full max-w-none border-0 bg-transparent p-0 text-foreground'}
            onCancel={event => { event.preventDefault(); setExpanded(false); }}
            onClick={event => {
              if (!expanded || event.target !== event.currentTarget) return;
              const bounds = event.currentTarget.getBoundingClientRect();
              if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) setExpanded(false);
            }}>
            <div hidden={!expanded} className="mb-4 pr-8">
              <h2 id={titleId} className="text-lg font-semibold text-primary">▶️ {link.title ?? 'YouTube video'}</h2>
              <p className="text-sm text-muted-foreground">{selection === 'direct' ? '⚠️ Google direct' : `🛡️ ${new URL(mirror.host).hostname}`}</p>
              <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-2 h-7 w-7" aria-label="Close expanded video" title="Close expanded video" onClick={() => setExpanded(false)}>✕</Button>
            </div>
            {frame}
          </dialog>
        </>
      ) : (
        <div className="relative">
          <Button type="button" variant="secondary" onClick={() => play(0)} aria-label={`Play video privately${link.title ? `: ${link.title}` : ''}`}
            className="relative h-auto aspect-video w-full flex-col gap-1 overflow-hidden whitespace-normal p-0">
            {thumb && !thumbFailed && <img src={privateThumbnailUrl(link)} alt="" referrerPolicy="no-referrer"
              onError={() => setThumbFailed(true)} className="absolute inset-0 h-full w-full object-cover" />}
            <span className="relative flex flex-col items-center gap-1 rounded bg-background/70 px-3 py-2">
              <span className="text-3xl" aria-hidden>▶️</span>
              <span className="line-clamp-2 text-xs font-semibold text-foreground">{link.title ?? 'YouTube video'}</span>
              <span className="text-[11px] text-muted-foreground">🛡️ Invidious</span>
            </span>
          </Button>
          {!thumb && <Button type="button" variant="ghost" size="sm" className="absolute bottom-1 right-1 h-6 bg-background/80 px-2 text-[11px]" onClick={() => setThumb(true)}>🖼️ Preview picture</Button>}
          {thumbFailed && <span className="absolute bottom-1 right-1 rounded bg-background/80 px-2 text-[11px] text-muted-foreground">Picture unavailable</span>}
        </div>
      )}
      {selection !== null && (
        <div className="mt-1 space-y-1 text-[11px]">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <span className="min-w-0 break-all text-muted-foreground">{selection === 'direct' ? '⚠️ Google direct' : `🛡️ ${new URL(mirror.host).hostname}`}</span>
            <div className="flex shrink-0 items-center">
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" title="Expand video" aria-label="Expand video" onClick={() => setExpanded(true)}>⛶</Button>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" title="Stop video" aria-label="Stop video" onClick={() => setSelection(null)}>⏹️</Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <Button type="button" variant="outline" size="sm" className="h-auto min-h-7 whitespace-normal px-2 text-[11px]" onClick={() => play(typeof selection === 'number' ? nextPrivateMirror(selection) : 0)}>🔄 Switch mirror</Button>
            {typeof selection === 'number' && <Button type="button" variant="outline" size="sm" className="h-auto min-h-7 whitespace-normal px-2 text-[11px]" onClick={() => {
              const piped = PRIVATE_YOUTUBE_MIRRORS.findIndex(m => m.tier === 'piped');
              if (piped >= 0) play(piped);
            }}>🛡️ Try Piped</Button>}
            <Button asChild variant="link" size="sm" className="h-auto min-h-7 whitespace-normal px-1 text-[11px]">
              <a href={privateVideoUrl(link, mirror, false)} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" onClick={() => setSelection(null)}>↗ Open private mirror</a>
            </Button>
          </div>
          <p className="text-muted-foreground">Public mirrors may be unavailable. The mirror sees your IP; use Tor or a VPN for stronger privacy.</p>
          {selection !== 'direct' && <Button type="button" variant="link" className="h-auto whitespace-normal p-0 text-[11px] text-muted-foreground" onClick={() => setWarn(true)}>⚠️ Last resort: YouTube direct</Button>}
        </div>
      )}
      <AlertDialog open={warn} onOpenChange={setWarn}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Connect directly to Google?</AlertDialogTitle>
            <AlertDialogDescription>Playing directly shares your IP address and video request with Google. YouTube’s privacy-enhanced domain does not hide your IP. Try the other private mirrors or open a mirror in a new tab first.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep private</AlertDialogCancel>
            <AlertDialogAction onClick={() => play('direct')}>Play on YouTube anyway</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}