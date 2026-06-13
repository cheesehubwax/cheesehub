# Fix broken CHEESEFARM cover image

## Root cause

The CHEESEFARM cover image hash on-chain is:

`bafkreiboplxjqffji562begutm4zxcsybcsdinoh5ohgbgsz7hxbcyq334`

This is a valid IPFS CIDv1 (raw codec, `bafk…` prefix). However `src/hooks/useIpfsImageSrc.ts` only prepends an IPFS gateway when the hash starts with `Qm` or `bafy`:

```ts
if (hash.startsWith("Qm") || hash.startsWith("bafy")) {
  return `${IPFS_GATEWAYS[gatewayIdx % IPFS_GATEWAYS.length]}${hash}`;
}
return hash;
```

Because `bafkrei…` matches neither, the raw CID is returned as the `src` and the browser fails to load it — that's the broken cover the user is seeing.

Same hook is also used by `FarmCard` logo and other farms, so any farm whose creator pastes a CIDv1 (very common on AtomicHub / IPFS uploaders today) currently shows a broken image.

## Change

Single-file edit to `src/hooks/useIpfsImageSrc.ts`:

- Recognize any CIDv1 prefix, not just `bafy`. Match `Qm` (CIDv0) OR `baf` (covers `bafy`, `bafk`, `bafyb`, `bafkrei`, etc.) as IPFS hashes that should be served through `IPFS_GATEWAYS`.
- Keep existing behavior for `http(s)://` URLs and unrecognized strings.
- Keep gateway-cycling `onError` behavior unchanged.

Effectively the check becomes:

```ts
if (hash.startsWith("Qm") || hash.startsWith("baf")) { … }
```

## Out of scope

- No UI/markup changes in `FarmDetail.tsx`.
- No changes to `ipfsGateways.ts`, farm fetching, or any other module.
- Not touching unrelated NFT image pipelines (those already handle CIDv1 via `extractIpfsHash`).

## Verification

1. Navigate to `/farm/cheesefarm` — cover image renders (served from `gateway.pinata.cloud/ipfs/bafkrei…`).
2. If the first gateway fails, `onError` cycles to the next gateway exactly as before.
3. Existing `Qm…` avatars/logos on other farms still load (regression check on `/farm` list and another farm detail).
