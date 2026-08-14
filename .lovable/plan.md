# Compile and Deploy WAX (EOSIO) C++ Smart Contracts — Beginner Guide

## Goal
A step-by-step, first-timer-friendly workflow for writing, compiling, and deploying a WAX smart contract using Docker and VS Code, then uploading it with the WAX block explorer (the same route described in the statement you quoted).

## Step 1 — Get a WAX account ready
- A WAX account name (1-12 characters, only `a-z`, `1-5`, and periods).
- The private key for the `active` permission of that account, or a wallet like Anchor connected to it.
- Resources on that account: staked CPU and NET, plus RAM. A contract upload typically needs 100-300 KB of RAM, so buy roughly 400 KB to be safe.
- Never paste your private key into a website. Only into your own local wallet or Anchor.

## Step 2 — Install Docker Desktop
Docker runs a pre-made Linux environment on your computer. It means you don't have to install the WAX compiler by hand, which is the hard part.

1. Go to https://www.docker.com/products/docker-desktop/
2. Download the installer for your operating system (Windows, macOS Intel, macOS Apple Silicon, or Linux).
3. Run the installer and accept the defaults.
   - On Windows it will ask to enable WSL 2. Say yes. If it asks you to restart, restart.
4. Open Docker Desktop after installing. Wait until the whale icon in your taskbar or menu bar stops animating and the app says "Engine running".
5. Verify it works. Open a terminal:
   - Windows: press Start, type `PowerShell`, hit Enter.
   - macOS: press Cmd+Space, type `Terminal`, hit Enter.
   - Then run:
     ```bash
     docker --version
     ```
   - You should see something like `Docker version 27.x.x`. If you get "command not found", Docker Desktop isn't running or isn't installed — go back to step 4.

## Step 3 — Install VS Code
VS Code is the text editor you'll write the contract in.

1. Go to https://code.visualstudio.com/ and download it.
2. Install with defaults.
3. Open VS Code, click the Extensions icon in the left sidebar (four small squares), and install these three:
   - `C/C++` (publisher: Microsoft)
   - `CMake Tools` (publisher: Microsoft)
   - `Dev Containers` (publisher: Microsoft)

## Step 4 — Create your project folder
1. Make a new folder somewhere easy, for example `Documents/wax-contracts/mycontract`.
2. In VS Code: File -> Open Folder -> pick that folder.
3. Inside it, create this structure (right-click in the VS Code file panel -> New File / New Folder):

```text
mycontract/
├── src/
│   └── mycontract.cpp
├── include/
│   └── mycontract.hpp
└── CMakeLists.txt
```

`CMakeLists.txt` tells the compiler what to build. A minimal version:

```cmake
cmake_minimum_required(VERSION 3.16)
project(mycontract)
find_package(cdt)
add_contract(mycontract mycontract src/mycontract.cpp)
target_include_directories(mycontract PRIVATE ${CMAKE_SOURCE_DIR}/include)
```

## Step 5 — Get the WAX compiler (CDT) through Docker
CDT stands for Contract Development Toolkit. It is the actual WAX/Antelope C++ compiler. You pull it once as a Docker image.

In your terminal, run:

```bash
docker pull antelopeio/cdt:latest
```

If that image name is unavailable, try these common alternatives in order until one pulls successfully:

```bash
docker pull ghcr.io/antelopeio/cdt:latest
docker pull eostudio/eosio.cdt:latest
docker pull waxteam/dev:latest
```

Note which image name worked; you use it in the next step.

How to know it worked: the command finishes with `Status: Downloaded newer image for ...`, and `docker images` lists it.

## Step 6 — Compile the contract
From inside your project folder, run this, replacing `IMAGE_NAME` with whichever image pulled successfully.

macOS / Linux:
```bash
docker run --rm -v "$(pwd)":/project -w /project IMAGE_NAME \
  bash -c "mkdir -p build && cd build && cmake .. && make"
```

Windows PowerShell:
```powershell
docker run --rm -v "${PWD}:/project" -w /project IMAGE_NAME `
  bash -c "mkdir -p build && cd build && cmake .. && make"
```

What the flags mean:
- `--rm` deletes the container when it finishes, keeping things clean.
- `-v "$(pwd)":/project` shares your current folder with the container so it can read your code and write the output back to your machine.
- `-w /project` starts inside that shared folder.

Success looks like a new `build/` folder containing:
- `mycontract.wasm` — the compiled contract
- `mycontract.abi` — the interface description

Both files are required for deployment. If the build fails, the compiler error names the file and line, which is a code problem rather than a Docker problem.

## Step 7 (optional) — Make VS Code build inside Docker automatically
Instead of typing the docker command each time, add a dev container. Create `.devcontainer/devcontainer.json` in your project:

```json
{
  "name": "WAX Contract Dev",
  "image": "IMAGE_NAME",
  "customizations": {
    "vscode": {
      "extensions": ["ms-vscode.cpptools", "ms-vscode.cmake-tools"]
    }
  }
}
```

Then in VS Code press F1 and choose "Dev Containers: Reopen in Container". VS Code now runs inside the WAX toolchain, so its terminal already has `cdt-cpp` and `cmake` available and you can simply run `mkdir -p build && cd build && cmake .. && make`.

## Step 8 — Test on WAX testnet first
Deploying a broken contract to mainnet costs real WAX and can lock funds.

1. Create a free testnet account through a WAX testnet faucet such as https://waxsweden.org/testnet/
2. Deploy there first using the steps below, but point at a testnet endpoint such as `https://testnet.waxsweden.org`.
3. Call your contract's actions and confirm the tables look correct before touching mainnet.

## Step 9 — Deploy option A: the WAX block explorer (easiest, no keys typed)
This is the route described in the statement you quoted.

1. Go to https://wax.bloks.io (or https://waxblock.io) and open your account, then the contract deploy tool.
2. Connect your wallet (Anchor, Wombat, or WAX Cloud Wallet) and log in as the account that will hold the contract.
3. Upload `build/mycontract.wasm` and `build/mycontract.abi`.
4. Review the transaction. It contains two actions: `eosio::setcode` and `eosio::setabi`.
5. Sign it in your wallet.
6. Copy the transaction ID and confirm it at `https://waxblock.io/transaction/<txid>`.

If it fails with a RAM error, buy more RAM on the account and retry.

## Step 10 — Deploy option B: command line with cleos
Useful for repeat deployments and scripting.

1. Pull the Leap image, which contains `cleos` and `keosd`:
   ```bash
   docker pull antelopeio/leap:latest
   ```
2. Start it with your project mounted:
   ```bash
   docker run --rm -it -v "$(pwd)":/project -w /project antelopeio/leap:latest bash
   ```
3. Inside the container, create a wallet and import your key:
   ```bash
   keosd &
   cleos wallet create --to-console
   cleos wallet import
   ```
   `cleos wallet import` prompts for the private key so it never lands in your shell history. Save the wallet password it prints; you need it to unlock later.
4. Deploy:
   ```bash
   cleos -u https://wax.greymass.com set contract YOUR_ACCOUNT ./build mycontract.wasm mycontract.abi
   ```
5. Verify:
   ```bash
   cleos -u https://wax.greymass.com get code YOUR_ACCOUNT
   ```
   The returned code hash should be non-zero.

Alternative WAX endpoints if one is rate-limited: `https://wax.eosphere.io`, `https://api.wax.alohaeos.com`, `https://wax.pink.gg`.

## Step 11 — Safety practices
- Create a dedicated permission (for example `deployer`) with parent `active`, linked only to `eosio::setcode` and `eosio::setabi`, and deploy with that instead of your full `active` key.
- Keep private keys out of git. Add any wallet password or `.key` files to `.gitignore`.
- Once a contract manages real value, move control to a multisig so nobody can silently replace the code.

## Quick reference of everything you need
| What | Where to get it | Why |
| --- | --- | --- |
| Docker Desktop | docker.com/products/docker-desktop | Runs the WAX compiler without manual install |
| VS Code | code.visualstudio.com | Writing the C++ contract |
| CDT Docker image | `docker pull` in Step 5 | Compiles `.cpp` into `.wasm` and `.abi` |
| Leap Docker image | `docker pull antelopeio/leap` | `cleos` for command-line deployment |
| WAX account with RAM | Any WAX wallet or Anchor | Holds and pays for the contract |
| Testnet account | A WAX testnet faucet | Safe place to test first |
| bloks.io / waxblock.io | Browser | Upload the contract without the CLI, and verify transactions |

## Adding this to CHEESEHub later
Not part of this task, but if the contract should ever live in the CHEESEHub repo, the pieces would be a `contracts/` folder with the C++ source and `CMakeLists.txt`, a `contracts/build.sh` wrapper around the Docker command, and a GitHub Actions workflow that compiles it on every push so the `.wasm` and `.abi` artifacts are always reproducible.
