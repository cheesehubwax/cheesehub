# CHEESECrypt step 5: encrypted group invites and in-group friend requests

Brings WAXCrypt's invite-based groups into CHEESECrypt. Your existing groups keep working exactly as they do now. Nothing here changes CHEESE fees, branding or old message formats.

## What you will see

**Creating a group**
- "New group" lets you name the group, pick 1 to 7 friends (up to 8 people including you), and optionally set a group picture.
- Pressing Create sends one encrypted invite to each friend you picked. You pay the normal group text fee: 0.0100 CHEESE per part, split 80% eosio.null / 20% xcheeseliqst, plus 0.0010 CHEESE per part to each invitee. You tick the Terms box before paying.

**Receiving an invite**
- The invite appears in the sidebar under Groups as "Invited by <name>", with the group name, picture and member list.
- Buttons: **Join**, **Decline**, and **Decline and block** (this uses the step 1 block list).
- Joining sends a short encrypted "joined" notice to the other members at the normal group fee. Declining is free and stays on your device.
- An invite only counts when the group's creator sent it, the creator is already your friend, and it lists your real public key. Anything else is silently ignored.

**Inside an invite group**
- Messages, NFTs and voice notes work like they do in groups today. Copies go only to members who have joined, and you see the cost before sending.
- The member list shows who has joined and who is still invited.
- **Leave group** sends an encrypted "left" notice at the normal fee. After that, others stop sending you copies. You can still read your history.
- Only the creator can change the group's name or picture. That change goes to members as an encrypted update at the normal fee, and the newest one wins.

**Friend requests between group members**
- Next to a member who isn't your friend: **Send friend request**. This is an encrypted message at the normal one-recipient text fee.
- The recipient sees **Accept** or **Decline**. Accept adds that person as a full friend, using the key the group already introduced.
- Keys a group introduces only work inside that group until you accept a friend request. They never show in your Friends list, never go into the friends folder, and never unlock direct messages.

## What does not change
- Existing groups (2–5 friends, fixed members) keep their format, keep loading, and can still be created by older copies of CHEESECrypt. They show as before, with no invite or leave controls.
- The fees per part, the 80/20 split and the per-recipient payment are unchanged. Every new notice is just an ordinary encrypted message.
- Blocked accounts' invites, notices and requests are dropped before decrypting, as in step 1.
- Members are never written on-chain in readable form. On-chain, an invite looks like any other encrypted message between two friends.

## Limits to know
- Someone who joins late does not get messages sent before they joined. Those copies were never encrypted for them.
- Members are fixed when the group is created. To add someone, create a new group.
- Invites, joins, leaves and group updates are paid messages, so each costs CHEESE like a text.

## Technical details
- New module `src/lib/cryptInviteGroups.ts`. Group ids are 16 hex characters, so they share the existing hidden-group and read-marker formats. Encrypted control texts start with `\u0002CG2:` plus a kind (`invite`, `joined`, `leave`, `meta`, `friend`, `friend-ok`), followed by JSON validated field by field. Group messages use `\u0002CG2:msg` with the id only; the sender is authenticated by the pairwise box, and membership comes from the stored invite, not from the message.
- An invite holds `{id, name, creator, created, members: [[account, publicKey]], avatar?}`. It is accepted only when it is fully assembled (never partial), `from === creator`, the creator is in contacts with the same key, and the receiver's entry matches their own key. Avatars use the existing palette-index validation.
- Per-owner storage keeps invites, status (invited / joined / declined / left), joined members, newest meta by chain time, and group-scoped keys (`cheesecrypt-group-keys-<account>`), separate from contacts. Decryption tries contacts first, then group-scoped keys only for CG2 texts naming that group. A scoped key that decrypts a non-group text is rejected.
- Joined state comes only from authenticated `joined` notices, or from members speaking in the group. Leave removes a member from the send list. Meta is accepted only from the creator, with newest chain time winning.
- Fanout reuses `buildSendMessageActions`: one platform fee per part, a 0.0010 carrier per recipient, integer fee units, and fees omitted explicitly on later copies. A test checks exact amounts for a 3-recipient invite.
- `parseGroup` (CG1) is untouched. Tests cover reading CG1 next to CG2, rejecting invites from non-creators or non-friends, mismatched-key rejection, scoped-key isolation, leave/join counts, meta precedence, blocked-sender dropping, and the friend-request accept path.
- `AGENTS.md`, memory and the roadmap are updated when this lands.
