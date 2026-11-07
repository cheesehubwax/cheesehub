# CHEESECrypt: Screen Shield and Panic Lock

## What you get
- **🛡️ Lock now button** in the chat toolbar (next to Privacy). One click instantly clears every open conversation, contact list and message from the screen and drops back to the "🔑 Unlock with Anchor" prompt.
- **Keyboard shortcut**: press `Esc` twice quickly (or `Ctrl/Cmd + Shift + L`) to lock. Double-Esc avoids locking by accident when closing a dialog.
- **Auto-lock after inactivity**: a setting in the Privacy dialog — Off, 15 min, 30 min (default), 1 hour. No mouse/keyboard/touch activity for that long locks the same way. Checked also when you come back to the tab, so a laptop left asleep locks on wake.
- **Screen shield on tab switch** (optional toggle, off by default): when you switch tabs or minimise, message text is blurred until you click back in, so screenshots of the tab overview or a glance at the taskbar preview show nothing.
- **Unlocking again** is the usual single free Anchor signature (nothing sent, no fee). Messages are re-read from the chain as normal.

## What it does not do
- Nothing is deleted from the blockchain or from your friends' devices.
- Instant Messaging stays as it is (its own 4-hour rule); Lock now also drops it from this tab for a full clean slate.
- Anyone holding your unlocked Anchor wallet can still unlock again.

## Legal / liability note
Purely local, on-device privacy. No data leaves the browser, nothing is hidden from the chain, no new hosting or custody. No grey-area concerns.

## Technical details
- `src/lib/cheeseCrypt.ts`: add `forgetSessionKey(account)` removing the in-memory `sessionKeys` entry (the wallet-locked envelope stays, so unlock remains one signature).
- New `src/lib/cryptPanicLock.ts`: idle-limit setting load/save (localStorage, per device), `idleExpired(lastActive, limit, now)`, double-Esc detector — pure and testable.
- New `src/hooks/useCryptAutoLock.ts`: activity listeners (keydown/pointerdown/touchstart/wheel, throttled), 30s interval, `visibilitychange` check; calls `onLock`.
- `CheeseCrypt.tsx`: page-level `lockNonce`; panic lock calls `forgetSessionKey`, `instant.forget()` for the tab, closes dialogs, then bumps the `Messenger` React key so all decrypted state, caches and refs are discarded by unmounting. Toast: "Locked — unlock with Anchor to continue."
- Lock button + shield toggle + idle select in existing toolbar/Privacy dialog (presentational; Messenger owns state per existing rule).
- Shield: CSS blur class on the message area while `document.hidden`/window blurred, only when enabled.
- About page: short "Screen Shield & Panic Lock" section.
- Tests `src/test/cryptPanicLock.test.ts`: idle expiry at exactly 30 min default, Off never expires, double-Esc within 600 ms triggers and slower doesn't, `forgetSessionKey` makes `loadKey` return null while the envelope remains.
- Record rule in `src/components/crypt/AGENTS.md`; save the feature to memory.
