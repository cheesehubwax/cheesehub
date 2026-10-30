# Compile and deploy the CHEESECrypt contract with Docker Desktop (first-timer guide)

This is a guide only. No app code changes. Once you approve, I give you the finished guide with every command filled in for your PC (Windows or Mac).

## Before you start: important warnings
- **You need 4 files, not 2:** `include/cheesecrypt.hpp`, `include/router_rules.hpp`, `src/cheesecrypt.cpp`, and `build.sh`. The contract won't compile without `router_rules.hpp`.
- **Test on testnet first.** The contract hasn't been audited. The app isn't wired to it yet, so deploying to mainnet early gains you nothing.
- **Protect the keys.** Whoever controls `crypt.cheese` can change its fees and rules. Use a dedicated key, never paste it into websites, and delete the temporary wallet afterwards.

## Step 1: Set up the folder
```text
C:\cheesecrypt\            (Mac: ~/cheesecrypt/)
  build.sh
  include\cheesecrypt.hpp
  include\router_rules.hpp
  src\cheesecrypt.cpp
```
Keep the folder names `include` and `src` exactly; the code looks for them.

## Step 2: Install and start Docker Desktop
- Download it from docker.com, install, then open it and wait until it says "Engine running".
- Open a terminal (Windows: PowerShell; Mac: Terminal) and run `docker --version` to check it works.

## Step 3: Build a reusable compiler image (one time only)
Create a file called `Dockerfile` (no extension) in the folder:
```text
FROM --platform=linux/amd64 ubuntu:22.04
RUN apt-get update && apt-get install -y wget ca-certificates && \
    wget https://github.com/AntelopeIO/cdt/releases/download/v4.1.0/cdt_4.1.0-1_amd64.deb && \
    apt-get install -y ./cdt_4.1.0-1_amd64.deb && rm cdt_4.1.0-1_amd64.deb
WORKDIR /work
```
Then run, from inside the folder:
```text
cd C:\cheesecrypt
docker build -t cheese-cdt .
```

## Step 4: Compile
Windows PowerShell:
```text
docker run --rm -v ${PWD}:/work cheese-cdt bash build.sh
```
Mac:
```text
docker run --rm -v "$(pwd)":/work cheese-cdt bash build.sh
```
Success prints "Built build/cheesecrypt.wasm and build/cheesecrypt.abi". A new `build` folder holds both files.
- On Windows, if you see `$'\r': command not found`, the file has Windows line endings. Run `docker run --rm -v ${PWD}:/work cheese-cdt cdt-cpp -abigen -I include -contract cheesecrypt -o build/cheesecrypt.wasm src/cheesecrypt.cpp` instead.

## Step 5: Check the RAM you need
- Look at the size of `cheesecrypt.wasm`. Deploying uses roughly 10 times the file size in RAM.
- Buy at least that much on `crypt.cheese`, plus about 50 KB extra for the contract's working data.

## Step 6: Deploy with cleos inside Docker
1. Build a second image with WAX's command-line tool (cleos), Leap 5.x. The finished guide will include this Dockerfile.
2. Start it with your folder attached, create a temporary wallet, and import the `crypt.cheese` active key.
3. Upload the contract:
   `cleos -u https://wax.greymass.com set contract crypt.cheese /work/build cheesecrypt.wasm cheesecrypt.abi`
4. Give the contract permission to send CHEESE itself (needed for the 80/20 split and change refunds):
   `cleos -u https://wax.greymass.com set account permission crypt.cheese active --add-code`
5. Lock the wallet, exit the container (`--rm` deletes the container), and delete the wallet files.

For testnet, use `https://testnet.waxsweden.org` and a testnet account instead.

## Step 7: Check it worked
- Open waxblock.io and search `crypt.cheese`. The Contract tab should show the actions `sendmsg`, `reclaim`, `setconfig` and `setpaused`, and the tables `config` and `pending`.
- No `setconfig` call is needed. The built-in defaults already use `cheeseburger`, CHEESE, the 80% `eosio.null` / 20% `xcheeseliqst` split and the current fees.
- Tell me when it's deployed. Wiring the app to the contract comes after testnet checks (see the integration steps in the sync checklist).

## Technical notes
- CDT 4.1.0 from the AntelopeIO GitHub releases, run in an amd64 Ubuntu 22.04 image. On Apple Silicon Macs, Docker runs it in emulation; it's slower but works.
- The contract uses `get_self()`, so the account name isn't built into the compiled files.
- `--add-code` adds `crypt.cheese@eosio.code` to the active permission. Without it, the contract can't make its own transfers, so every send fails.
