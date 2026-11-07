# Secret Chats: always user-paid (never sponsored)

## Goal
Every Secret Chat message (`CRYPTS1:` fragments, and later invites/accepts) is paid by the sender using the normal paid route (CHEESE payment + `sendmsg` in one transaction, 80/20 split, change refunded). The `crypt.cheese` 200 CHEESE/day sponsor budget never pays for Secret Chat traffic. Ordinary chats, rooms, reactions and NFT shares stay sponsored exactly as today.

Secret Chat sending stays switched off; this change sets the payment rule now so it is locked in before the handshake work.

## What changes

1. **App rule (enforced in one place)**
   - The function that converts a paid message into a free `sendfree` will refuse any message whose copies carry a Secret Chat memo (`CRYPTS1:` prefix, plus any future Secret Chat prefixes defined in one shared list). Those messages stay as payment + `sendmsg`.
   - The "free budget reached — resend as paid?" fallback is unaffected; Secret Chats are already paid so it never triggers for them.
   - Instant Messaging session keys only authorise `sendfree`, so Secret Chat sends will always use the normal Anchor wallet prompt. This is noted in the UI copy later and in docs now.

2. **Contract rule (optional hardening, needs a recompile/redeploy)**
   - Add one check in `sendfree`: reject any copy whose memo starts with `CRYPTS1:` ("secret chats are user-paid"). This stops a modified app from making the sponsor pay for Secret Chats.
   - No new tables, no custody change, no fee change. Paid `sendmsg` is unchanged.
   - Can be deployed whenever convenient; the app rule works without it. Docker Desktop build/deploy steps for your folder (`C:\Users\User\Desktop\wax contracts\cheesecrypt`) will be included in the README update.

3. **Fee shown to users**
   - Secret Chat parts cost the same as normal paid parts today (uniform per-part fee, 80% nulled / 20% `xcheeseliqst`). No surcharge.

4. **Docs and records**
   - Update `APP_SYNC.md`, contract README, `.lovable/crypt-secret-chats.md`, About text (Secret Chat section, marked "coming soon"), project memory (fees + Secret Chats), and `roadmap.md`.

5. **Tests**
   - Secret Chat fragment message stays paid even with full budget.
   - Normal text message still becomes `sendfree` (regression).
   - Mixed message containing any Secret Chat copy stays paid.
   - Contract rule test (existing contract rule-test harness) for the `sendfree` rejection.

## Legal / liability note
User-paid Secret Chats mean the sponsor never finances forward-secret content it cannot inspect, which lowers the funding-intermediary risk discussed earlier. It does not remove all risk: `crypt.cheese` still routes the fee, and the immutable encrypted memos remain on a public chain. Not legal advice.

## Technical details
- `src/lib/cryptSponsor.ts`: in `sponsorCryptActions`, return `actions` unchanged when any `copies[i].memo` starts with a prefix from a new `SECRET_CHAT_PAID_PREFIXES` export in `cryptSecretWire.ts`.
- `contracts/cheesecrypt/src/cheesecrypt.cpp` `sendfree`: `check(c.memo.rfind("CRYPTS1:", 0) != 0, "secret chats are user-paid");` inside the copies loop.
- No change to `CheeseCrypt.tsx` send flow, history parsing, or delivery attribution.
