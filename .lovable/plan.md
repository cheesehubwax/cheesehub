# CHEESECrypt About page overhaul

## Audit findings

Current page: intro + 8 long paragraphs + 3 extra blocks + 2 tables + 7 more paragraphs, in no logical order (e.g. costs appear twice, key safety appears three times, Respect is one 200-word list of numbers).

Duplicated topics
- Key safety: "Get started", "Keep your key safe", and the cryptography dialog's limits.
- Costs: "Get started" (500 CHEESE), "Free messages", "Costs and records", "Voice notes", "Publishing".
- Public vs private: "What is private and what is public", "Privacy & verification", "Network privacy", cryptography dialog.
- Listing fee/curated directory: "Costs and records" and "Public rooms and takedowns".

Outdated or wrong
- "Free messages" says CPU is "usually covered by Greymass Fuel" — Fuel is disabled on CHEESECrypt; users need their own CPU (CHEESEUp).
- "Network privacy" never mentions the Tor helper, Random Send Delay, scheduled sends or Nightcrawler, which now live in the Privacy menu.

Too detailed for an overview
- Respect: full points table. Voice notes: per-batch fee arithmetic. Instant Messaging: RAM/ram.chz mechanics. YouTube: mirror names and fallback internals. Moving device: step-by-step.

## New structure

Short intro (2 sentences), then 6 grouped sections. Each uses short bullet points, no paragraph over ~2 lines.

```text
1. 🚀 Getting started      key creation (500 CHEESE once), Anchor lock, adding friends, backups, moving device
2. 💬 Chats & rooms        private chat / group / public room comparison table (kept, trimmed)
3. ✨ Messaging features   replies, edits, reactions, search, voice notes, NFTs, YouTube, tips, profiles
4. 🛡️ Privacy & security   what's private vs public, padding, ✔/✔✔, Verify, panic lock, Instant Messaging,
                           Privacy menu tools (Tor helper, send delay, scheduling, custom server) + cryptography link
5. 🧀 Respect              what it is and why (points below), no points table
6. 👑 Public room moderation  roles table (kept), short rules
7. 💰 Costs                one small table: free text, paid part, voice, key, publish, join, listing
8. ⚖️ Your responsibility  responsibility, reports/takedowns, Terms link
```

Respect section (example of the new style)
- A quick public-data signal shown next to strangers, join requests and group members.
- Rewards real involvement in CHEESE: holding, liquidity (weighted highest), faucet staking, NFTs, account and key age, .cheese/.chz names.
- Six marks from 🪤 Warning to 🏆 Huge Respect; * means some data couldn't be read.
- Others see only your total; tap your own badge for your breakdown.
- Not identity verification — use your own judgement.

## Technical details

- Rewrite `src/components/crypt/CryptAbout.tsx` only; `DappAbout` and other dApps' guides untouched.
- Pass empty/short `sections` and render grouped bullet sections via `extra` with a small `Bullets` helper; keep `Grid`, the two role tables (trimmed) and the cryptography dialog (fix nothing in it except keeping it accurate).
- Fix the Fuel statement; keep fees, labels ("fee", never "stake"; "nulled", never "burn") as per memory.
- Verify in the browser on desktop and mobile; update the crypt-about memory to say "concise, grouped bullet points".

## Optional ideas
- Make each About section collapsible like the Network Privacy menu.
