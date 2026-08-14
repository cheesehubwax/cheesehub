# Building and deploying `ram.cheese` — a first-timer's guide

Everything below assumes you have never compiled a smart contract before. The project folder is called `ram.cheese`, and the compiled contract gets deployed to the WAX account `ram.cheese`.

One naming note up front: a *folder* on your computer can contain a dot, and so can a WAX account name — so both are `ram.cheese`. But a C++ class name cannot contain a dot, so the code files inside the folder are named `ramcheese.cpp` / `ramcheese.hpp` and the build target is `ramcheese`. That mismatch is normal and changes nothing about deployment: the account you deploy *to* is chosen at deploy time, not at compile time.

## Step 1 — Install Docker Desktop
Docker runs the WAX compiler inside a small pre-built Linux environment, so you never install a compiler by hand.

1. Go to docker.com/products/docker-desktop and download the version for your operating system.
2. Install it and start it. On Windows it may ask to enable WSL2 — accept.
3. Confirm it works: open a terminal (PowerShell on Windows, Terminal on macOS/Linux) and run `docker --version`. A version number means you are done.

## Step 2 — Install VS Code
1. Download from code.visualstudio.com and install.
2. Open the Extensions panel (the four-squares icon) and install:
   - **C/C++** by Microsoft — syntax highlighting and error squiggles
   - **CMake Tools** by Microsoft — understands the build file
   - **Dev Containers** by Microsoft — optional, used in Step 7

## Step 3 — Create your project folder
1. Make a folder somewhere easy, for example `Documents/wax-contracts/ram.cheese`.
2. In VS Code: File -> Open Folder -> pick that folder.
3. Inside it, create this structure (right-click in the VS Code file panel -> New File / New Folder):

```text
ram.cheese/
├── src/
│   └── ramcheese.cpp        <- the contract logic
├── include/
│   └── ramcheese.hpp        <- the contract's declarations (tables, actions)
└── CMakeLists.txt           <- the build instructions
```

Why the split: the `.hpp` header declares what exists (the contract class, its tables, its action names), and the `.cpp` contains the actual code for each action. The compiler reads the header first, then the source.

## Step 4 — Understanding `CMakeLists.txt` line by line
This is the file that confused you, so here is every line explained. CMake is not the compiler. CMake is a *recipe reader*: it reads `CMakeLists.txt`, works out which files to compile and in what order, and then writes the low-level build commands that `make` actually runs. You write the short recipe; CMake writes the long boring part.

Here is the complete file for this project:

```cmake
cmake_minimum_required(VERSION 3.16)
project(ramcheese)
find_package(cdt)
add_contract(ramcheese ramcheese src/ramcheese.cpp)
target_include_directories(ramcheese PRIVATE ${CMAKE_SOURCE_DIR}/include)
```

Line by line:

**`cmake_minimum_required(VERSION 3.16)`**
"Refuse to continue if the CMake in this environment is older than 3.16." Older versions do not understand some of the syntax below. It is a safety check, nothing more. The CDT Docker image ships a newer CMake, so this always passes.

**`project(ramcheese)`**
Gives the whole build a name. It mostly affects labels in build output and some default variables. Cosmetic — but required, because CMake expects every recipe to declare a project.

**`find_package(cdt)`**
The important one. CDT is the WAX/Antelope Contract Development Toolkit — the actual compiler (`cdt-cpp`) plus WAX's smart-contract libraries. This line says "go find CDT on this machine and load its extra CMake commands." Loading it is what makes the next line, `add_contract`, exist at all — `add_contract` is not built into CMake, it comes from CDT. This is also why the build must run inside the Docker image: outside it, CDT is not installed and this line fails with "Could not find a package configuration file provided by cdt".

**`add_contract(ramcheese ramcheese src/ramcheese.cpp)`**
This is the build order. It takes three kinds of argument, and the first two being identical is what looks confusing:

1. First `ramcheese` — the **contract name**. This is baked into the generated `.abi` file.
2. Second `ramcheese` — the **CMake target name**, an internal label for this build job. You reuse this label in later lines (as in the `target_include_directories` line below) to refer back to "the thing I am building".
3. `src/ramcheese.cpp` — the **source file(s)**. You can list more than one, space-separated, if you later split the code across several `.cpp` files.

The output filenames come from the target name, so this line is what produces `ramcheese.wasm` and `ramcheese.abi`.

**`target_include_directories(ramcheese PRIVATE ${CMAKE_SOURCE_DIR}/include)`**
Tells the compiler where to look for header files. Without it, `#include "ramcheese.hpp"` inside your `.cpp` may not be found, because the header lives in `include/` while the source lives in `src/`.
- `ramcheese` — which build target this applies to (the target name from the line above).
- `PRIVATE` — this include path is only for building this contract, not for anything that might depend on it. For a standalone contract, `PRIVATE` is always the right choice.
- `${CMAKE_SOURCE_DIR}` — a CMake variable meaning "the folder containing this `CMakeLists.txt`". Using it instead of a hard-coded path keeps the file working on any machine.

Mental summary: *require a modern CMake, name the project, load the WAX toolchain, build these sources into a contract called ramcheese, and look in `include/` for headers.* That is the whole file.

## Step 5 — Get the WAX compiler (CDT) through Docker
You pull the compiler image once.

```bash
docker pull antelopeio/cdt:latest
```

If that image name is unavailable, try these in order until one succeeds:

```bash
docker pull ghcr.io/antelopeio/cdt:latest
docker pull eostudio/eosio.cdt:latest
docker pull waxteam/dev:latest
```

Write down which image name worked — you use it in the next step. Success looks like `Status: Downloaded newer image for ...`, and the image appears in `docker images`.

## Step 6 — Compile the contract
Run this from inside your project folder, replacing `IMAGE_NAME` with the image that pulled successfully.

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

What each part does:
- `--rm` — delete the container afterwards, so nothing accumulates on your machine.
- `-v "$(pwd)":/project` — share your current folder with the container as `/project`, so it can read your code and write results back to your real folder.
- `-w /project` — start inside that shared folder.
- `mkdir -p build && cd build` — keep generated files in a `build/` folder instead of mixing them with your source.
- `cmake ..` — read `CMakeLists.txt` in the parent folder and generate the real build commands.
- `make` — actually run the compiler.

Success looks like a new `build/` folder containing:
- `ramcheese.wasm` — the compiled contract
- `ramcheese.abi` — the interface description that wallets and explorers read

Both files are required for deployment. If the build fails, the error names a file and line number — that is a code problem, not a Docker problem. If instead it says it cannot find package `cdt`, you are running outside the CDT image.

## Step 7 (optional) — Make VS Code build inside Docker automatically
So you stop typing the long docker command. Create `.devcontainer/devcontainer.json`:

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

Press F1 in VS Code and choose "Dev Containers: Reopen in Container". VS Code now runs inside the WAX toolchain, so its built-in terminal already has `cdt-cpp` and `cmake`, and you can just run `mkdir -p build && cd build && cmake .. && make`.

## Step 8 — Test on WAX testnet first
Deploying a broken contract to mainnet costs real WAX and can lock funds.

1. Create a free testnet account through a WAX testnet faucet such as https://waxsweden.org/testnet/
2. Deploy there first using Step 9 or 10, but point at a testnet endpoint such as `https://testnet.waxsweden.org`.
3. Call the actions and check the tables look correct before touching mainnet. For `ram.cheese` specifically, test a CHEESE-in buy and a RAM-in sell with a mock token before mainnet.

## Step 9 — Deploy option A: the WAX block explorer (easiest, no keys typed)
This is the route described in the statement you quoted.

1. Go to https://wax.bloks.io (or https://waxblock.io), open the `ram.cheese` account, then the contract deploy tool.
2. Connect your wallet (Anchor, Wombat, or WAX Cloud Wallet) and log in as `ram.cheese`.
3. Upload `build/ramcheese.wasm` and `build/ramcheese.abi`.
4. Review the transaction — it contains two actions, `eosio::setcode` and `eosio::setabi`.
5. Sign it in your wallet.
6. Copy the transaction ID and confirm it at `https://waxblock.io/transaction/<txid>`.

If it fails with a RAM error, buy more RAM on `ram.cheese` and retry.

## Step 10 — Deploy option B: command line with cleos
Better for repeat deployments.

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
   `cleos wallet import` prompts for the private key so it never lands in your shell history. Save the wallet password it prints.
4. Deploy:
   ```bash
   cleos -u https://wax.greymass.com set contract ram.cheese ./build ramcheese.wasm ramcheese.abi
   ```
5. Verify:
   ```bash
   cleos -u https://wax.greymass.com get code ram.cheese
   ```
   The returned code hash should be non-zero.

Alternative WAX endpoints if one is rate-limited: `https://wax.eosphere.io`, `https://api.wax.alohaeos.com`, `https://wax.pink.gg`.

## Step 11 — After deploying `ram.cheese`
1. Add `eosio.code` to the account's `active` permission, so the contract can sign its own inline actions (`buyram`, `sellram`, CHEESE transfers). Without this every action fails with a missing-authority error.
2. Call `setconfig` once with the CHEESE/WAX Alcor pool id, min/max CHEESE, the reference rate, the max deviation percent, and the liquid WAX reserve floor.
3. Call `setsellcfg` once with the sell toggle, min/max sell bytes, and the CHEESE pool floor.
4. Fund it: send WAX for the buy reserve, and CHEESE with memo `deposit` for the sell payout pool.

## Step 12 — Safety practices
- Create a dedicated permission (for example `deployer`) with parent `active`, linked only to `eosio::setcode` and `eosio::setabi`, and deploy with that instead of your full `active` key.
- Keep private keys out of git. Add any wallet password or `.key` files to `.gitignore`.
- Once the contract manages real value, move control to a multisig so nobody can silently replace the code.

## Quick reference
| What | Where to get it | Why |
| --- | --- | --- |
| Docker Desktop | docker.com/products/docker-desktop | Runs the WAX compiler without manual install |
| VS Code | code.visualstudio.com | Writing the C++ contract |
| CDT Docker image | `docker pull` in Step 5 | Compiles `.cpp` into `.wasm` and `.abi` |
| Leap Docker image | `docker pull antelopeio/leap` | `cleos` for command-line deployment |
| `ram.cheese` account with RAM | Any WAX wallet or Anchor | Holds and pays for the contract |
| Testnet account | A WAX testnet faucet | Safe place to test first |
| bloks.io / waxblock.io | Browser | Upload without the CLI, and verify transactions |

## Adding this to CHEESEHub later
Optional and not part of this task: a `contracts/ramcheese/` folder with the C++ source and `CMakeLists.txt`, a `contracts/build.sh` wrapper around the Docker command, and a GitHub Actions workflow that compiles on every push so the `.wasm` and `.abi` are always reproducible.
