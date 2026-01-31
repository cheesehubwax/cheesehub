import { useState, useEffect } from 'react';

const COINGECKO_API = 'https://api.coingecko.com/api/v3/simple/price?ids=wax&vs_currencies=usd';

export function useWaxPrice() {
  const [waxPrice, setWaxPrice] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchPrice() {
      try {
        const response = await fetch(COINGECKO_API);
        if (!response.ok) throw new Error('Failed to fetch WAX price');
        const data = await response.json();
        if (mounted && data?.wax?.usd) {
          setWaxPrice(data.wax.usd);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchPrice();
    const interval = setInterval(fetchPrice, 60000); // Refresh every minute

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return { waxPrice, loading, error };
}
