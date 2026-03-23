/**
 * Domain blocklist for banner ads.
 * Banners linking to these domains are silently hidden from display
 * and rejected during rent/edit.
 */

const BLOCKED_DOMAINS = new Set([
  // Common crypto scam patterns
  "walletconnect-dapp.org",
  "wax-cloud.com",
  "waxcloudwallet.net",
  "claim-airdrop.io",
  "free-nft-drop.com",
]);

/**
 * Extracts hostname from a URL, returns null if invalid.
 */
function extractHostname(url: string): string | null {
  try {
    const u = new URL(url.trim());
    return u.hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Checks if a URL's domain (or any parent domain) is in the blocklist.
 * e.g. if "blocked.com" is listed, "evil.blocked.com" is also blocked.
 */
export function isDomainBlocked(url: string): boolean {
  const hostname = extractHostname(url);
  if (!hostname) return false;

  // Check exact match and all parent domains
  const parts = hostname.split(".");
  for (let i = 0; i < parts.length - 1; i++) {
    const domain = parts.slice(i).join(".");
    if (BLOCKED_DOMAINS.has(domain)) return true;
  }
  return false;
}
