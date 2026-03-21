

## Fix: Premint drops failing "Max claimable must be greater than 0" validation

### Problem
For premint drops, `maxClaimable` stays at its initial value of `0` in form state. The validation in `validateDropFormData()` (line 224 of `src/lib/drops.ts`) checks `data.maxClaimable` directly, which is `0`. The override to `assetIds.length` only happens after validation, on submission (line 128 of `CreateDrop.tsx`).

### Fix
Update `validateDropFormData` in `src/lib/drops.ts` to skip the `maxClaimable > 0` check for premint drops (since it's auto-derived from selected NFTs, which are already validated earlier):

```ts
if (data.dropType !== 'premint' && data.maxClaimable <= 0) {
  return 'Max claimable must be greater than 0';
}
```

Single line change in `src/lib/drops.ts`, no other files affected.

