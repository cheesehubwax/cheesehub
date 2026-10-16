/** Shared public data branch; deployments and previews use the same override. */
export function tokenPriceDataUrl(): string {
  const override = import.meta.env.VITE_TOKEN_PRICE_BASE_URL as string | undefined;
  if (override) return override.replace(/\/$/, '');
  const owner = typeof window !== 'undefined' && window.location.hostname.endsWith('.github.io')
    ? window.location.hostname.replace('.github.io', '') : 'cheesehubwax';
  return `https://raw.githubusercontent.com/${owner}/cheesehub/token-price-data/data`;
}