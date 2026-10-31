# Redeploy crypt.cheese with the new `payfee` action (Windows + Docker Desktop + waxblock.io)

Your folder: `C:\Users\User\Desktop\wax contracts\cheesecrypt`

## Step 0 - Put the latest contract files in your folder
Replace these files in your folder with the latest versions from this project (`contracts/cheesecrypt/`), keeping the same layout:

```text
cheesecrypt\
  Dockerfile
  build.sh
  include\cheesecrypt.hpp
  include\router_rules.hpp
  src\cheesecrypt.cpp
```
Delete the old `build` folder inside it if one exists, so old files can't be mixed up with new ones.

## Step 1 - Open Docker Desktop
Start Docker Desktop and wait until it says "Engine running" (bottom left).

## Step 2 - Open Command Prompt (CMD, not PowerShell)
Press Windows key, type `cmd`, press Enter. Copy and paste each line exactly, pressing Enter after each:

```text
cd /d "C:\Users\User\Desktop\wax contracts\cheesecrypt"
```
```text
docker build -t cheesecrypt-cdt .
```
(Note the space and full stop at the end. Takes a minute or two the first time; fast after.)

```text
docker run --rm -v "%cd%:/work" cheesecrypt-cdt bash -c "sed -i 's/\r$//' build.sh && bash build.sh"
```
Success looks like: `Built build/cheesecrypt.wasm and build/cheesecrypt.abi`.
Warnings are fine; the word `error` is not - if you see one, paste it to me and stop.

## Step 3 - Confirm the new files contain payfee
```text
dir build
```
```text
findstr /c:"payfee" build\cheesecrypt.abi
```
The second command must print at least one line. If it prints nothing, stop and tell me.

## Step 4 - Deploy on waxblock.io
1. Go to `https://waxblock.io/account/crypt.cheese` and log in with Anchor as **crypt.cheese** (active permission).
2. Open the **Contract** tab, then **Deploy** (or "Set contract").
3. WASM file: choose `C:\Users\User\Desktop\wax contracts\cheesecrypt\build\cheesecrypt.wasm`
4. ABI file: choose `C:\Users\User\Desktop\wax contracts\cheesecrypt\build\cheesecrypt.abi`
5. Click Deploy, approve in Anchor.
6. If it fails with "insufficient RAM", buy about 50 KB of RAM for `crypt.cheese` (CHEESERam or the waxblock RAM page) and retry. If it fails on CPU/NET, power up `crypt.cheese` with CHEESEUp and retry.

Do NOT change any permissions. The `crypt.cheese@eosio.code` entry you added earlier stays exactly as it is.

## Step 5 - Check it on-chain
On `https://waxblock.io/account/crypt.cheese` -> Contract -> Actions, you should now see:
`payfee`, `reclaim`, `sendmsg`, `setconfig`, `setpaused`.
Under Tables, `config` should still show your previous settings and `pending` should be empty. Existing messages, rooms and keys are unaffected.

## Step 6 - Tell me "redeployed"
Then I will (in build mode):
1. Read the live contract to confirm `payfee` exists with the expected fields.
2. Turn on the app switch so key creation, key publishing and room listing/update/unlist fees go through `crypt.cheese` (they stay on the old direct path until then, so nothing breaks in the meantime).
3. Run the tests, then you do one test key publish and one test room listing; I verify the 80/20 split and empty `pending` table from the transaction IDs.

## Technical details
- Image: Ubuntu 22.04 + Antelope CDT 4.1.0; build runs `cdt-cpp -abigen -I include -contract cheesecrypt`.
- The `sed` strips Windows line endings from `build.sh` so bash can run it.
- App switch: `CRYPT_PAYFEE_LIVE` in `src/lib/cheeseCrypt.ts` (currently `false`); flipped only after on-chain confirmation.
