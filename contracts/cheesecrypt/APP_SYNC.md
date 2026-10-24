# App ↔ contract sync checklist

Whenever a CHEESECrypt app feature changes, check this table and update the contract if the rule lives here too.

| App rule (source) | Contract location |
|---|---|
| Fees 0.0100 text / 0.0200 NFT first / 1.0000 voice / 0.0001 per copy (`cheeseCrypt.ts`, `cryptVoice.ts`) | `config` defaults, `platform_fee` |
| 80% eosio.null / 20% xcheeseliqst, integer split (`cheeseCrypt.ts`) | `pay_platform` |
| Private cap 8, public cap 50 (`cryptInviteGroups.ts`) | `config.private_cap/public_cap`, `addmember`, `deliver` |
| Max parts 35 (`MAX_MEMBERSHIP_PARTS`) | `config.max_parts` |
| Room listing fee 0.0100 (`cryptRooms.ts`) | `setpublic` |
| Founders frozen at first public listing (`cryptModeration.ts`) | `setpublic` (`ever_public`, `founder`) |
| Mutes 15m/1h/6h/24h, owner immune, muted admins act as members | `muteuser`, `live_role` |
| Owner-only bans, founders immune, ban removes admin | `banuser` |
| Admin collapse blocked on owner/founders | `collapsemsg`, `uncollapse` |
| 24h edit window, 72h owner edit-log retention (`cryptEdits.ts`) | `config.edit_window_sec/receipt_keep_sec`, `editmsg` |
| Memo ≤ 256 bytes (eosio.token) | `deliver` |

Not in the contract (stay client-side): encryption, key files/locking, profiles/avatars, block list,
public inbox, message reports (encrypted CG2 `report` notices: members → owner + admins, admins → owner; ordinary messages with the normal per-copy fee), mute *hiding* of traffic sent during a mute, reply metadata.
