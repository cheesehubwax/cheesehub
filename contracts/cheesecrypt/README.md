# CHEESECrypt contract (WAX)

Routes end-to-end encrypted CHEESECrypt copies, splits fees (80% `eosio.null` / 20% `xcheeseliqst`)
and stores public-room state (owner, admins, founders, mutes, bans, collapses). It never sees plaintext.
No anonymity/mixer features by design.

## Build
Install the Antelope CDT (v4+, provides `cdt-cpp`), then:
```
./build.sh          # -> build/cheesecrypt.wasm, build/cheesecrypt.abi
```

## Deploy (example account `cheesecrypt1`)
```
cleos -u https://wax.greymass.com set contract cheesecrypt1 build cheesecrypt.wasm cheesecrypt.abi
cleos -u https://wax.greymass.com set account permission cheesecrypt1 active --add-code
```
`--add-code` adds `cheesecrypt1@eosio.code`, needed for the inline CHEESE transfers.
Defaults match the app (see `include/cheesecrypt.hpp` `config`); `setconfig` changes them, `setpaused` halts sends.

**RAM:** the contract pays for deposit rows, and `cheeseburger` charges the contract RAM the first time
it pays an account that has never held CHEESE. Buy a buffer (e.g. 100 KB+) and watch it.
Rooms, members, mutes, bans, collapses and receipts are paid by the account that creates them.

## How a user pays
1. Transfer CHEESE to the contract (any memo) → credited to their deposit (`balances`).
   The app can put this transfer and the action in the **same transaction**, so it is still one signature.
2. `sendmsg(sender, room_id, kind, parts, copies)` — `room_id` 0 = DM/legacy group.
   Kinds: 0 text/control (0.0100/part), 1 NFT (0.0200 first part + 0.0100/extra part), 2 voice (1.0000 once).
   Every copy costs 0.0001 CHEESE and is delivered as a CHEESE transfer carrying the same memo
   the app writes today, so existing history reading and decryption keep working unchanged.
3. Left-over deposit: `withdraw(owner, quantity)`.

## Actions
| Action | Who | Rule |
|---|---|---|
| `createroom` | anyone | registers an app group id, caller becomes owner |
| `addmember` | owner | private cap 8, public cap 50, banned accounts refused |
| `setpublic` | owner | first listing freezes founders forever; unlisting needs ≤ 8 members; costs 0.0100 |
| `leave` | member | owner cannot leave |
| `setadmin` | owner | public rooms only |
| `muteuser` / `unmuteuser` | owner, admin | 15m/1h/6h/24h; nobody mutes the owner; muted admins lose powers |
| `banuser` / `unbanuser` | owner | founders immune; removes membership and admin role |
| `collapsemsg` / `uncollapse` | owner, admin | admins can't touch owner/founder messages |
| `editmsg` | author | references the `msgreceipt` id, within 24h, same room/kind |
| `prunercpts` | anyone | deletes receipts older than 72h |

## Limits to know
- A muted sender is rejected at `sendmsg`; the app still hides anything that slips through.
- Bans stop future copies; keys/messages already delivered can't be revoked.
- Collapses mark messages only; chain copies stay forever.

**Not audited.** Test on WAX testnet first (`https://testnet.waxsweden.org`).
