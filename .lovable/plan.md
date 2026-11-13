# ALCORBridge (Option 3): /bridge page + CHEESEWallet deposit

## What you will get
1. **New ALCORBridge page (`/bridge`)** in the usual CHEESE style (emoji heading, BETA tag, floating orb).
   - Alcor's official two-way bridge widget, pre-filled with the signed-in WAX account as recipient and WAX as destination.
   - "Route status" card: which networks are online, minimum/maximum amounts, typical arrival time.
   - "Your transfers" card (signed in): in-flight and delivered bridge transfers with a progress bar, auto-refreshing while something is in flight.
2. **CHEESEWallet "Bridge In / Deposit" button**: shows your personal deposit address (one address for Ethereum, BSC and Polygon), copy button, QR code, supported tokens and minimums, plus "Open full bridge".
3. **Navigation**: ALCORBridge added to the dApp menu next to the other modules.
4. **Terms gate**: mandatory Terms of Use checkbox before the widget or deposit address is shown.

## Legal / liability flags (please read)
- **Non-custodial on our side**: CHEESEHub never holds, routes or signs bridged funds; Alcor operates the bridge. We must say this clearly on the page and in Terms ("third-party service, use at your own risk, CHEESEHub not liable for delays/losses").
- **Partner attribution (`partner: 'cheesehub'`)**: if Alcor pays referral revenue for this, earning commission on cross-chain transfers can look like brokering/money-transmission activity in some places. Default plan: **no partner tag** (no revenue). Tell me if you want it on anyway.
- **Deposit address from exchanges**: users sending from Binance/Coinbase on the wrong network or below the minimum can lose funds. We show prominent warnings with the live minimums; we cannot recover funds.
- **Sanctions/KYC**: we add no KYC (consistent with your rules) and give no advice; wording stays jurisdiction-neutral.

## Steps
1. Confirm Alcor's live widget script and endpoints (`/v1/routes`, `/v1/deposit-addresses`, `/v1/hops`) by fetching them, and record exact response shapes before writing code.
2. Data helpers with React Query caching: routes (5 min), deposit address (per account, cached), hops (poll 15s only while something is in flight, foreground only).
3. Build the page, widget mount (loaded only on this page, removed on leave), status and transfers cards.
4. Build the wallet deposit dialog with QR + copy.
5. Add route, nav entry, Terms text update, head metadata.
6. Tests for pure logic (route filtering, hop status → progress step, minimum formatting), then live check in the preview with a signed-in account.

## Technical details
- Files: `src/pages/Bridge.tsx`, `src/components/bridge/*` (one component per file), `src/lib/alcorBridge.ts` (fetch + pure parsing), `src/test/alcorBridge.test.ts`; route in `App.tsx`; button in the CHEESEWallet dialog.
- Widget script loaded dynamically from Alcor's official URL only; no other remote code. If the script fails, show a link to Alcor's bridge instead of a blank space.
- QR code: use an existing QR library if present, else add a small one.
- Unknown/failed API values show as "unavailable", never as zero.
