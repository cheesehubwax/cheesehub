# Free CHEESECrypt messages: launch steps from start to finish

This is a checklist for you to follow on your Windows PC. The app code and the contract code are already written. Nothing here changes code. Do the steps in order and don't skip any.

## Part A: Get the latest files onto your PC

1. Publish or sync the project so GitHub (bewbzz/cheesehub) has the latest code.
2. Get the code onto your PC:
   - If you already have the folder (for example `C:\cheesehub`), open it, then in GitHub Desktop click **Fetch origin** and then **Pull**.
   - If you don't, go to the GitHub page, click **Code → Download ZIP**, and unzip it to `C:\cheesehub`.
3. Check that this folder exists: `C:\cheesehub\contracts\cheesecrypt`. It should have `Dockerfile`, `build.sh`, `include`, `src` and `tests` inside.

## Part B: Compile the contract with Docker Desktop

1. Open **Docker Desktop** and wait until it says "Engine running" (bottom left, green).
2. Press the Windows key, type `cmd` and press Enter. A black **Command Prompt** window opens.
3. Go to the contract folder. Type this and press Enter:
   ```
   cd /d C:\cheesehub\contracts\cheesecrypt
   ```
4. Make the output folder (if it already exists, you'll see a harmless error):
   ```
   mkdir build
   ```
5. Build the compiler image. You only need to do this once, and it takes a few minutes:
   ```
   docker build -t cheesecrypt-cdt .
   ```
   The dot at the end matters. It should finish with "naming to docker.io/library/cheesecrypt-cdt".
6. Compile:
   ```
   docker run --rm -v "%cd%":/work cheesecrypt-cdt cdt-cpp -abigen -I include -contract cheesecrypt -o build/cheesecrypt.wasm src/cheesecrypt.cpp
   ```
   You may see warnings about "ricardian". Those are normal. Red "error" lines are not normal: stop and paste them to me.
7. Check the results:
   ```
   dir build
   ```
   You should see two files: `cheesecrypt.wasm` and `cheesecrypt.abi`.
8. Optional extra check (runs the fee and time rule tests):
   ```
   docker run --rm -v "%cd%":/work cheesecrypt-cdt bash tests/run.sh
   ```
   If this complains that it can't find a compiler (g++), skip it. I already ran these tests on my side and they passed.

## Part C: Before deploying

1. Make sure `crypt.cheese` has enough RAM. The new code is bigger, and the new `budget` table needs a small amount of extra RAM.
   - On waxblock.io, look up `crypt.cheese` and check RAM. Aim for at least 50 KB free beyond the current usage.
   - If it's short, buy RAM for `crypt.cheese` from any account (about 1 to 2 WAX is usually enough).
2. Have the wallet that controls `crypt.cheese@active` ready in Anchor.

## Part D: Deploy the update to crypt.cheese

Use the same method you used for the first deploy on 31 Oct. Two common ways:

- **Web tool (easiest):** Open a WAX contract deploy page that works with Anchor (for example the "Deploy Contract" tool on wax.bloks.io under Wallet). Log in as `crypt.cheese` with the **active** permission. Upload `build\cheesecrypt.wasm` and `build\cheesecrypt.abi`, then approve in Anchor.
- **cleos (command line):**
  `cleos -u https://wax.greymass.com set contract crypt.cheese build cheesecrypt.wasm cheesecrypt.abi`

You don't need to redo the `eosio.code` permission, because it's already set. Your existing settings and in-progress payments stay the same. Free messaging stays **off** until Part F.

Then check it worked: on waxblock.io, open `crypt.cheese` → **Contract → Actions**. You should now see `setbudget`, `takesponsor` and `sendfree`. Under **Tables** you should see `budget`.

## Part E: Tell the contract who funds it, then fund it

1. waxblock.io → `crypt.cheese` → **Contract → Actions → setbudget**. Log in as `crypt.cheese` (active).
   - `daily_limit`: `200.0000 CHEESE` (exactly 4 decimals, with a space before CHEESE)
   - `enabled`: `false`
   - `funder`: the account you'll pay from (for example `dr.cheese`)
   - Click Submit and approve in Anchor.
2. Log in as the **funder** account. Send CHEESE (token contract `cheeseburger`) to `crypt.cheese`:
   - Amount: as much as you want available (for example `1400.0000 CHEESE` covers about a week at the full limit)
   - Memo: exactly `CHEESECrypt sponsor deposit` (capitals and spaces must match)
   - If the account or memo is wrong, the transfer is rejected and nothing is lost.
3. Check: **Tables → budget** should show `sponsor_balance` equal to what you sent.

## Part F: Switch it on and test

1. Run `setbudget` again with the same values, but `enabled` = `true`.
2. Open CHEESEHub → Admin. The crypt.cheese card should show "Free Messaging: On", today's spend and the sponsor balance.
3. Open CHEESECrypt and send a text message to a friend:
   - The composer should show "Free message".
   - Anchor should ask you to approve a `crypt.cheese::sendfree` action with **no CHEESE transfer** in it.
   - The friend receives it, and old messages still load.
4. Send a voice note. It should still be a normal paid message.

## Everyday controls

- **Turn off:** `setbudget` with `enabled` = `false`. Messages fall back to paid automatically.
- **Top up:** repeat Part E step 2.
- **Take money back:** `takesponsor`, for example `100.0000 CHEESE`, signed by `crypt.cheese@active`. It goes back to the funder.
- **Change daily amount:** `setbudget` with a new `daily_limit`.

## If something goes wrong

- Docker says "cannot connect": Docker Desktop isn't running. Start it and wait for the green "Engine running".
- Compile errors, or deploy says "insufficient ram": paste the message to me (for RAM, buy more as in Part C).
- Deposit rejected: check the funder account in `setbudget` and the exact memo.

## Risks (flagged)

- There's no per-person limit. One spammer can use up the whole 200 for the day, and after that everyone pays normally. Your most you can lose is 200 CHEESE per day.
- You're paying to deliver encrypted content you can't see. Keep the Terms rule that users are responsible for what they send.
- Whether Anchor can approve messages without a pop-up (whitelisting) is still untested. You can only test it once this is live.
- The contract has not been audited. Testing on testnet first is safest.
