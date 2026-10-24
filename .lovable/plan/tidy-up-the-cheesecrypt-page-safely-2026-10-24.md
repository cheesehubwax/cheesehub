# Tidy up the CHEESECrypt page safely

## Goal
The CHEESECrypt page is one 1,314-line file. Split it into smaller, clearly named pieces so future changes are faster and less risky. Nothing you can see or do in CHEESECrypt changes: same buttons, same layout, same fees, same messages, same saved settings.

## Safety rules (apply to every step)
- Move code only. No rewording, restyling, renaming of saved settings, or logic changes.
- All the page's memory (open chat, drafts, read markers, sidebar hidden/shown, groups, friends, keys) stays in one place, exactly as now. Moved pieces only display things and pass clicks back.
- One small step at a time. After each step:
  1. All 413 automated checks must still pass.
  2. A before/after screenshot comparison of the page (locked screen, chat with sidebar shown, sidebar hidden, a group with Members open, the menu open) must match pixel for pixel.
  3. The build must be clean.
- If any check differs, that step is undone and reported to you instead of patched over.
- You can stop after any step and keep what is done; each step stands on its own.

## Steps
1. Move the single message bubble (text, reply quote, right-click Reply menu, highlights) and the small download helper into their own files. Lowest risk: they already work as self-contained pieces.
2. Move the page heading area (orb, antique key title, About) into its own piece.
3. Move the locked / set-up-your-key screen into its own piece.
4. Move the chat footer (counter, Attach NFT, voice, Terms, Fee info, price, Send) into its own piece, keeping both the expanded and compressed line orders.
5. Move the chat title bar (friend/group title, Members dropdown, Edit/Leave group) into its own piece.
6. Move the sidebar (profile box, Menu, hide arrow, message requests, Groups, Friends with both badges) into its own piece.

Expected result: the main page file drops from about 1,300 lines to about 600, holding only the page's memory and actions; the visual pieces live beside the other CHEESECrypt parts.

## Not included
- Splitting the messaging logic itself (sending, decoding, unread counting). It is the riskiest part, and it already has its own tested files. Leaving it alone is the safe choice.
- Other large files (airdrops, farms, DAO). They can follow the same approach later if you want.

## Technical details
- New files under `src/components/crypt/`: `ChatMessageItem.tsx`, `cryptDownload.ts`, `CryptHero.tsx`, `CryptKeySetup.tsx`, `CryptComposer.tsx`, `CryptChatHeader.tsx`, `CryptSidebar.tsx`.
- State, refs, effects and handlers stay in `Messenger` in `src/pages/CheeseCrypt.tsx`. Extracted components get explicit props; no new context, no hooks moved. The `Messenger` export and the DOM, class names, aria labels and test hooks (e.g. `crypt-members-pop`) stay the same, so existing tests guard the moves unchanged.
- Plain function components only (no forwardRef), avoiding the earlier hot-reload crash.
- Verification per step: `bunx vitest run`, build log, Playwright screenshots against a baseline taken before step 1 with a demo key and controlled chat data, compared by pixel diff.
- AGENTS.md gets one rule: CHEESECrypt page pieces are presentational; state lives in Messenger.
