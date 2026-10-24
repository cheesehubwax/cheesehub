# CHEESECrypt blind payment router (WAX)

Routes opaque encrypted memo copies and atomically splits platform fees 80% to `eosio.null`,
20% to `xcheeseliqst`. **No rooms, members, room owners/admins, founders, mutes, bans,
collapse targets or edit receipts are registered.** There are no role-management actions.
Only `config` and prepaid `balances` are stored. A balance's `owner` is the depositor, not a room role.

The app still uses direct peer-to-peer transfers. **Do not switch it to this contract before the
history adapter is implemented and verified on testnet.** This is an ABI-breaking replacement
of the earlier draft, not an automatic migration. It is not audited or production-approved.

## Build and local tests
Install Antelope/WAX CDT v4+ (`cdt-cpp`) and a native C++17 compiler:
```sh
./build.sh                    # build/cheesecrypt.wasm + build/cheesecrypt.abi
bash tests/run.sh             # shared fee-arithmetic and hard-bound tests
```
Local tests are not chain execution tests. Verify deposits, insufficient funds, unauthorized
calls, rollback after a failed recipient transfer, paused withdrawals, recipient coverage,
RAM and practical transaction sizes on testnet before launching.

## Deployment
Use a dedicated testnet account first. Example (replace account and endpoint):
```sh
cleos -u https://testnet.waxsweden.org set contract cheesecrypt1 build cheesecrypt.wasm cheesecrypt.abi
cleos -u https://testnet.waxsweden.org set account permission cheesecrypt1 active --add-code
```
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
| `setpaused(paused)` | contract | Stops deposits and sends; withdrawals remain available |
| token `transfer(from, contract, quantity, memo)` | depositor | Credits prepaid funds from the configured token only |
| `withdraw(owner, quantity)` | depositor | Returns only that account's balance |
| `sendmsg(sender, kind, parts, copies)` | sender | Debits sender, pays shared platform fee, delivers all copies atomically |

Deposit and send can share one transaction/signature. `copies` is an array of `{to,memo}`.
Each distinct recipient must receive exactly `parts` copies. Self/contract recipients are
rejected; recipient accounts must exist, and memos must be 1–256 bytes. No room ID is supplied.
Hard limits: 35 parts and 49 recipients per action (1,715 copies); `config` can lower these,
not raise them. These are transport bounds, **not** proof of an 8/50-member room. Chain
CPU/NET/transaction limits can be substantially tighter; max-size delivery is not verified.

Default fees (four decimal CHEESE):
- Kind 0 text/control/edit/report: 0.0100 per part, shared across recipients.
- Kind 1 NFT: 0.0200 first part + 0.0100 per remaining part.
- Kind 2 voice: 1.0000 **per router action**.
- Every delivered copy adds 0.0001, paid to its recipient, not split.
- Split uses integer floor for the 80% share; the remainder goes to liquidity.

**Fees are unchanged in the app, including moderation fees.** The blind contract cannot
verify the encrypted content's declared kind. It cannot prove a logical multipart message
or enforce one fee across multiple actions. In particular, the app's 30-part voice batches
charge 1.0000 once per whole note, while this action charges once per call. Keep voice on the
existing direct-transfer path until a separately reviewed continuation design exists.
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
Depositors pay their balance-row RAM (returned when emptied). Inline token transfers may bill
the router RAM when recipients have no CHEESE balance; buy a buffer and monitor it. Large sends
also require CPU/NET. Config and deployed code remain controlled by the contract account: secure
its permissions; changing code can change custody rules. Fee amounts and sinks are configurable
and must be checked before signing; per-fee values are bounded to 100,000,000 smallest units
for safe arithmetic. Token contract/symbol cannot change until every prepaid balance is withdrawn.
Prefer exact same-transaction funding rather than leaving substantial prepaid funds.
