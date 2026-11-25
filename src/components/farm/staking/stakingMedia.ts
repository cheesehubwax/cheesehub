import { getIpfsImageUrl, getIpfsUrl } from "@/lib/ipfsGateways";

export interface NFTAsset {
  asset_id: string;
  name: string;
  image: string;
  collection: string;
  schema: string;
  template_id: string;
}

// Raw IPFS hashes/URIs become a gateway URL; NFTGridCard extracts the hash and
// walks the shared bundled → AtomicHub → IPFS candidates. Empty means no art.
function toIpfsUrl(img: string | undefined, build: (hash: string) => string): string {
  if (!img) return "";
  if (img.startsWith("ipfs://")) return build(img.replace("ipfs://", ""));
  if (img.startsWith("Qm") || img.startsWith("bafy") || img.startsWith("bafk")) return build(img);
  return img;
}

// Images come from the AtomicHub mirror; videos keep raw IPFS gateways.
export function getImageUrl(img: string | undefined): string {
  return toIpfsUrl(img, getIpfsImageUrl);
}

export function getMediaUrl(data: Record<string, string | undefined> | undefined): { url: string; isVideo: boolean } {
  const imageField = data?.img || data?.image;
  if (imageField) return { url: getImageUrl(imageField), isVideo: false };
  const videoField = data?.video;
  if (videoField) return { url: toIpfsUrl(videoField, getIpfsUrl), isVideo: true };
  return { url: "", isVideo: false };
}

