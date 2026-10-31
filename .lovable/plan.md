# Launch the CHEESECrypt contract on crypt.cheese (Docker Desktop + waxblock.io)

## Permission check (from your screenshot): correct
- owner: your key (weight 1, threshold 1)
- active: `crypt.cheese@eosio.code` + your active key (threshold 1)

That's exactly right. Nothing more to change. Keep both keys safe, because whoever holds them can change the contract.

---

## Part A: Prepare the folder (one time)

1. Open `C:\Users\User\Desktop\wax contracts\cheesecrypt`.
2. It must look like this (names must match exactly):
```text
cheesecrypt\
  Dockerfile          <- no extension
  build.sh
  include\cheesecrypt.hpp
  include\router_rules.hpp
  src\cheesecrypt.cpp
```
3. Download the latest `cheesecrypt.hpp`, `router_rules.hpp`, `cheesecrypt.cpp` and `build.sh` from the project. These include the flattened fees. Replace any older copies.
4. Create `Dockerfile`: open Notepad, paste the text below, then **File > Save As**. Set "Save as type" to **All Files** and the name to `Dockerfile`, and save it in the cheesecrypt folder.
```text
FROM ubuntu:22.04
RUN apt-get update && apt-get install -y wget ca-certificates && \
    wget https://github.com/AntelopeIO/cdt/releases/download/v4.1.0/cdt_4.1.0-1_amd64.deb && \
    apt-get install -y ./cdt_4.1.0-1_amd64.deb && rm cdt_4.1.0-1_amd64.deb
WORKDIR /work
```
5. `build.sh` must use Unix line endings. Open it in Notepad and choose **Edit > EOL Conversion**, or in newer Notepad check that the bottom bar says "Unix (LF)". If it says "Windows (CRLF)", the build step fails with `$'\r'` errors. The fix is in step B4.

## Part B: Compile (Command Prompt, not PowerShell)

1. Start **Docker Desktop** and wait for "Engine running".
2. Press Start, type `cmd`, open **Command Prompt**.
3. Copy and paste these one at a time, pressing Enter after each:
```text
cd /d "C:\Users\User\Desktop\wax contracts\cheesecrypt"
dir
docker build --platform linux/amd64 -t cheese-cdt .
```
   This takes 1 to 3 minutes the first time. It should end with "naming to docker.io/library/cheese-cdt".
4. Compile:
```text
docker run --rm --platform linux/amd64 -v "%cd%":/work cheese-cdt bash -c "sed -i 's/\r$//' build.sh && bash build.sh"
```
   Success message: `Built build/cheesecrypt.wasm and build/cheesecrypt.abi`.
5. Check: `dir build` should list `cheesecrypt.wasm` and `cheesecrypt.abi`. Warnings are OK. Errors are not; paste them to me.

## Part C: Resources on crypt.cheese (waxblock.io)
1. Wallet > **Buy / Sell RAM**: buy for `crypt.cheese` about **400 KB** (deploying takes roughly 3 to 5x the size of the .wasm file, plus a buffer for new CHEESE recipients).
2. Wallet > **PowerUp** or **Manage CPU / NET**: give it some CPU/NET, e.g. 5 WAX CPU / 1 WAX NET.

## Part D: Deploy (waxblock.io, signed with crypt.cheese in Anchor)
1. Make sure the top-right account selector shows **crypt.cheese**.
2. Go to **Wallet > More > Utilities** (or Wallet > "Deploy contract"; waxblock calls it **Smart Contract / Deploy Contract**).
3. Select `build\cheesecrypt.wasm` for the WASM file and `build\cheesecrypt.abi` for the ABI file.
4. Click **Deploy**, then approve in Anchor. If it says "insufficient ram", buy more RAM (Part C) and retry.
5. Do NOT touch Permissions again. `eosio.code` is already done.

## Part E: Verify
1. Go to waxblock.io/account/crypt.cheese, **Contract** tab. You should see actions `setconfig`, `setpaused`, `sendmsg`, `reclaim` and tables `config`, `pending`.
2. No `setconfig` needed. The contract uses built-in defaults: 0.0100 CHEESE per part, 0.0001 per copy, an 80/20 split to `eosio.null` / `xcheeseliqst`, and `cheeseburger` / CHEESE.
3. Optional live test (I'll prepare the exact two-action transaction): transfer 0.0201 CHEESE to crypt.cheese, then `sendmsg` to one test account. Check on waxblock that 0.0080 goes to eosio.null, 0.0020 to xcheeseliqst, 0.0001 to the recipient, and 0.0100 change comes back.

## After launch (app side, separate later task)
The app keeps using direct payments (`ROUTER_CONTRACT_DEPLOYED = false`) until the history reader is updated. Delivered copies show `from: crypt.cheese`, so the reader must find the real sender. Switching on is a separate build task, done only after the step E3 test passes.

## Risk notes
- Zero custody holds as long as every payment and `sendmsg` happen in the same transaction. `reclaim` covers payments left behind when that doesn't happen.
- Single-key control: consider moving owner to a Ledger or a multisig later.
