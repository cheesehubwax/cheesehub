# Harden the Panic Lock (no PIN)

Today "Lock now" / Esc Esc / Ctrl+Shift+L / idle auto-lock forget the unlocked key and redraw the messenger, but leave the "Unlock saved key with Anchor" button one tap away. Three optional extras will be added, each a separate switch in the Privacy dialog's "Screen shield & panic lock" section. All default to off, so nothing changes until the user turns them on.

## 1. Stealth redirect
- When on, locking jumps straight to the CHEESEHub home page (replacing the history entry, so Back doesn't land on a ready-to-unlock Crypt screen).
- Toast becomes neutral (no "Locked / Unlock with Anchor" wording) so the screen gives nothing away.

## 2. Disconnect wallet on lock
- When on, locking also signs the WAX wallet out of CHEESEHub, so unlocking needs a fresh Anchor sign-in plus approval.
- Note shown beside the switch: this signs you out of the whole site, not just Crypt.

## 3. Cold lock (forget saved key on this device)
- When on, locking also deletes this device's saved, Anchor-locked key copy and forgets the remembered key/vault folder, so the screen falls back to the first-time "load your key file" setup. Nothing is visible to a snooper beyond that.
- Friends, nicknames, avatars and settings stay; only the locked key copy goes.
- Safety: the switch can only be turned on after a warning confirmation: "You will need your key backup file (or QR transfer) to get back in. Without it, your messages can't be read." Shown again in the switch's help text.
- Nothing on-chain changes; the published key and message history are untouched.

## Order of a lock
```text
forget unlocked key + instant key
-> (cold lock) delete saved locked key + remembered folder
-> (disconnect) wallet sign-out
-> (stealth) go to home page, neutral toast
   else: redraw Crypt locked screen (current behaviour)
```
Each step runs even if a later one fails; sign-out errors are swallowed so the lock never stalls.

## Technical details
- `src/lib/cryptPanicLock.ts`: add `loadLockOptions/saveLockOptions` (`{ stealth, disconnect, cold }`, device-local, defaults false) plus a pure `lockSteps(options)` helper returning the ordered step list.
- `src/pages/CheeseCrypt.tsx`: `panicLock` in `Messenger` reads options; cold uses `clearLockedEnvelope(account)` from `cryptKeyLock.ts` and the existing remembered-handle forget helper; disconnect calls `useWax().logout()`; stealth uses `navigate('/', { replace: true })`.
- `src/components/crypt/CryptPrivacyDialog.tsx`: three switches with help text; cold lock switch gated by `CryptConfirmDialog`.
- `CryptAbout.tsx` and `mem://features/crypt-panic-lock` updated.
- Tests in `src/test/`: option load/save defaults, `lockSteps` ordering for each combination, cold lock removes the envelope but keeps contacts.

## Liability note
All local-device only; no new data stored or sent anywhere, so no new legal exposure. The main risk is user lockout from cold lock, handled by the confirmation warning.
