// Fallback fetch utility for AtomicAssets API reliability

export async function fetchWithFallback(
  endpoints: string[],
  path: string,
  options?: RequestInit,
  timeout: number = 8000
): Promise<Response> {
  let lastError: Error | null = null;

  for (const baseUrl of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(`${baseUrl}${path}`, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return response;
      }

      // If response is not ok, try next endpoint
      console.warn(`Endpoint ${baseUrl} returned ${response.status}, trying next...`);
    } catch (error) {
      lastError = error as Error;
      console.warn(`Endpoint ${baseUrl} failed:`, (error as Error).message);
    }
  }

  throw lastError || new Error('All API endpoints failed');
}

// Helper to build URL with query params
export function buildApiUrl(path: string, params: Record<string, string>): string {
  const url = new URL(path, 'https://placeholder.com');
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return url.pathname + url.search;
}
