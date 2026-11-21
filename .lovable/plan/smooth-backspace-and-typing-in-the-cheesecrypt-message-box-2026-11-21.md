# Smooth backspace and typing in the CHEESECrypt message box

## Why it stutters
Every keypress in the message box updates state that lives in the main chat screen. That redraws the whole screen (message list, sidebar, cost line) and re-measures the encrypted message size on each key. When you hold Backspace the key repeats about 30 times a second, the redraws fall behind, and the box catches up in jumps, so it looks like it skips and erases more than you meant.

## What changes for you
- Holding Backspace (or typing fast) deletes smoothly, one character at a time, with the cursor staying where it should.
- The size counter, part count and price under the box still update, just a fraction of a second behind while keys are held.
- Sending, editing, replying, attaching NFTs, YouTube titles and the /tip command work exactly as now. Nothing about fees, encryption or what gets sent changes.

## Steps
1. The message box keeps its own instant copy of what you type, so keystrokes no longer redraw the whole chat screen.
2. The main screen receives the text as a low-priority update, so the counter and price calculations never block typing.
3. When the app itself changes the text (clearing after send, starting an edit, adding an NFT, cancelling), the box picks that up immediately.
4. Send always uses the exact latest text in the box, never a delayed copy, so nothing typed just before clicking Send is lost.
5. Keep the message list from redrawing when only the typed text changes.
6. Add tests: fast repeated deletes end with the right text; Send right after typing uses the newest text; clearing/edit/NFT attach update the box. Then check by holding Backspace in the browser.

## Technical details
- `CryptComposer`: local `draft` state bound to the Textarea; propagate to Messenger via `startTransition(() => setText(v))`; sync local draft from the `text` prop when it changes externally (track last value pushed to detect external writes). Expose latest draft via a ref used by `send`/size checks at send time.
- Messenger: derive size/cost from `useDeferredValue(text)` for display; `send()` re-computes size from the ref'd live text before signing so the over-length guard stays exact.
- Wrap the thread rendering in a memoized component (or `useMemo` on the rendered list) keyed on thread/message props, not composer text.
- Record rule in `src/components/crypt/AGENTS.md`: composer owns instant draft; Messenger state is a deferred mirror; send reads the live draft.
