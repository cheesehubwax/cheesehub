## Fix farm cover/logo images not loading

**Cause:** `FarmDetail.tsx` and `FarmCard.tsx` use `getIpfsUrl()` from `src/lib/farm.ts`, which only returns the single `ipfs.io/ipfs/<hash>` gateway with no fallback. When ipfs.io is slow or rate-limiting (currently common), the cover and logo silently fail to load. DAO pages already solved this with a local `useIpfsImageSrc` hook that cycles through `IPFS_GATEWAYS` on `onError`.

### Changes

**1. New file `src/hooks/useIpfsImageSrc.ts`**
- Extract the existing inline hook from `src/components/dao/DaoDetail.tsx` (lines 36–54) verbatim into a shared hook so both Farm and DAO modules use the same multi-gateway fallback logic.
- Exports: `useIpfsImageSrc(hash: string | undefined): { src: string; onError: () => void }`.

**2. `src/components/dao/DaoDetail.tsx`**
- Remove the inline `useIpfsImageSrc` declaration; import it from `@/hooks/useIpfsImageSrc`.
- No behavior change.

**3. `src/components/farm/FarmDetail.tsx`**
- Replace `const logoUrl = farm.logo ? getIpfsUrl(farm.logo) : ""` and `const coverUrl = farm.profile?.cover_image ? getIpfsUrl(farm.profile.cover_image) : ""` with:
  ```tsx
  const logo = useIpfsImageSrc(farm.logo);
  const cover = useIpfsImageSrc(farm.profile?.cover_image);
  ```
- Update the cover `<img>` (~line 212): `src={cover.src}`, add `onError={cover.onError}`, gate on `cover.src` instead of `coverUrl`.
- Update the logo `<img>` (~line 222): `src={logo.src}`, add `onError={logo.onError}`, gate on `logo.src`.
- Drop the now-unused `getIpfsUrl` import.

**4. `src/components/farm/FarmCard.tsx`**
- Replace `logoUrl` with `const logo = useIpfsImageSrc(farm.logo)`.
- Update the `<img>` to `src={logo.src}` and chain `logo.onError` into the existing `onError` (call `logo.onError()` and only hide the element once all gateways have been tried — simplest: just call `logo.onError()`; the existing display:none hide can be removed since cycling gateways already handles failure, and a final failure just leaves a broken icon which is rare).
- Drop the now-unused `getIpfsUrl` import.

### Not changing

- `src/lib/farm.ts` `getIpfsUrl` stays as-is (still used elsewhere for non-image URLs or single-shot fetches).
- `EditFarmProfile.tsx` — only stores the raw hash, no image rendering.
- IPFS gateway list in `src/lib/ipfsGateways.ts` — already ordered by reliability.

### Verification

- Open a farm with a known cover (e.g. any farm that has `profile.cover_image` set in `farms.waxdao` `farms` table).
- Expected: cover renders via `gateway.pinata.cloud` first; if it 4xx/5xxs, `onError` advances to `dweb.link`, then `nftstorage.link`, etc. Same for logos on both detail and card views.
