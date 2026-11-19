import { getIpfsUrl as getSharedIpfsUrl } from "@/lib/ipfsGateways";

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
export function getImageUrl(img: string | undefined): string {
  if (!img) return "";
  if (img.startsWith("ipfs://")) return getSharedIpfsUrl(img.replace("ipfs://", ""));
  if (img.startsWith("Qm") || img.startsWith("bafy") || img.startsWith("bafk")) return getSharedIpfsUrl(img);
  return img;
}

export function getMediaUrl(data: Record<string, string | undefined> | undefined): { url: string; isVideo: boolean } {
  const imageField = data?.img || data?.image;
  if (imageField) return { url: getImageUrl(imageField), isVideo: false };
  const videoField = data?.video;
  if (videoField) return { url: getImageUrl(videoField), isVideo: true };
  return { url: "", isVideo: false };
}

