# CHEESECrypt chat-safety sweep

## Rule
A message or its preview must not blank CHEESEHub or stop adjacent messages being read. Reply/reaction/report navigation must not repeatedly update the same read state, and must only consume a receipt when its message actually exists on screen. Stored messages, transactions, fees, authority and privacy choices stay unchanged.

## Places checked by reading their code

| Place | Result |
| --- | --- |
| Private one-to-one chats, private CG2 invite groups, public CG2 rooms, legacy CG1 groups, hidden/restored groups | All use Messenger's same protected message rows and viewport. The page-level fallback keeps the surrounding app available. No alternative unprotected feed was found. |
| Opening recovered rooms, unread divider, scrolling older history, live incoming messages | Same feed. Existing inner-list resume logic is retained. Read-marker persistence could throw on storage denial/full storage; now it retains the caller's session state instead. |
| Reply counter, reply jumping and visible-message tracking | Frame-coalesced visibility checks and unchanged opaque identities retained. Added actual-list mount tracking so observers reconnect when Retry replaces a failed viewport, not just when switching rooms. |
| Reaction counter and reaction jumps | Found an uncaught storage write in the effect and a jump that consumed receipts for absent/failed rows. Writes now preserve in-memory state on failure; absent rows remain pending; lookup uses dataset equality. |
| Local message search | Already uses the safe opaque-key lookup; no dynamic CSS selector remains. |
| Moderator report jumps and viewed-report receipts | Safe lookup already present. Storage writes now tolerate failure, and absent/failed rows are no longer marked viewed. Report authority and sent notices are unchanged. |
| Quoted-original dialog (text, NFT and voice) | Added local preview recovery; the dialog and conversation stay available after a child render failure. Existing mute/collapse visibility checks remain before rendering. |
| Public-owner edit log: original and replacement content | Added separate recovery around Before and After, leaving the other version and dialog usable. Visibility windows and ownership gates unchanged. |
| Stranger inbox message previews and Accept/Decline/Block | Added local recovery around previews. Plain text/NFT labels remain local; no remote media is loaded or consent changed. Actions remain available even if a preview cannot render. |
| Discover room listings and join-request previews | Validated text, avatars and Respect badges, no message-navigation observers. Covered by the Messenger/page boundary; no repeated-observer effect found. No listing/membership/authority changes. |
| Text/reply, NFT/music/video/SFX, voice and tip message rows | All rendered under the row boundary. NFT/media unavailable states, voice integrity gates and tip verification failures already stay local. Media playback subscriptions have cleanup. No playback/privacy behavior changed. |
| Respect badge visibility observer | Created once with disconnect cleanup, not per render. No corresponding observer churn found. |
| Screen shield and panic lock | Visibility-based shield and lock paths are intentional, not an error fallback. Unchanged. |
| Initial/delta/full-history reads, live polls, encrypted IndexedDB history saves and account switching | Reads use in-flight/scope guards and catch/finally paths; quiet history does not replace unchanged rows. IndexedDB failures resolve without throwing. No renderer or receipt observer exists in the history store. Unchanged. |
| Blockchain sendmsg/sendfree/payfee router | Read the contract source: transports encrypted copies and handles fees, never renders messages or tracks chat views. No relevant database function or hosted chat renderer exists; contract and settled chain records untouched. |

## Verification and limitations
80 targeted tests pass across 16 files, covering the reproduced storage failures, absent-row reactions, list replacement, quote/edit/inbox preview failures, opaque keys, private invite groups and a 92-reply authenticated encrypted public-room fixture with DM switching. Two additional private/legacy reply-navigation tests pass. Inbox and edit flows, encrypted restart/delta readback, report authority and moderation tests pass. The live signed-out `/crypt` page renders with no runtime errors; no real-wallet room-opening claim is made.

The original eventhorizon room and private key are unavailable here, so its specific blackout remains unconfirmed in a real wallet session. Two older room-admission tests failed identically against the original, unchanged page during the preceding update; no admission/fee changes were made to address them.