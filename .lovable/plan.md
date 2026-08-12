# Compile and Deploy WAX (EOSIO) C++ Smart Contracts

## Goal
Provide a complete, reproducible local workflow for compiling and deploying WAX/EOSIO C++ smart contracts using Docker and VS Code, plus a manual deployment fallback using an existing WAX account and wallet.

## What you need

### 1. A WAX account with sufficient resources
- WAX account name (12 chars, a-z/1-5).
- `owner` and `active` keys. You will need the **private key** for the permission you deploy with.
- Staked CPU/NET and RAM to publish the contract. Deploying consumes RAM (roughly 100–300 KB depending on contract size).
- Optionally, a dedicated permission limited to `eosio::setcode` and `eosio::setabi` for safer deployments.

### 2. Docker (the easiest way to get the EOSIO/WAX toolchain)
The phrase “ultra docker” usually refers to running the official **Antelope/WAX toolchain** in a container so you don’t have to compile cdt/leap locally. Good options:

- **Antelope CDT** (for compiling C++ contracts): `ghcr.io/antelopeio/cdt`
- **Leap** (for `cleos` / `keosd` / `nodeos`): `ghcr.io/antelopeio/leap`
- **WAX-specific images** (community maintained): `ghcr.io/waxio/wax-dev` or `waxteam/cdt`

Recommended minimal setup:

```bash
# Pull a CDT + Leap image (pick one that includes both tools)
docker pull ghcr.io/antelopeio/cdt:latest
docker pull ghcr.io/antelopeio/leap:latest
```

Create a local folder layout:

```text
my-contract/
├── src/
│   ├── mycontract.cpp
│   └── mycontract.hpp
├── include/
├── build/
└── CMakeLists.txt
```

Compile inside the CDT container:

```bash
docker run --rm -v $(pwd):/project -w /project \
  ghcr.io/antelopeio/cdt:latest \
  bash -c "mkdir -p build && cd build && cmake .. && make"
```

This produces two artifacts you must deploy:
- `mycontract.wasm` (the compiled WebAssembly)
- `mycontract.abi` (the JSON Application Binary Interface)

### 3. VS Code setup (optional but recommended)
- Install the **CMake Tools** extension.
- Install a C++ extension for syntax highlighting (`ms-vscode.cpptools`).
- If you want the exact “Docker + VS Code” experience, add a `.devcontainer/devcontainer.json` that points to the CDT image so VS Code opens the project inside the container.

Example `.devcontainer/devcontainer.json`:

```json
{
  "name": "WAX Contract Dev",
  "image": "ghcr.io/antelopeio/cdt:latest",
  "mounts": ["source=${localWorkspaceFolder},target=/workspace,type=bind"],
  "workspaceFolder": "/workspace",
  "extensions": ["ms-vscode.cpptools", "ms-vscode.cmake-tools"]
}
```

### 4. Deploy to WAX mainnet (or testnet)

Use `cleos` from the Leap container. You need your WAX private key imported into a wallet inside the container, or you can use a signer like Anchor.

```bash
# Start an interactive Leap container with your project mounted
docker run --rm -it -v $(pwd):/project -w /project ghcr.io/antelopeio/leap:latest bash

# Inside the container:
# 1. Create/import a wallet
keosd &
cleos wallet create --file /project/wallet-password.txt
cleos wallet import --private-key YOUR_PRIVATE_KEY

# 2. Deploy the contract
cleos -u https://wax.greymass.com set contract YOUR_ACCOUNT build/ mycontract.wasm mycontract.abi
```

Replace `YOUR_ACCOUNT` and `YOUR_PRIVATE_KEY` with real values. Use a WAX API endpoint you trust (e.g. `https://wax.greymass.com`, `https://wax.eosphere.io`, `https://wax.api.atomicassets.io` is for Atomic, not chain RPC).

### 5. Alternative: deploy via Wax Block Explorer
If you already compiled the `.wasm` and `.abi` files, you can use a WAX block explorer that supports contract upload:
- Go to the explorer’s contract upload page.
- Log in with Anchor / Wombat / Cloud Wallet.
- Select the account and upload `mycontract.wasm` and `mycontract.abi`.
- Submit the transaction.

This avoids needing `cleos` locally but still requires the account to have enough RAM/CPU/NET.

## Recommended workflow

1. Write the contract in VS Code (inside the dev container or with local tooling).
2. Compile with the CDT Docker image to get `.wasm` and `.abi`.
3. Test on the WAX testnet first (endpoints like `https://testnet.wax.pink.gg` or `https://wax-testnet.eosphere.io`).
4. Deploy to mainnet via `cleos` or a block explorer.
5. Verify the contract by reading its tables/actions from the chain.

## If you want to add this to CHEESEHub later

If you decide to bring a contract into the CHEESEHub repo, we can add:
- A `contracts/` folder with the C++ source and `CMakeLists.txt`.
- A Docker-based build script (`contracts/build.sh`).
- A GitHub Actions workflow that compiles the contract on every push.
- A deployment script (manual or with a stored private key in GitHub Secrets) for mainnet or testnet.

That is out of scope for this plan because the user said this is a separate project.
