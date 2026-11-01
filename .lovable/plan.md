# Hide NFT identifiers in CHEESECrypt chat

NFTs sent in chat will show only their picture, name, artist (if any), playback controls and the transaction link. No asset ID, collection name, mint number or AtomicHub link anywhere, including the larger view.

## Changes (CryptNftCard only)
- Larger view subtitle: drop the collection name, the mint number and the "ID …" AtomicHub link; show only the artist when present (hide the subtitle line visually when empty, keeping an accessible description).
- Unavailable fallback text: "🖼️ NFT #<id> (unavailable)" becomes "🖼️ NFT unavailable".
- Transaction link stays (it points to the message transaction, not the NFT).
- Update the component's doc comment to match.

No contract or APP_SYNC changes needed (display only).
