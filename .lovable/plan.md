# CHEESECrypt Live Photo Drop (WebRTC, on-chain handshake, DMs + groups)

## What users get
- A "📸 Live photo" button beside Attach NFT, in direct chats and groups.
- The photo goes straight from your browser to your friends' browsers. It is never uploaded or pinned anywhere.
- It only works while everyone is online with CHEESECrypt open. The sender sees each person's status: waiting → connecting → sent, or failed/timed out.
- Photos are shrunk and compressed before sending: longest side up to 1024px, WebP/JPEG, 300 KB maximum. Big pictures are reduced automatically.
- Received photos appear in the conversation for that session only. They are kept in memory, not stored on chain, and disappear on reload unless the receiver clicks Save. The chat shows a small "Live photo (not stored)" note.
- Groups use a mesh: the sender connects to each friend separately, with up to 5 friends. Each friend who is online gets the photo; anyone who is offline gets "missed live photo".

## Cost (same as messages)
- Every connection message costs 0.0010 CHEESE to the other person plus 0.0100 CHEESE nulled per part, which is the normal message rate.
- One drop = an offer to each recipient + a reply from each recipient. The receiver signs their reply, so they also pay their side.
- The sender sees an estimated cost before signing. The receiver sees a prompt "alice wants to send you a live photo — Accept (costs X)" and nothing happens without their approval.
- The usual Terms checkbox applies to both sending and accepting.
- These fees count toward the `crypt` row in Null by Contract, because they use the same memo.

## How the handshake works
```text
Sender                                 WAX chain                       Receiver
pick photo -> compress
create connection offer --(encrypted multipart memo, 1 tx per recipient set)-->
                                                             live polling (6s) sees offer
                                                             Accept -> build answer
               <--------(encrypted multipart memo, 1 tx)---------------
sender polling sees answer -> direct browser link opens -> photo streams in chunks -> done
```
- Offers expire after 3 minutes. Late answers are ignored.
- While a drop is pending, polling runs every 3s, then returns to 6s.

## Limitations to state in the UI/About
- It needs both people online at roughly the same time.
- Some strict networks (corporate, some mobile carriers) cannot connect directly without a relay server, and we are not adding one. In that case the drop fails clearly and nothing is charged beyond the signed handshake messages.
- The handshake memos are encrypted, but the fact that a handshake happened (accounts, time) is public on WAX, the same as messages.
- Connecting directly exposes each side's IP address to the other person. This will be stated in the About guide.

## Technical details
- New `src/lib/cryptLive.ts`: a payload prefix `\u0003CL1:` with JSON `{t:"offer"|"answer", id, sdp, exp, group?}`. The SDP is non-trickle (ICE gathered before sending), with unused lines stripped and compressed with `CompressionStream('deflate-raw')` + base64. It is sent through the existing `splitMessage`/`encryptMemo`/`buildSendMessageActions`, so existing message formats and fees stay unchanged. Groups reuse the per-recipient fanout and envelope validation from `cryptGroups` (offers are only accepted from members, and the `id` is bound to sender + recipient).
- Handshake payloads are filtered out of the visible message list and handled by a `useLiveDrop` hook inside `Messenger`. The hook ignores expired, duplicate (txId) and own messages, and offers from removed contacts.
- `RTCPeerConnection` uses public STUN (`stun:stun.l.google.com:19302`, `stun:stun.cloudflare.com:3478`) and has no TURN server. The data channel sends 16 KB chunks with a header carrying the size and SHA-256 hash. The receiver checks the size cap and hash, and checks the image MIME by its magic bytes, before rendering it through a blob URL.
- Compression is done with canvas re-encoding, which also strips EXIF/location data.
- The fee estimate uses the shared pricing helpers (`groupMessageCost` per recipient part count).
- Tests: offer/answer encode→decode round trip; expired/duplicate/non-member offers rejected; fee for a 3-person group drop equals the sum of message-rate parts; oversize and wrong-hash transfers rejected; 300 KB cap enforced after compression.
- A rule will be added to AGENTS.md: live drops use encrypted on-chain signaling at message rates, with no relay or storage, and photos are memory-only.
- Mute memory-only photos on reload; hidden groups and removed friends cannot start drops.
