# Network privacy for CHEESECrypt

Goal: stop public history servers from learning which WAX account a browser is watching, give privacy-minded users their own node option, and explain the rest honestly. No contract change, no fee change, no CHEESEHub-run server.

## What happens today (checked in code)

- Every 6 seconds while the chat is open, the browser asks the history servers for `account=<your account>` (sendfree actions and token transfers), then rebuilds the whole message list.
- So the server operator sees: this IP is watching `dr.cheese`, right now, every 6 seconds.

## 1. Private live checking ("contract stream")

- After the first load, the 6-second check stops naming your account. It asks only for the newest `crypt.cheese` actions (`sendfree` and `sendmsg`) since the last one seen — the same request every CHEESECrypt user makes.
- Your browser keeps only actions where you are the sender or a recipient, and adds them to the list already shown. Everyone else's encrypted copies are thrown away unread.
- Safety rules:
  - Cursor by timestamp plus transaction ID so nothing is skipped or doubled.
  - If more new actions arrived than one page holds (busy moment), it keeps paging back to the cursor, up to a fixed cap; if the cap is hit, it does one normal account check so nothing is missed.
  - Same message rules as today: sender must have signed, router copies credited only to the same-transaction signer, voice notes still only play when complete.
- Old-style messages sent as direct token transfers (pre-router history) are not in the contract stream; they are only needed for history, which the first load still covers.

## 2. Privacy mode setting (chat settings)

- **Standard (default):** first load asks for your account once (fast, full history), then live checks use the private contract stream. This alone removes the repeated "who is online" signal.
- **Maximum:** the first load also uses the contract stream, reading back up to a fixed number of pages and relying on the history already saved on this device. Slower on first open and may not reach very old messages; the screen says so and offers a one-off "Load older history (reveals your account to the server)" button.
- Saved per device.

## 3. Your own node (optional)

- A "Custom history server" box in chat settings: a user can enter their own Hyperion address (their own node, or one reached through a VPN/Tor setup on their computer).
- When set, CHEESECrypt uses it first, with a choice to use only it (no fallback to public servers).
- Address is checked to be https (or localhost) and tested once before saving. Stored only in this browser.
- Nothing is routed through CHEESEHub.

## 4. About section: "Network privacy"

Plain explanation of:
- History servers can see your internet address; CHEESECrypt now avoids telling them which account you are watching.
- What still reveals your account: signing with Anchor/Greymass Fuel, looking up a friend's published key, loading full history in Standard mode, and the public on-chain record of who messaged whom.
- A VPN or Tor hides your internet address itself; your own node removes the third party completely.

## Honest limits (will be stated in the app)

- Sending a message always shows your account on chain — that's how the blockchain works.
- The contract stream hides who is watching, not who talks to whom.
- Busy future traffic means more data per check; caps keep it bounded.

## Legal / liability flags

- Clean: reading the public contract stream and filtering on the device is ordinary light-client behaviour; no proxy, no logging, no custody.
- Avoid: CHEESEHub must never host a relay/proxy for users (would make it a network intermediary with logging/subpoena exposure). The custom server box only points the user's own browser at a server they choose.
- Mention VPN/Tor neutrally as general privacy tools; no recommendations of specific providers.

## Technical details

- `src/lib/cheeseCrypt.ts`: new `fetchContractStream(afterCursor)` using `hyperionActions('account=crypt.cheese&filter=crypt.cheese:sendfree,crypt.cheese:sendmsg&sort=asc&after=…')`, reusing `expandSponsoredActions` and the router attribution path; new `mergeMemos(prev, incoming)` (dedupe by `txId:memo`, newest first). `fetchMessages` gains a `mode` option for Maximum.
- `src/pages/CheeseCrypt.tsx`: `poll()` switches to stream + merge with a stored cursor; `refresh()` unchanged in Standard; overflow fallback calls `fetchMessages` once.
- New `src/lib/cryptNetworkPrivacy.ts`: mode + custom endpoint storage and validation; `endpointHealth.resolveEndpoints` gets an optional user-override first entry (and "only this server" flag) for the Crypt history calls, keeping HerdCheck ordering for the rest.
- New settings section component in `src/components/crypt/`; About entry in `CryptAbout.tsx`.
- Tests: stream filtering keeps only own sent/received copies, rejects unsigned senders, cursor dedupe, overflow triggers fallback, endpoint validation rejects non-https.
- Docs: `APP_SYNC.md` row (no contract change), `src/components/crypt/AGENTS.md` rule.
