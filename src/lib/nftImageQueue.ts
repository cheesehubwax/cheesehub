// Grid artwork uses one shared pool. Waiting time never consumes a request's
// deadline, and removing a tile cancels its queued or active request.
export const NFT_IMAGE_CONCURRENCY = 4;
export const NFT_IMAGE_TIMEOUT_MS = 6000;

export function createNftImageQueue(limit = NFT_IMAGE_CONCURRENCY) {
  type Job = { start: () => void; cancelled: boolean };
  const waiting: Job[] = [];
  let active = 0;
  const drain = () => {
    while (active < limit && waiting.length) {
      const job = waiting.shift();
      if (!job || job.cancelled) continue;
      active += 1;
      job.start();
    }
  };
  return (url: string, success: () => void, failure: () => void) => {
    let image: HTMLImageElement | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let finished = false;
    const finish = (result?: boolean) => {
      if (finished) return;
      finished = true;
      job.cancelled = true;
      const queuedIndex = waiting.indexOf(job);
      if (queuedIndex >= 0) waiting.splice(queuedIndex, 1);
      if (timer) clearTimeout(timer);
      if (image) {
        image.onload = null;
        image.onerror = null;
        // Stop a failed/cancelled transfer before admitting another one.
        if (result !== true) image.removeAttribute('src');
        active -= 1;
      }
      if (result === true) success();
      if (result === false) failure();
      drain();
    };
    const job: Job = {
      cancelled: false,
      start: () => {
        image = new Image();
        image.onload = () => finish(Boolean(image && image.naturalWidth > 0));
        image.onerror = () => finish(false);
        timer = setTimeout(() => finish(false), NFT_IMAGE_TIMEOUT_MS);
        image.src = url;
      },
    };
    waiting.push(job);
    drain();
    return () => finish();
  };
}

export const queueNftImage = createNftImageQueue();