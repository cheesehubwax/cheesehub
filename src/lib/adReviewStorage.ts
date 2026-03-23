export interface ReviewEntry {
  timestamp: number;
  fingerprint: string;
}

const STORAGE_PREFIX = "cheese-ad-reviews-";

function storageKey(adminAccount: string): string {
  return `${STORAGE_PREFIX}${adminAccount}`;
}

function slotKey(time: number, position: number): string {
  return `${time}:${position}`;
}

export function getContentFingerprint(
  ipfsHash: string | undefined,
  websiteUrl: string | undefined,
  sharedIpfsHash: string | undefined,
  sharedWebsiteUrl: string | undefined
): string {
  return [ipfsHash ?? "", websiteUrl ?? "", sharedIpfsHash ?? "", sharedWebsiteUrl ?? ""].join("|");
}

export function getReviews(adminAccount: string): Record<string, ReviewEntry> {
  try {
    const raw = localStorage.getItem(storageKey(adminAccount));
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, ReviewEntry>;
  } catch {
    return {};
  }
}

function saveReviews(adminAccount: string, reviews: Record<string, ReviewEntry>): void {
  try {
    localStorage.setItem(storageKey(adminAccount), JSON.stringify(reviews));
  } catch {
    // localStorage full or unavailable
  }
}

export function toggleReview(
  adminAccount: string,
  time: number,
  position: number,
  contentFingerprint: string
): boolean {
  const reviews = getReviews(adminAccount);
  const key = slotKey(time, position);
  const existing = reviews[key];

  if (existing && existing.fingerprint === contentFingerprint) {
    delete reviews[key];
    saveReviews(adminAccount, reviews);
    return false; // unchecked
  }

  reviews[key] = { timestamp: Date.now(), fingerprint: contentFingerprint };
  saveReviews(adminAccount, reviews);
  return true; // checked
}

export function isReviewValid(
  adminAccount: string,
  time: number,
  position: number,
  currentFingerprint: string
): boolean {
  const reviews = getReviews(adminAccount);
  const entry = reviews[slotKey(time, position)];
  return !!entry && entry.fingerprint === currentFingerprint;
}
