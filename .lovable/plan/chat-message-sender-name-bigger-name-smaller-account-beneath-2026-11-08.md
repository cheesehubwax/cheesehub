# Chat message sender name: bigger name, smaller account beneath

## What changes
In each chat message header (the name above every message):
- The display name (e.g. "cheesefist") becomes larger and bolder, so it is clearly the main label.
- The WAX account name (e.g. "fragglerockk") becomes smaller and dimmer, sitting directly under the display name with almost no gap.
- Owner/Admin/Founder badges and the Respect badge stay on the same line as the display name, unchanged in size.
- Your own messages ("you · name") follow the same layout.
- When the display name is the same as the account name, only one line shows (as today).

## Why the gap exists today
Both lines share one tiny 10px style, and the stacked role badges make the top line taller, pushing the account line down.

## Technical details
- File: `src/components/crypt/ChatMessageItem.tsx`, sender header (around line 88).
- Split the header into a two-line block with tight line height:
  - Line 1: `flex items-center gap-1` containing the name (`text-xs font-semibold leading-tight`), role chips and the inline Respect badge.
  - Line 2: account name `text-[9px] font-normal leading-none text-muted-foreground`, with a very small negative/zero top margin.
- No logic, data or badge-artwork changes.
- Verify with a screenshot of a group chat in the preview.
