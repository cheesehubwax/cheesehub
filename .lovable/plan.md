# Bigger CHEESECrypt chat window

## What changes
1. **Profile box always visible** (the part above your blue line): avatar, name, pencil, account and refresh stay exactly as now.
2. **Menu button in that box.** A "☰ Menu" dropdown sits inside the profile box. It holds every action now shown as buttons: Restore, Public key, Publish, Back up, Blocked (with count), New key, Inbox. Each does exactly what it does today.
3. **Hide / show the rest of the sidebar.** A small arrow button in the profile box hides Message requests, Groups and Friends.
   - Hidden: the chat takes the full width; the profile box becomes a slim strip across the top of the chat card so your avatar, name, account, Menu and the show-arrow stay visible.
   - Shown: back to the current side layout.
   - Your choice is remembered on this device.
   - Unread and @reply alerts still show on the arrow (dot with count) while the list is hidden, so you don't miss messages.
4. **Taller chat.** The long fee explanation under the Send row becomes a "ℹ️ Fee info" button; clicking it opens the same text right below the button, clicking again closes it. The voice-note fee note goes inside it too. The cost next to Send and the Terms checkbox stay visible. The chat card grows from 70% to about 80% of the screen height.

## Not changing
Fees, messages, Terms checkbox, groups and friends behaviour.

## Technical details
- `src/pages/CheeseCrypt.tsx`: replace the CardAction grid with a shadcn `DropdownMenu`; Inbox opens `PublicInboxDialog` via controlled `open` state (no trigger inside the menu, to avoid the earlier crash). Blocked/inbox dialogs open after the menu closes.
- Sidebar state `cheesecrypt-sidebar-collapsed-<account>` in localStorage; grid switches `md:grid-cols-[240px_1fr]` to one column with the profile strip as a row above the chat.
- Fee text wrapped in a `Collapsible` (closed by default) below its trigger; height `h-[80dvh]`.
- Update messenger tests that click the old buttons (open Menu first) and add tests: menu items run the same actions, collapse persists, fee info toggles. Browser-check both states.
