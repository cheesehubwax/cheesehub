# CHEESECrypt: play WAX music and sound-effect NFTs in chat

## What you'll see
- A new **🎵 Attach music** button next to 🖼️ Attach NFT. It opens a picker showing only your NFTs that contain sound or video (songs, clips, sound effects), with cover art, title and artist.
- In the conversation, a shared music NFT shows as a compact bubble: cover picture, a play/pause button, a progress bar and the time. Title, artist, collection and mint appear when you hover, same as picture NFTs.
- Both people (and everyone in a group) can press play. Sound comes straight from the NFT's public file; nothing is uploaded or stored.
- Clicking the cover opens the larger view (same as picture NFTs) with the full player and, for NFTs with several tracks, a track list.
- Only one thing plays at a time: starting a chat sound pauses any other chat sound, voice note, or CHEESEAmp, and vice versa.
- Ordinary picture NFTs already sent that turn out to contain audio will also get play controls automatically.

## Price and privacy
- Same as picture NFTs: 0.021 CHEESE (0.020 nulled once, 0.001 per recipient). No new fee, no new memo format.
- Only the NFT's ID goes inside the encrypted message. The sound file itself is public on WAX/IPFS, as the artwork already is. The About guide will say this.

## Limits
- Up to 4 NFTs per message (existing cap).
- Sounds that are no longer online show "Sound unavailable" instead of a broken player.
- Nothing plays on its own; the user must press play.

## Technical details
- Message format unchanged: reuse `[nft:<asset_id>]` tokens from `cryptNft.ts`; no `CRYPT1:` or fee changes.
- Extend `fetchAssetById` (or add `fetchCryptMediaAsset`) to also return `audio`, `clip`, `video` and extra track fields, reusing the music detection rules from `useMusicNFTs.ts` (`isMusicNFT`, `extractExtraAudioUrls`) by moving them into a shared helper rather than duplicating them.
- `CryptNftCard` picks an audio layout when the asset has media; picture-only assets stay as now.
- New small chat audio controller (one shared `HTMLAudioElement` for chat) using the existing IPFS gateway list with racing/fallback from `ipfsGateways.ts`; when it starts it calls `getAudioPlayer().pause()` and pauses voice notes; CHEESEAmp and voice notes pause it in turn via a tiny "now playing" event.
- Music picker reuses `useMusicNFTs(account)` for the owner's media NFTs and inserts `nftToken(asset_id)`.
- Update `CryptAbout.tsx` with a short "Music NFTs" section.
- Tests: media-field detection (audio/clip/video/extra tracks, picture-only stays picture) and that a music attachment costs the NFT price in DMs and groups.
- Verify in a live chat that sender and receiver both see and can play the same music NFT.
