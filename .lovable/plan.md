# Owner can make any member a permanent Founder

## What changes
- In a public room, the owner's right-click / long-press menu on a member's message gets a new item: **Make founder** (shown below Make/Remove admin).
- A confirmation explains it is permanent: the member gets the Founder badge and can never be banned, and admins can never collapse their messages. It cannot be undone, even by the owner.
- After it is sent, the member shows the Founder badge everywhere badges appear, and the owner's Ban user option is dimmed for them.
- Hidden for: the owner, people who are already founders, banned members, and private (unlisted) rooms.
- Cost: the same per-part message fee as other moderation controls (one copy per member, like admin appointment). No new fees.
- The About guide is updated: founders are the members present when the room was first listed, plus anyone the owner later names founder.

## Rules
- Only the owner can grant it; admins cannot.
- A banned member cannot be made founder (unban isn't possible, so this keeps things consistent). Granting must happen before any ban.
- Granted founder status survives unlisting/relisting and readmission, exactly like original founders.
- New members joining later receive the full founder list in their welcome package, so everyone sees the same badges.

## Technical details
- New authenticated encrypted CG2 control `founder { id, member }`, owner-only, accepted in `deriveModeration` only when the room is listed, the target is a current member, not the creator, not already protected and not banned at that chain time; it appends to `state.protected` (never removes). Chain ordering decides ban-vs-founder races.
- Readmission/policy snapshots already carry `protected`; `roomPolicyValid` must accept a roster that is a superset of the held one (still never a subset), so grants propagate to newcomers and relists without weakening immunity.
- Wire the menu item and confirm dialog in `CheeseCrypt.tsx` / message menu alongside the admin toggle; reuse the existing moderation send path and pending-moderation dialog.
- Contract stays a blind router: no founder data on-chain in plaintext.
- Tests: grant by owner accepted; grant by admin/member ignored; grant to banned or non-member ignored; ban after grant ignored; grant persists across relist and readmission snapshot; badge list includes granted founder.
- Update `mem://features/crypt-room-moderation` and the AGENTS.md moderation rule.

## Note
Like every Crypt moderation control, this is enforced by honest clients; it cannot be revoked once sent because blockchain copies are permanent.
