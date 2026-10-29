# App ↔ blind router sync checklist

The contract is a blind atomic payment router, not a room/moderation authority, and it holds
no user balances (zero custody). The app is still on direct peer-to-peer transfers; deployment
and history integration are pending. Update this checklist with every CHEESECrypt change, but
do not reintroduce plaintext roles to enforce client policy.

| App rule / source | Router responsibility / integration status |
|---|---|
| Text 0.0100/part, NFT first 0.0200 + 0.0100/rest (`cheeseCrypt.ts`) | `config`, `platform_fee`; caller-declared kind, bounded arithmetic |
| Voice 1.0000 once/note, 30-part batches (`cryptVoice.ts`) | 1.0000 per `sendmsg` call only; multi-call continuation NOT supported; retain direct voice path |
| Recipient 0.0001 per part | `recipient_fee` per copy; exact `parts` copies per distinct recipient |
| Shared 80% eosio.null / 20% xcheeseliqst | `pay_platform` integer split; `setconfig` requires 80 |
| Key creation 100 CHEESE, publishing fee | Existing direct-transfer path, not router messaging |
| Mandatory Anchor-locked keys; legacy upgrade before use; locked-only backups | Client-only seal/unlock verification; no router changes; creation fee unchanged |
| Private 8 / public 50; only owner admits (`cryptInviteGroups.ts`) | Client-only authenticated envelopes; router bounds 49 recipients per action, not total membership |
| 35 membership parts, usual text 20 | Router hard bound 35; client keeps content-specific bounds |
| CRYPTROOM1 listing stake 10.0000 (new/re-list), updates and unlisting 0.0100 (`cryptRooms.ts`) | Existing plaintext fee-leg broadcasts; no rooms table/action; no generic router fee substitution |
| Listing optional username (`u`), presentation only; creator identity stays transfer sender | Direct listing metadata; no router change |
| Immutable first-public founder roster | Client-only encrypted policy replay |
| Owner/admin appointment, mute, ban, collapse (`cryptModeration.ts`) | Client-only authenticated CG2 authority; NO moderation actions/tables |
| Admin cannot ban; founders ban/admin-collapse immune | Client-only; do not infer role from fee kind, pending payer or recipient array |
| Mutes permanently suppress send-time traffic/quotes | Client-only presentation/filtering; malicious clients can ignore it |
| Reports member→owner+admins, admin→owner | Encrypted ordinary text controls; notifications only; no report table |
| Join requests 0.1000 CHEESE owner fee + 0.0001 copy + 0.0100 platform = 0.1101 (`cryptRooms.ts`) | Separate plain direct transfer to the creator; not routed, no router fee kind |
| Join-request declines (`join-no`) creator→requester | One encrypted part with the normal message fee; notification only; no request table |
| Edits 24h, owner log 72h (`cryptEdits.ts`) | Client-only same-sender/conversation digest resolution; no edit receipts/table/action |
| Memo ≤256 bytes | Router checks memo byte length, not plaintext semantics |
| Authenticated original sender (`cheeseCrypt.ts`, `cryptGroups.ts`) | REQUIRED new trace adapter: verify sendmsg authority + inline transfer ancestry; normalize sender before decryption/authority replay |
| TX IDs, Greymass Fuel, success before local state | Keep existing signing requirements; verify router delivery traces and rollback on testnet |
| Account recovery and tab sync (`cryptRestore.ts`) | Client-only: outgoing authenticated DM proves friendship; matching own join/request proves room consent; listing keys remain scoped; no router change |
| Zero custody: no stored user balances | Payment transfer + `sendmsg` in one atomic transaction; transient `pending` row consumed same-tx, change refunded inline; `reclaim` only for orphaned payments |

Only tables: `config`, `pending` (transient, erased on use). Only explicit actions: `setconfig`,
`setpaused`, `reclaim`, `sendmsg`; configured-token transfer notifications record in-flight
payments. ABI breaks from old drafts.

## Integration gates (not yet verified)
- Deploy fresh testnet contract; never assume old tables/config automatically migrate.
- Exercise auth, exact same-transaction payment, underpayment rejection, overpayment change,
  orphaned-payment reclaim, exact fee split, denomination lock, paused behavior, invalid shapes,
  missing recipients and atomic failure rollback through real chain execution.
- Add trace-backed original-sender history discovery for both parties; multiple router actions
  in one transaction must not cross-attribute copies. Never trust memo-only sender fields.
- Verify legacy/new encrypted text, NFT, complete membership/admissions, edits, reports and
  send-time moderation with that adapter; preserve transaction IDs and notification deduplication.
- Keep key publishing/listings/voice on direct paths until their own compatibility gates pass.
- Measure maximum usable fanout under WAX transaction size/CPU/NET and Fuel limitations.

Native shared-rule tests cover pricing/splits/hard bounds; they are not an audit or chain tests.
Privacy is reduced explicit metadata, not hidden senders/recipients or guaranteed secret roles.
- Join notes: optional encrypted ≤60-char note on join/admission/join-no; client-only, no contract change.
- Room profile directory: owner adds one encrypted CG2 `profiles` message (≤20 parts) to the newcomer in the admission transaction; display-only, client-only, no contract change. Router must keep it in the same transaction as the admission.
- Room profile sync: any member may send one encrypted CG2 `profiles` message with a single self entry (their own name/picture) to the group's current members, priced as a normal group message; display-only, client-only, no contract change.
- Admission policy snapshot may carry optional `x` (members who left) so newcomers' member lists match; owner-signed, client-only, no contract change.
- Voluntary leavers must request owner approval (ordinary join-request fee); readmission delivers a fresh retained-key-compatible bootstrap, profiles and policy/departure snapshot. Owner-authenticated CG2 `readmit` controls authorize subsequent `joined` notices to existing members; self-joined/messages cannot undo a leave. Shared platform/delivery fees remain unchanged; no router/ABI change.
- Live owner join/rejoin counters, toast/chime and in-chat controls share the authenticated pending list; individual confirmed handling clears all matching alerts immediately. Client-only presentation/receipts; fees, envelopes and router ABI unchanged.
