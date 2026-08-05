// Unified IPFS gateway configuration
// Ordered by reliability and speed (based on real-world testing)
export const IPFS_GATEWAYS = [
  'https://gateway.pinata.cloud/ipfs/',
  'https://dweb.link/ipfs/',
  'https://nftstorage.link/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
];

// AtomicHub's image cache. Serves NFT media that is no longer retrievable from
// public IPFS gateways (unpinned/expired content), so it is used as the last
// resort after every plain gateway fails.
// Only the 370px preview is reliably cached; larger sizes 500 when the source
// content is no longer retrievable from IPFS.
export function atomicHubImageUrl(hash: string, size = 370): string {
  return `https://resizer.atomichub.io/images/v1/preview?ipfs=${encodeURIComponent(hash)}&size=${size}`;
}

// Ordered list of URL builders for an IPFS hash: plain gateways first, then the
// AtomicHub cache fallback.
export const IPFS_IMAGE_SOURCES: Array<(hash: string) => string> = [
  ...IPFS_GATEWAYS.map((gateway) => (hash: string) => `${gateway}${hash}`),
  (hash: string) => atomicHubImageUrl(hash),
];

export function buildIpfsImageUrl(index: number, hash: string): string {
  const builder = IPFS_IMAGE_SOURCES[index] ?? IPFS_IMAGE_SOURCES[0];
  return builder(hash);
}

// Every candidate URL for a hash, in preference order. The AtomicHub cache is
// included so unpinned content still resolves.
export function ipfsImageCandidates(hash: string): string[] {
  return IPFS_IMAGE_SOURCES.map((builder) => builder(hash));
}

/**
 * Races every candidate URL for a hash in parallel and resolves with the first
 * one that actually decodes. Public gateways frequently hang rather than error,
 * so sequential walking is far too slow — parallel racing is what makes the
 * AtomicHub cache fallback usable.
 */
export function raceIpfsImage(hash: string, timeoutMs = 6000): Promise<{ url: string; index: number } | null> {
  const candidates = ipfsImageCandidates(hash);
  return new Promise((resolve) => {
    let remaining = candidates.length;
    let settled = false;
    const finish = (value: { url: string; index: number } | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);

    candidates.forEach((url, index) => {
      const img = new Image();
      const fail = () => {
        remaining -= 1;
        if (remaining === 0) {
          clearTimeout(timer);
          finish(null);
        }
      };
      img.onload = () => {
        if (img.naturalWidth > 0) {
          clearTimeout(timer);
          finish({ url, index });
        } else {
          fail();
        }
      };
      img.onerror = fail;
      img.src = url;
    });
  });
}

// Timeout configuration for different contexts
export const IMAGE_LOAD_TIMEOUT = {
  card: 12000,
  detail: 15000,
  increment: 3000,
  max: 25000,
};

// Helper to get primary IPFS gateway URL
export function getIpfsUrl(hash: string): string {
  return `${IPFS_GATEWAYS[0]}${hash}`;
}

// Helper to extract IPFS hash from various URL formats
export function extractIpfsHash(url: string): string | null {
  if (!url) return null;

  if (url.startsWith('ipfs://')) {
    return url.replace('ipfs://', '').split('/')[0];
  }

  const ipfsMatch = url.match(/\/ipfs\/([a-zA-Z0-9]+(?:\/[^?#]*)?)/);
  if (ipfsMatch) return ipfsMatch[1];

  if (/^Qm[a-zA-Z0-9]{44}/.test(url) || /^bafy[a-zA-Z0-9]+/.test(url)) {
    return url;
  }

  const patterns = [
    /ipfs\.io\/ipfs\/([a-zA-Z0-9]+(?:\/[^?#]*)?)/,
    /gateway\.pinata\.cloud\/ipfs\/([a-zA-Z0-9]+(?:\/[^?#]*)?)/,
    /cloudflare-ipfs\.com\/ipfs\/([a-zA-Z0-9]+(?:\/[^?#]*)?)/,
    /dweb\.link\/ipfs\/([a-zA-Z0-9]+(?:\/[^?#]*)?)/,
    /nftstorage\.link\/ipfs\/([a-zA-Z0-9]+(?:\/[^?#]*)?)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

// Helper to check if URL is likely a video file by extension
export function isVideoUrl(url: string | undefined): boolean {
  if (!url) return false;
  const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.m4v'];
  const lowerUrl = url.toLowerCase();
  return videoExtensions.some(ext => lowerUrl.includes(ext));
}
