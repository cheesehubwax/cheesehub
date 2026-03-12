/**
 * Sanitizes a URL to only allow http:// and https:// schemes.
 * Returns "#" for any dangerous scheme (javascript:, data:, vbscript:, etc.)
 */
export function sanitizeUrl(url: string): string {
  if (!url) return "#";
  const trimmed = url.trim().toLowerCase();
  if (trimmed.startsWith("https://") || trimmed.startsWith("http://")) {
    return url.trim();
  }
  return "#";
}
