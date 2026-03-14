

## 429 Rate Limiting from Alcor Swap API

The 429 error is coming from Alcor's API (`wax.alcor.exchange`) rate-limiting your requests. The network logs confirm repeated 429s on the `getRoute` endpoint.

**Root causes:**
1. The debounce is only 500ms -- too aggressive for a rate-limited API
2. `retry: 1` in react-query means it immediately retries a failed request, doubling the rate
3. No backoff delay between retries
4. The `staleTime` of 10s means routes are re-fetched frequently

**Plan:**

### 1. Increase debounce in `useSwapRoute.ts`
- Change debounce from 500ms to 800ms to reduce request frequency

### 2. Add retry delay and reduce retries in `useSwapRoute.ts`
- Set `retry: 1` with `retryDelay: 3000` so the retry waits 3 seconds before hitting the API again
- Increase `staleTime` from 10s to 15s

### 3. Add 429-aware error handling in `fetchSwapRoute` (`swapApi.ts`)
- Detect 429 responses specifically and throw a user-friendly error ("Rate limited, please wait a moment")
- Optionally read the `Retry-After` header if present

These are small, targeted changes to two files that should significantly reduce 429 errors.

