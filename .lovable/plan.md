# CHEESECrypt privacy disclaimer and liability terms

## What is already there
- The CHEESECrypt About guide already lists "Public on WAX" (sender, recipient, timestamps, IDs, amounts) — but only inside the expandable cryptography details. The main intro just says "transaction activity remains public".
- The site Terms of Use (18 sections) has general No Warranties and Limitation of Liability clauses, but nothing about messaging, user content, public rooms or room takedowns.

## 1. CHEESECrypt About guide
- Add a short, always-visible **"What is private and what is public"** box at the top of the guide (not hidden in details):
  - Private: message text, voice notes, NFT IDs and group details inside messages — only the people in the chat can read them.
  - Public forever on WAX: who sent to whom, when, transaction IDs, amounts, number of parts, and anything you publish (public key, public room name/description, owner).
  - Nobody — including CHEESEHub — can delete anything from the blockchain, recover a lost key, or read your private messages.
  - Anyone you message can screenshot or share what you sent.
- Add a **"Your responsibility"** section: you alone are responsible for what you send, publish or list; CHEESEHub does not monitor, store, review or endorse private messages; public room listings can be hidden from CHEESEHub's directory but remain on-chain and on other sites.
- Link to the full Terms of Use.

## 2. Terms of Use — new section "CHEESECrypt Messaging"
Inserted after "Prohibited Use", covering:
- Software only: CHEESEHub provides client-side software; messages go directly on the WAX blockchain. It does not host, store, transmit, monitor, or have access to message content, and cannot decrypt it.
- Public metadata: sender, recipient, timestamps and amounts are public permanently.
- User content: users are solely responsible for all content they send, publish or list, and must comply with all laws. Illegal content is prohibited (extends Prohibited Use).
- Public rooms: listings are public; CHEESEHub may hide any listing from its own interface at its sole discretion without notice or refund; hiding never removes chain data. Listing fees are non-refundable.
- Keys: lost keys and messages cannot be recovered; no forward secrecy; encryption is not guaranteed against future attacks.
- No guarantee of delivery, privacy or availability; the `crypt.cheese` contract holds no funds and is provided as-is.

## 3. Strengthen general liability clauses
- **Limitation of Liability:** add explicit exclusion for user-generated content, messages, public room listings, data exposure via public blockchain metadata, key loss, and smart contract behaviour.
- **New "Indemnification" clause:** users indemnify the owner, CHEESE DAO and contributors against claims arising from their use, content or law-breaking.
- **No Warranties:** add that no warranty is made on encryption, anonymity or privacy.
- Bump the "last updated" date if present.

## Legal warning (important)
This wording reduces risk but is **not legal advice**, and some of it can't be enforced in every country (e.g. consumer law in Australia/EU won't let you exclude liability for everything). A disclaimer also doesn't protect you if you ignore a valid takedown notice for a public room. Before public launch, I strongly recommend having a lawyer review the Terms — especially as you're in Queensland.

## Technical details
- Files: `src/components/crypt/CryptAbout.tsx`, `src/components/shared/TermsContent.tsx` (renumber sections after insert).
- Copy only; no fee, contract or logic changes, so no `APP_SYNC.md`/contract update needed. No tests (copy is not tested by rule).
