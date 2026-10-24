# Room moderation from the message right-click menu

## What changes
In public rooms, owners and admins moderate straight from a message's right-click (or long-press) menu. The separate moderation screens go away.

Menu order, under the existing Reply / Edit / Collapse message:

- **Mute user** — opens a small submenu: 15 minutes, 1 hour, 6 hours, 24 hours. Owners and admins see it.
- **Ban user** — owners only. It shows dimmed and can't be clicked when the author is a founding member, with "Founding member — can't be banned" beside it.
- **Make admin / Remove admin** — owners only, replacing the old moderation screen.

Each command still opens the same pay-and-confirm window as today, with the same cost.

The menu only shows commands that can actually be carried out. Nobody sees moderation items on their own messages or on the owner's messages. Admins never see Ban or admin commands. Already-banned members get no moderation items.

## Removed
- The "Moderate members" button in the Edit group window (owner).
- The "Moderate" button in the chat header (admin).
- The members moderation window behind them.

## Technical details
- `ChatMessageItem`: add optional `onMute(minutes)`, `ban` (`{ disabled: boolean } | undefined`, with an `onBan` handler) and `adminToggle` (`{ isAdmin: boolean, onToggle }`) props. Render them using the `ContextMenuSub` / `ContextMenuSubTrigger` / `ContextMenuSubContent` parts already in the context-menu component; ban uses `ContextMenuItem disabled` (which draws it faded). Widen the menu's `disabled` condition so a menu with only moderation items still opens.
- `CheeseCrypt.tsx` message map: work out per-message permissions with the existing helpers so the menu matches what `moderationPlan` would accept:
  - mute: `canMuteMember(...)`
  - ban: owner && listed && author is not the owner && not banned; disabled when `founderBadges(...)` includes the author
  - admin: owner && listed && author is not the owner
  
  Each handler calls the existing `setPendingModeration({ id, member, action, minutes })`.
- Remove the `moderatingRoom` state, the `RoomModerationDialog` usage and file, the Edit-group button, and the header's `onModerate` prop/button.
- Tests: update `cryptModerationFlow.test.tsx` to drive mute/ban/admin through the right-click menu, and add an assertion that Ban is disabled for a founding member and missing for admins.
- Update the moderation memory note (moderation is reached from the message menu).
