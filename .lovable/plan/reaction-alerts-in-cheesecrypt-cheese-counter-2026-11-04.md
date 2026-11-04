# Reaction alerts in CHEESECrypt (cheese counter)

Note: emoji reactions themselves are not in the app yet (the earlier reactions plan was not built). This plan builds them first, then the alert counter.

## What you will see
- A round 🧀 button with a number on the right of the chat, stacked with the existing blue @ reply button (and the report button above them when shown).
- The number counts messages **you sent** that got a new reaction from someone else since you last saw them.
- Clicking 🧀 jumps to your earliest unseen reacted-to message and highlights it; each click moves to the next one.
- Replies and reactions are counted completely separately:
  - Scrolling past or jumping to a reply never clears a reaction, and vice versa.
  - A reaction only clears when you land on it via the 🧀 button (not just because it was on screen during a reply jump). Same for replies: they only clear via the @ button or as they do today.
- Counts survive sign-out/reload, per account and per chat.

## Part 1 - Reactions (from the approved Option A design)
- Reaction message format: hidden control marker + target message fingerprint + emoji; older clients never show it as text.
- Curated palette: 👍 ❤️ 🔥 😂 🧀 🚀; tap a pill to add/remove your own.
- Reactions are sent like normal messages to the same people (uses the current fee/router path for now; becomes popup-free once you switch the contract to free sponsored messages).
- Only senders authenticated for that chat count; muted/banned rules apply as for messages.

## Part 2 - Reaction alerts
- Each incoming reaction to your own message gets its own "seen" receipt (who + emoji + message), stored locally per account.
- 🧀 counter = your messages with at least one unseen reaction.
- Separate highlight style from reply highlights so you can tell which one you jumped to.

## Contract / sync
- No contract change needed: reactions are ordinary encrypted messages. APP_SYNC.md gets a note that reactions are client-side and must keep working once fees move to crypt.cheese.

## Technical details
- New `src/lib/cryptReactions.ts` (encode/parse/aggregate, digest target matching reusing edit-digest logic), reaction bar + pills in `ChatMessageItem.tsx`.
- New `src/hooks/useCryptReactionNavigation.ts` mirroring `useCryptReplyNavigation` but with its own receipt store key and its own `pending/jump/highlighted`; clearing only happens inside its own `jump`, never from `inspectVisible` of the reply hook.
- Button rendered in `CheeseCrypt.tsx` beside the @ button; offsets recomputed so report/@/🧀 stack without overlap.
- Tests: reaction encode/parse, aggregation/toggle, own-message filter, and independence (clearing replies leaves reaction count unchanged and vice versa).
