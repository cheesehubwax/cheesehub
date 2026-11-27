# Night schedule for the local test runner

## Goal
Hide the "this account goes quiet at night" signal. While you sleep, your own account (and optionally your test accounts) sends a small, random number of normal-looking messages to accounts you control, so your on-chain activity has no clean daily gap.

## How it behaves
- You set a quiet window in your local time (for example 23:00–06:30) and a timezone.
- Each night the runner rolls how many sends to make: a random number between a min and max (for example 0–3), with a chance of skipping the night entirely so it is never a fixed pattern.
- Send times are spread randomly across the window, never on round minutes, and each night is different.
- Each send goes from one of your accounts to another account in your pool, picked at random. Optionally the receiving account replies after a random 3–15 minutes, so it looks like a short exchange.
- Outside the quiet window the night schedule does nothing; the existing daytime behaviour carries on unchanged.
- Messages are the same padded, encrypted-looking memos the runner already sends, through the same Tor helper, one broadcast attempt each.

## Safety rules (unchanged from today)
- Only the restricted `cheesecrypt` key is used; active/owner keys are still refused.
- Daily send cap, CHEESE reserve, CPU checks and the 0.01 CHEESE auto power-up all apply to night sends.
- Only accounts listed in your config ever send or receive. No outside person ever gets a message.
- If the Tor helper is down, nothing is sent (no public fallback).
- A restart mid-night does not re-send: tonight's plan and what was already sent are saved locally.

## Your config (new section, all optional)
```text
"night": {
  "enabled": true,
  "timezone": "Australia/Brisbane",
  "start": "23:00",
  "end": "06:30",
  "sendsMin": 0,
  "sendsMax": 3,
  "skipNightChance": 0.15,
  "replyChance": 0.5,
  "replyDelayMinSeconds": 180,
  "replyDelayMaxSeconds": 900,
  "senders": ["your.account", "pop.chz"]
}
```
`senders` lists which of your configured accounts may send at night. To include your personal account, add it to the bots list with its own `cheesecrypt` key, the same way as the test accounts.

## Build order
1. Add the night schedule rules (window check across midnight, nightly plan, reply planning) to the runner's shared rules file, with tests.
2. Add config checks for the new section with clear error messages.
3. Hook the nightly planner into the runner loop; save tonight's plan and progress locally.
4. Add a dry-run printout of tonight's plan (times and pairs) so you can check it before going live.
5. Update the README with one neutral line about the night schedule settings, and the folder's AGENTS.md rule.

## Technical details
- Location: inside `scripts/synthetic-test/` (reuses `buildSend`, `refuseSend`, `ensureCpu`, permission checks, Tor broadcast) rather than a new folder.
- New pure functions in `policy.ts`: `inQuietWindow(nowMs, tz, start, end)` using `Intl.DateTimeFormat` (handles DST and windows crossing midnight), `planNight(cfg, nightKey, rand)` returning sorted `{atMs, sender, recipient, reply?}` entries, `nightKey(nowMs, tz)` keyed to the window's start date.
- State file `night-state.json` (git-ignored): `{ nightKey, plan, sentIds }`; rebuilt only when `nightKey` changes; entries more than 10 min overdue after a restart are dropped, not bunched.
- Night sends count toward `maxSendsPerBotPerDay` and are excluded from organic-burst detection (bot accounts already are).
- Tests: window across midnight and DST, skip-night probability bounds, min/max counts, no self-sends, senders limited to config, restart does not duplicate, reply delay range.

## Risks to know
- Legal/liability: this is cover traffic between accounts you own, paying normal fees; no funds are pooled or mixed, so it is not a mixer. Keep it bot-to-bot and keep docs factual.
- Patterns can still leak if the window is identical every night; the random skip and spread reduce this but the start/end you choose is still a weak signal. Consider varying them by ±30 min (optional below).
- Fees: about 0.0101 CHEESE per paid send, or free when sponsor budget allows.

## Optional ideas
- Randomly jitter the window edges by up to ±30 minutes each night.
- Occasional daytime "gaps" so quiet periods also appear when you are awake.
