

## Fix Missing CHEESE and Inconsistent Token Display in Wallet

### Problem
When Hyperion returns "fresh" data, the wallet trusts it completely. But Hyperion indexers are unreliable — they can omit tokens, especially for accounts with many holdings. If CHEESE is missing from the Hyperion response, it simply doesn't show. There's no safety net for critical tokens.

### Root Cause
In `useAllTokenBalances.ts` line 61-78: when Hyperion is not stale, all tokens come solely from Hyperion with no supplemental RPC check. If Hyperion omits CHEESE (or WAX), the user won't see their most important holdings.

### Fix — `src/hooks/useAllTokenBalances.ts`

After processing the Hyperion response (fresh path), add an RPC supplement step for critical tokens (CHEESE, WAX) if they're missing from the Hyperion results:

1. After building `results` from Hyperion (line 77), check if CHEESE and WAX are present
2. For any missing critical tokens, do an RPC `get_currency_balance` call to fetch the real balance
3. Merge any found balances into the results array

This ensures CHEESE and WAX always appear if the user holds them, regardless of Hyperion reliability.

### Technical Detail

```ts
// After the Hyperion fresh-data mapping (line 77), add:
const criticalTokens = WAX_TOKENS.filter(t => t.symbol === 'WAX' || t.symbol === 'CHEESE');
const resultKeys = new Set(results.map(r => `${r.contract}:${r.symbol}`));
const missingCritical = criticalTokens.filter(t => !resultKeys.has(`${t.contract}:${t.symbol}`));

if (missingCritical.length > 0) {
  console.warn('[Balance] Hyperion missing critical tokens:', missingCritical.map(t => t.symbol));
  const rpcBalances = await fetchAllTokenBalancesViaRpc(accountName, missingCritical);
  for (const [key, data] of rpcBalances) {
    const [contract, symbol] = key.split(':');
    const knownToken = TOKEN_REGISTRY_MAP.get(key);
    results.push({
      symbol, contract,
      precision: knownToken?.precision || data.precision,
      displayName: knownToken?.displayName || symbol,
      balance: data.balance,
      isLpToken: isLpToken(contract),
    });
  }
}
```

No other changes needed — the wallet UI already sorts by USD value descending via `sortedBalances`.

### Files changed: 1
- `src/hooks/useAllTokenBalances.ts`

