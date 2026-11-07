# CHEESECrypt Key Rotation (with optional crypto-shredding)

## Honest privacy summary
Rotation only improves privacy when old keys are eventually destroyed. Messages are always decrypted live from the chain, so whoever holds an old key (a stolen device, an old backup file) can read everything that key ever received. Destroying a retired key makes those old messages permanent gibberish for everyone, including you. That is the real gain, and it is also the real cost.

Legal note: this is standard key hygiene with no custody, mixing or anonymity changes. One limit to state plainly in the app: destroying a key only covers copies the app controls. Backup files you downloaded earlier still hold the old key until you delete them.

## What the user sees
- **Privacy dialog → "🔄 Key rotation" card** shows key age ("Your key is 112 days old"), a **Rotate key** button and a **"Keep old keys for"** setting: Destroy now / 7 days / 30 days (default) / 90 days / Forever.
- **Banner after 90 days**: "Your key is over 90 days old. Rotate it?" with Rotate and Remind me later (30 days).
- **Rotation is private by default (stealth).** The new public key is never posted publicly. Only your existing friends and rooms receive it, inside encrypted notices. A small switch "Also post my new key publicly so new people can find me" exists, **off by default**, with a note that strangers who look you up later will only find your old key (and messages they send to it stop working once that key is destroyed).
- **Rotation confirm** lists the exact CHEESE cost (one notice per friend and room, plus the publish fee only if the switch is on), the chats that will go unreadable when the old key is destroyed, and a "Download new backup" step that has to finish before the paid step.
- **Retired keys list**: the date each one expires, plus "Destroy now" (with a confirmation).
- Friends and groups stay. Your Respect key-age points still count from your first key, so early users keep their reward.

## How it works
1. **Key ring.** The locked key file holds the active key plus retired keys, each with a retirement and expiry date, all still sealed by Anchor. Decryption tries the active key, then any unexpired retired keys.
2. **Rotation transaction** (one Anchor approval, fees through crypt.cheese, never sponsored):
   - by default, no public key post at all;
   - only if the user turned the switch on: publish the new public key (the existing Publish key fee);
   - send each friend a **rotate notice** encrypted with the OLD key that carries the new public key. Only the real holder of the old key could have written it, so friends can trust it.
3. **Friends receiving a notice** switch to your new key for future messages. They keep your old public key so they can still read past chats with you. A friend's app then prefers the notice key over the newest public listing for you (so your stale public key is never used for them). A public key change with no matching notice still uses today's behaviour.
4. **Rooms (invite groups)** pin each member's key in the roster. The rotating member sends the owner an authenticated rotate notice. The owner's app then sends a CG2 **rekey** control that swaps just that one key, checked against chain order and the roster digest. Founder protection, bans and mutes carry over by account. Until the owner applies it, your old key stays alive for that room, and it shows as "Waiting for owner".
5. **Legacy 2–5 person groups** have fixed rosters and can't update a key. The confirm screen warns that new messages in them will stop working once the old key is destroyed.
6. **Shredding.** When a retired key expires, the app deletes it from the ring, reseals the vault and refreshes verified matching backups. It also says clearly which older chats can no longer be read.

## Out of scope
- Automatic rotation without the user's approval (every rotation needs a paid signature).
- Any change to the router contract (notices reuse the existing payment+sendmsg shapes).

## Technical details
- `src/lib/cryptKeyRing.ts` (new, pure): ring type, `activeKey`, `decryptCandidates`, `expireRetired(now, retention)`, retention settings (load/save, default 30d), `keyAgeDays`, `shouldNudge(now, created, snoozedUntil)` at 90 days.
- `cryptKeyLock.ts`: v2 file gains an optional `retired: [{publicKey, lock, retiredAt, expiresAt}]`. Older files still parse the same way and the signed bytes don't change.
- `cheeseCrypt.ts`: `buildRotateActions({ publishPublicly = false })` = one notice per recipient, plus publish only when opted in, routed through `routeCryptActions` in the exact router shapes. New authenticated `CP1` rotate payload `{k: newPub, t: time}`.
- Decrypt paths (`cryptGroups.ts`, `cryptRooms.ts`, `cryptPublicInbox.ts`, the DM path) loop over every candidate secret × every known public key for the partner (current plus the history stored per contact).
- Contacts gain `previousKeys[account]: string[]` and `rotatedKey[account]` (from a verified notice). Key resolution order: verified rotate-notice key newer than the latest public listing, else the newest public listing.
- `cryptInviteGroups.ts`: CG2 `rekey` control (owner/admin authority checked against send-time role), roster digest re-derived; the first-public roster rule kept by account, with only the key swapped through an authenticated rekey chain.
- UI: `CryptKeyRotationCard.tsx`, `CryptRotateDialog.tsx` and `CryptKeyAgeBanner.tsx`, one component per file. State lives in Messenger.
- Tests: stealth default builds no publish action and only notices, opt-in adds exactly one publish, notice key outranks an older public listing, retention expiry maths, the 90-day nudge, the old-key-authenticated notice being accepted and a forged one rejected, decrypting through retired keys, rekey authority and digest, and ring files round-tripping without breaking older files.
- Update AGENTS.md (one rule for the key ring and rotation authority), APP_SYNC.md and the memory notes on fees and key rotation.
