# CHEESECrypt atomic blind payment router (WAX)

Routes opaque encrypted memo copies and atomically splits platform fees 80% to `eosio.null`,
20% to `xcheeseliqst`. **No rooms, members, room owners/admins, founders, mutes, bans,
collapse targets or edit receipts are registered.** There are no role-management actions.

**Zero custody: the contract stores no user balances.** The only tables are `config` and the
transient `pending` table. A payment arrives as a token transfer and is consumed by `sendmsg`
in the **same transaction**; the fee split, recipient copies and any change are paid out inline
before the transaction ends. If anything fails, the whole transaction — including the sender's
payment — rolls back, so the router never holds funds between transactions. A `pending` row's
`payer` is a fee payer, not a room role.

The app still uses direct peer-to-peer transfers. **Do not switch it to this contract before the
history adapter is implemented and verified on testnet.** This is an ABI-breaking replacement
of the earlier draft, not an automatic migration. It is not audited or production-approved.

## Build and local tests
Install Antelope/WAX CDT v4+ (`cdt-cpp`) and a native C++17 compiler:
```sh
./build.sh                    # build/cheesecrypt.wasm + build/cheesecrypt.abi
bash tests/run.sh             # shared fee-arithmetic and hard-bound tests
```
Local tests are not chain execution tests. Verify same-transaction payment + send, underpayment,
overpayment change, orphaned-payment reclaim, unauthorized calls, rollback after a failed
recipient transfer, paused behavior, recipient coverage, RAM and practical transaction sizes
on testnet before launching.

## Deployment
Mainnet contract account: **`crypt.cheese`** (a `.cheese` suffix name, created by the `cheese`
account owner). Test on a dedicated testnet account first (replace the testnet account name):
```sh
cleos -u https://testnet.waxsweden.org set contract <testnet-account> build cheesecrypt.wasm cheesecrypt.abi
cleos -u https://testnet.waxsweden.org set account permission <testnet-account> active --add-code
# Mainnet, after testnet gates pass:
cleos -u https://wax.greymass.com set contract crypt.cheese build cheesecrypt.wasm cheesecrypt.abi
cleos -u https://wax.greymass.com set account permission crypt.cheese active --add-code
```
The code uses `get_self()`, so no account name is compiled in; the app reads it from
`CRYPT_ROUTER_ACCOUNT` in `src/lib/cheeseCrypt.ts`.
`--add-code` adds the contract's `eosio.code` permission for inline CHEESE transfers.
The default token is `cheeseburger` / `4,CHEESE`; deploy/configure the corresponding test token
if those accounts do not exist on testnet. Review `config` and fund resource buffers first.
Do not overwrite an already-used stateful draft: old table rows and action history do not
vanish when code/ABI changes. A fresh account avoids incompatible config serialization and
stranded old tables. Public data already recorded cannot be made private retroactively.

## Actions and payment
| Action | Required authority | Effect |
|---|---|---|
| `setconfig(cfg)` | contract | Sets bounded fee amounts, sinks, operational limits; split must remain 80/20 |
| `setpaused(paused)` | contract | Stops payments and sends; `reclaim` remains available |
| token `transfer(from, contract, quantity, memo)` | payer | Records a transient in-flight payment from the configured token only |
| `sendmsg(sender, parts, copies)` | sender | Consumes the payment, pays the shared platform fee, delivers all copies and returns change, atomically |
| `reclaim(payer)` | payer | Refunds a payment orphaned by an incomplete transaction flow |

The intended transaction is two actions with one signature: `transfer` the exact fee to the
contract, then `sendmsg`. `copies` is an array of `{to,memo}`. Each distinct recipient must
receive exactly `parts` copies. Self/contract recipients are rejected; recipient accounts must
exist, and memos must be 1–256 bytes. No room ID is supplied. Overpayment is returned to the
sender as change in the same action. Hard limits: 35 parts and 49 recipients per action
(1,715 copies); `config` can lower these, not raise them. These are transport bounds, **not**
proof of an 8/50-member room. Chain CPU/NET/transaction limits can be substantially tighter;
max-size delivery is not verified.

Default fees (four decimal CHEESE):
- Every message (text, NFT, voice parts, join requests, links, controls, edits, reports): 0.0100 per part, shared across
  recipients. There is no message type parameter or content-specific fee; sizes and traffic patterns can still distinguish activity.
- Every delivered copy adds 0.0001, paid to its recipient, not split.
- Split uses integer floor for the 80% share; the remainder goes to liquidity.

The app charges text, NFTs and voice the same 0.0100 per encrypted part. Each voice batch
(up to 30 parts) pays its own shared per-part platform fees plus recipient carriers: 30 parts
cost 0.3000 platform fees, or 0.3030 total for one recipient. No cross-action flat-fee continuation
is needed. Join/rejoin requests cost the ordinary 0.0101 total, without an owner surcharge.
Both paths remain direct until authenticated router history and practical resource limits are verified;
request-carried keys and ciphertext sizes still distinguish some requests. No source/ABI change is required.
Public key publishing, 100-CHEESE key creation and `CRYPTROOM1:` listing/unlisting also stay
on the existing direct path; generic router fee memos are not listing or key publications.

## Privacy and authority boundaries
- Removing tables avoids explicit role/roster disclosure, **not anonymity**. WAX still exposes
  the authenticated sender, recipient array, ciphertext sizes, amounts and transaction grouping.
  Traffic analysis can infer relationships/possible roles. Public listings deliberately reveal creators.
- Moderation/membership/founder immunity and 24-hour edits remain client-validated encrypted CG2
  history, including after launch. A correctly validating client rejects unauthorized controls;
  the router does not give anyone admin/owner powers and does not validate room privileges.
- A modified client can ignore mutes/collapses/bans, send direct transfers, omit recipients,
  repeat ciphertext or share held keys. The contract cannot prevent those behaviors.
- Group keys do not authenticate room-owner authority by themselves: readers must bind controls
  to the chain-authenticated original sender and replay validated authority in order.
- Bans exclude future copies from compliant senders; no held key/message can be revoked and
  neither collapse nor receipt removal can delete immutable blockchain data.
- All transfers roll back together if any delivery fails. A fee sink or recipient contract can
  reject its transfer; the router cannot guarantee delivery to arbitrary recipient code.

## Required history adapter before app integration
Outgoing token transfers have `from = contract`, **not sender**. The current reader chooses
decryption keys and CG2 authority using `from`, so forwarding identical memos alone is not compatible.
Read the authenticated `sendmsg` action and its exact delivered inline transfers from chain
traces, binding them by transaction **and action ancestry**, not just matching a transaction ID.
Multiple sends can coexist in a transaction. Normalize original sender/to, keep original
transaction identity/time for multipart assembly and edit digests, and de-duplicate notifications.
Never accept a sender claimed solely in a memo; never reinterpret arbitrary contract transfers
as user-authenticated messages. Test sender history discovery as well as recipient decryption.

## Funds, RAM and operator trust
Payers pay their `pending` row RAM, freed when `sendmsg` or `reclaim` erases the row. Inline
token transfers may bill the router RAM when recipients have no CHEESE balance; buy a buffer and
monitor it. Large sends also require CPU/NET. Config and deployed code remain controlled by the
contract account: secure its permissions; changing code can change routing rules. Fee amounts
and sinks are configurable and must be checked before signing; per-fee values are bounded to
100,000,000 smallest units for safe arithmetic. Always fund with the exact same-transaction
payment; `reclaim` exists only for payments orphaned by an incomplete flow, not for savings.
