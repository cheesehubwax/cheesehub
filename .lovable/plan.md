# Building and deploying `ram.cheese` — do this, in this order

You have never done this before, so every step below tells you exactly what to click, what to type, and how to know it worked. Do them in order. Do not skip Step 8.

The folder on your computer is called `ram.cheese`. The WAX account you deploy to is also called `ram.cheese`. The code files inside are called `ramcheese.cpp` and `ramcheese.hpp` — no dot — because a C++ class name is not allowed to contain a dot. That is the only place the names differ, and it changes nothing about deployment.

## Step 1 — Install Docker Desktop
Do this: go to docker.com/products/docker-desktop, download the version for your operating system, install it, then launch it. On Windows, if it asks to enable WSL2, click yes.

Then open a terminal — PowerShell on Windows (press Start, type `powershell`, Enter), Terminal on macOS (press Cmd+Space, type `terminal`, Enter) — and type:

```bash
docker --version
```

You should see a version number. If you see "command not found", Docker Desktop is not installed or not running. Open Docker Desktop and wait until its whale icon stops animating, then try again.

### If you get `failed to connect to the docker API at npipe:////./pipe/docker_engine`
That exact error (Windows) means Docker is installed but **the engine is not running**. `docker` the command exists, but there is no daemon behind it. Nothing is broken. Do this, in order, and stop as soon as `docker run hello-world` works:

1. Press Start, type `Docker Desktop`, press Enter. Leave it open. Watch the whale icon in the system tray (bottom-right, you may need to click the `^` arrow): while it is animating, the engine is still booting. Wait until the Docker Desktop window says **Engine running** in the bottom-left corner. First launch after installing can take 2-3 minutes.
2. Back in PowerShell, test with the smallest possible command:
   ```powershell
   docker run hello-world
   ```
   If you get "Hello from Docker!", the engine is up — go back and retry `docker pull antelopeio/cdt:latest`.
3. If Docker Desktop shows an error instead of "Engine running", it almost always names WSL2. Open PowerShell **as Administrator** (right-click Start -> Terminal (Admin)) and run:
   ```powershell
   wsl --install
   wsl --update
   ```
   Then reboot Windows and reopen Docker Desktop.
4. If Docker Desktop refuses to start at all, right-click the Start button -> Terminal (Admin) and run:
   ```powershell
   Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux -NoRestart
   Enable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform -NoRestart
   ```
   Reboot, then open Docker Desktop again. On some machines virtualisation is switched off in the BIOS/UEFI — if Docker complains about that specifically, enable "Intel VT-x" / "AMD-V" (sometimes labelled SVM) in your BIOS setup screen.
5. If you closed Docker Desktop earlier and want it to start with Windows: in Docker Desktop go to Settings -> General -> tick "Start Docker Desktop when you sign in".

Rule of thumb for the rest of this guide: **Docker Desktop must be open and showing "Engine running" before any `docker` command will work.** Every `docker pull` and `docker run` step below assumes it is.

### If Docker says "virtualization support not detected" even though BIOS says it is enabled
Your machine is capable — an i5-4570 (Haswell) has VT-x with EPT, which is everything Docker needs, and 16 GB RAM is plenty. So this is a Windows-side problem, not hardware. BIOS is only half the job; Windows also has to hand virtualization to the hypervisor, and right now something is blocking that.

Work through these in order. After each one, reopen Docker Desktop and check for "Engine running". Stop as soon as it appears.

**1. See what Windows actually thinks.** Press Ctrl+Shift+Esc -> Performance tab -> click CPU. Bottom right, look for `Virtualization:`.
- Says **Enabled** -> BIOS is fine; a Windows feature or a rival hypervisor is the problem. Go to 2.
- Says **Disabled** -> Windows is not seeing VT-x. Reboot into BIOS/UEFI (Del, F2 or F12 at the boot logo), Advanced -> CPU Configuration -> set "Intel Virtualization Technology" to Enabled, and enable "VT-d" if listed. Save and exit, then **fully shut down** — hold Shift while clicking Shut Down — because Windows fast startup can restore the old CPU state on a normal restart.
- The line is **missing entirely** -> a hypervisor already owns the feature. Go to 5.

**2. Turn on the Windows features Docker needs.** Right-click Start -> Terminal (Admin), then run all three:
```powershell
Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux -NoRestart
Enable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform -NoRestart
Enable-WindowsOptionalFeature -Online -FeatureName HypervisorPlatform -NoRestart
```
`VirtualMachinePlatform` is the one this error is usually about. Reboot afterwards.

**3. Allow the hypervisor to launch.** Same Admin terminal:
```powershell
bcdedit /set hypervisorlaunchtype auto
```
If it was `off` — some anti-cheat tools and old "gaming tweak" guides set that — Docker reports no virtualization regardless of BIOS. Reboot.

**4. Install and update the WSL2 kernel.** Same Admin terminal:
```powershell
wsl --install --no-distribution
wsl --update
wsl --set-default-version 2
wsl --status
```
`wsl --status` should say default version 2. If `wsl --install` is not recognised, run Windows Update fully, or install the kernel by hand from https://aka.ms/wsl2kernel. Reboot.

**5. Remove hypervisor conflicts.** Only one thing can own VT-x at a time. Uninstall or fully close any of these, then retry: VirtualBox, VMware Workstation/Player, BlueStacks or other Android emulators, Riot Vanguard (Valorant), Faceit/ESEA anti-cheat. Also check Task Manager -> Startup and disable them there.

**6. Check Core Isolation.** Windows Security -> Device security -> Core isolation details. If "Memory integrity" is On, turn it Off, reboot, retry. You can switch it back on later.

**7. Switch Docker's backend.** Docker Desktop -> Settings -> General. If "Use WSL 2 based engine" is ticked and failing, untick it to use the Hyper-V backend, Apply & Restart. Caveat: the Hyper-V backend needs Windows Pro or Enterprise. On Windows Home, leave it ticked and fix WSL in step 4 instead.

**8. Check your Windows edition and build.** Win+R -> type `winver` -> Enter. Current Docker Desktop needs Windows 10 build 19044 (22H2) or newer. Older builds cannot run it — run Windows Update first. A Haswell i5 will never be offered Windows 11 officially, and that is fine: Windows 10 22H2 plus WSL2 runs Docker properly.

Test after each attempt with the smallest possible command:
```powershell
docker run hello-world
```

### If Docker simply refuses to work on this machine
You do not actually need Docker to compile `ram.cheese`. Two fallbacks, best first.

**Fallback A — compile inside WSL2 Ubuntu, no Docker at all.** If step 4 got WSL working but Docker still won't start, install Ubuntu and CDT directly:
```powershell
wsl --install -d Ubuntu
```
Open Ubuntu from the Start menu, set a username and password, then:
```bash
sudo apt update && sudo apt install -y build-essential cmake wget
wget https://github.com/AntelopeIO/cdt/releases/download/v4.1.0/cdt_4.1.0_amd64.deb
sudo apt install -y ./cdt_4.1.0_amd64.deb
cdt-cpp --version
```
Your Windows files are visible inside Ubuntu at `/mnt/c/Users/User/Documents/wax-contracts/ram.cheese`, so `cd` there and run `mkdir -p build && cd build && cmake .. && make`. The `.wasm` and `.abi` land in your normal Windows folder, ready for Step 10. Everything in Step 5 about `CMakeLists.txt` still applies unchanged.

**Fallback B — let GitHub compile it for you.** Push the `ram.cheese` folder to a private GitHub repo with a workflow that installs CDT and runs those same three commands, then download `ramcheese.wasm` and `ramcheese.abi` from the run's artifacts and deploy them via waxblock.io as in Step 10. Nothing to install locally beyond git, and every future change rebuilds reproducibly. Say the word and I will write that workflow file for you.

## Step 2 — Install VS Code
Do this: download VS Code from code.visualstudio.com and install it. Open it. Click the four-squares icon in the left bar (Extensions). In the search box type each of these and click Install:

- `C/C++` by Microsoft
- `CMake Tools` by Microsoft
- `Dev Containers` by Microsoft

## Step 3 — Create the project folder
Do this: create a folder named exactly `ram.cheese`, for example at `Documents/wax-contracts/ram.cheese`.

In VS Code click File -> Open Folder, select that `ram.cheese` folder, and click Open. The left panel now shows your empty folder.

## Step 4 — Create the three files inside it
You are making this exact layout:

```text
ram.cheese/
├── src/
│   └── ramcheese.cpp        <- the contract logic
├── include/
│   └── ramcheese.hpp        <- the declarations: tables, action names
└── CMakeLists.txt           <- the build instructions
```

Do this, in the VS Code left panel:

1. Right-click the empty space under the folder name -> New Folder -> type `src` -> Enter.
2. Right-click the empty space again -> New Folder -> type `include` -> Enter.
3. Right-click the `src` folder -> New File -> type `ramcheese.cpp` -> Enter.
4. Right-click the `include` folder -> New File -> type `ramcheese.hpp` -> Enter.
5. Right-click the empty space (not inside either folder) -> New File -> type `CMakeLists.txt` -> Enter. The capital letters matter; `cmakelists.txt` will not be found.

Why two code files: the `.hpp` header is the list of what exists — the contract class, its tables, its action names. The `.cpp` holds the actual code for each action. The compiler reads the header first, then the source. Leave both empty for now; you will paste the contract code in later.

## Step 5 — Fill in `CMakeLists.txt`, and understand what you typed
Do this: click `CMakeLists.txt` in the left panel to open it, paste the five lines below exactly, then press Ctrl+S (Cmd+S on Mac) to save.

```cmake
cmake_minimum_required(VERSION 3.16)
project(ramcheese)
find_package(cdt)
add_contract(ramcheese ramcheese src/ramcheese.cpp)
target_include_directories(ramcheese PRIVATE ${CMAKE_SOURCE_DIR}/include)
```

First, what CMake even is, because this is the part that confused you. CMake is **not** the compiler. CMake is a recipe reader. It reads `CMakeLists.txt`, works out which files need compiling and in what order, and then writes out the long, boring, low-level build commands for you. A second tool called `make` then runs those commands, and the compiler does the actual work. You write five short lines; CMake writes the hundreds you never see.

Now each line, one at a time.

**Line 1 — `cmake_minimum_required(VERSION 3.16)`**
Means: "stop immediately if the CMake here is older than version 3.16." Older versions do not understand some of the syntax below, so this is a seatbelt. The Docker image you pull in Step 6 has a newer CMake, so this line always passes. You will never need to change it.

**Line 2 — `project(ramcheese)`**
Means: "the name of this build is ramcheese." It mostly just labels the build output. It is cosmetic, but CMake refuses to run without it, so it must be there.

**Line 3 — `find_package(cdt)`**
This is the important line. CDT stands for Contract Development Toolkit: it is the real WAX/Antelope C++ compiler plus WAX's smart-contract libraries. This line means "find CDT on this machine and load its extra commands."

Loading CDT is what makes line 4 possible at all — `add_contract` is not a built-in CMake command, it comes from CDT. This is also exactly why you must build inside the Docker image: on your own machine CDT is not installed, and this line fails with `Could not find a package configuration file provided by cdt`. If you ever see that error, you ran the build outside the container.

**Line 4 — `add_contract(ramcheese ramcheese src/ramcheese.cpp)`**
This is the actual build order: "build a contract out of this source file." It takes three arguments, and the first two being the same word is what makes it look strange:

1. The first `ramcheese` is the **contract name**. It gets written into the generated `.abi` file.
2. The second `ramcheese` is the **target name** — an internal nickname for this build job, which you reuse in line 5 to point back at "the thing I am building".
3. `src/ramcheese.cpp` is the **source file**. If you later split your code into more `.cpp` files, list them here separated by spaces.

The output file names come from the target name, so this line is what produces `ramcheese.wasm` and `ramcheese.abi`.

**Line 5 — `target_include_directories(ramcheese PRIVATE ${CMAKE_SOURCE_DIR}/include)`**
Means: "when compiling ramcheese, also look in the `include` folder for header files." Without this line, the `#include "ramcheese.hpp"` at the top of your `.cpp` fails, because the header sits in `include/` while the source sits in `src/` and the compiler does not go looking on its own.

- `ramcheese` — which build job this applies to (the target name from line 4).
- `PRIVATE` — this search path is only for building this contract, not for anything that might later depend on it. For a standalone contract, `PRIVATE` is always correct.
- `${CMAKE_SOURCE_DIR}` — a CMake variable meaning "the folder that contains this CMakeLists.txt". Using it instead of typing `C:/Users/you/Documents/...` keeps the file working on any computer.

Read as one sentence: *require a modern CMake, name the build ramcheese, load the WAX toolchain, build `src/ramcheese.cpp` into a contract called ramcheese, and look in `include/` for headers.* That is the entire file, and you will not need to touch it again unless you add another `.cpp`.

## Step 6 — Get the WAX compiler (CDT) into an image you own
Two things went wrong in your attempt: you typed `:lat` instead of `:latest`, and more importantly **`antelopeio/cdt` is not published on Docker Hub**. That is what "pull access denied ... repository does not exist" means — Docker Hub has no such repo, so it assumed it must be a private one and asked you to log in. Nothing is wrong with your Docker; the engine clearly works now, since it reached the daemon and got a real answer back from Docker Hub.

So you are going to stop looking for a ready-made image and make your own instead. That sounds harder than it is: you write a 5-line text file that says "start with Ubuntu, then install the WAX compiler in it", and Docker follows those instructions once and saves the result as your own image. From then on it behaves exactly like a downloaded one.

First, some words so the rest makes sense:
- An **image** is a saved, frozen copy of a small Linux computer with software already installed in it.
- A **Dockerfile** is a plain text file — a recipe — listing the steps to build that image. It is not code you run; Docker reads it.
- `docker build` reads the Dockerfile and produces the image. You do that once. `docker run` starts a throwaway copy of the image, which is what you do every time you compile.

### 6a — Create the Dockerfile

**Where:** in VS Code, with your `ram.cheese` folder open (the one you opened in Step 3). You will be looking at the file list on the left, which currently shows `src`, `include` and `CMakeLists.txt`.

**Do this:**
1. In that left-hand file list, right-click on the **empty grey space below** `CMakeLists.txt`. Not on top of `src`, not on top of `include` — if you right-click a folder, the new file goes inside it, which is wrong here.
2. Click **New File**.
3. Type exactly this name, then press Enter:
   ```text
   Dockerfile
   ```
   Capital `D`, lower-case the rest, and **no `.txt`, no dot, no extension of any kind**. If VS Code shows it as `Dockerfile.txt`, right-click it -> Rename -> delete the `.txt` -> Enter. The name matters because `docker build` looks for a file called precisely `Dockerfile`.
4. VS Code opens the empty file in the big editing area on the right. Click once inside that empty area so the cursor is there.
5. Copy the five lines below and paste them in with Ctrl+V:

```dockerfile
FROM ubuntu:22.04
RUN apt-get update && apt-get install -y build-essential cmake wget \
 && wget -q https://github.com/AntelopeIO/cdt/releases/download/v4.1.0/cdt_4.1.0_amd64.deb \
 && apt-get install -y ./cdt_4.1.0_amd64.deb \
 && rm cdt_4.1.0_amd64.deb
```

6. Press **Ctrl+S** to save. The white dot next to the filename in its tab disappears when it is saved. If it is still there, the file is unsaved and `docker build` will not see your text.

**What you just pasted, in plain English:**
- `FROM ubuntu:22.04` — begin with a clean Ubuntu Linux 22.04 system. Docker downloads this part for you.
- `RUN apt-get update && apt-get install -y build-essential cmake wget` — inside that Ubuntu, install a C++ compiler toolchain, CMake, and `wget` (a downloader). `-y` means "answer yes to prompts", because nobody is sitting there to press y.
- the `wget -q https://...cdt_4.1.0_amd64.deb` line — download the official WAX/Antelope CDT installer package from AntelopeIO's GitHub releases.
- `apt-get install -y ./cdt_4.1.0_amd64.deb` — install it. This is the step that gives you the actual WAX compiler.
- `rm cdt_4.1.0_amd64.deb` — delete the installer file afterwards, so the image stays small.
- The `\` at the end of lines and the `&&` at the start of the next simply mean "this is all one long command, continued". Keep them exactly as shown.

Your folder now looks like this:

```text
ram.cheese/
├── src/ramcheese.cpp
├── include/ramcheese.hpp
├── CMakeLists.txt
└── Dockerfile        <- new
```

### 6b — Build the image

**Where:** in PowerShell — and it must be pointed at the `ram.cheese` folder, because `docker build` reads the Dockerfile from whatever folder you are currently in.

Easiest way to be sure you are in the right place: in VS Code press **Ctrl+`** (the backtick key, top-left under Esc). A terminal panel opens at the bottom, already sitting in your `ram.cheese` folder. If it says `PS C:\Users\User\Documents\wax-contracts\ram.cheese>` you are correct.

If you prefer your own PowerShell window: type `cd`, then a space, then drag the `ram.cheese` folder from File Explorer onto the PowerShell window (that pastes its path), then press Enter.

Confirm Docker Desktop is open and says **Engine running**, then type this and press Enter:

```powershell
docker build -t waxcdt .
```

- `docker build` — read the Dockerfile and construct the image.
- `-t waxcdt` — "tag it", i.e. name the finished image `waxcdt`. You choose this name; `waxcdt` is what the rest of this guide assumes.
- the `.` on the end — "the Dockerfile is in the folder I am in right now". It is easy to miss and Docker fails without it.

**What you will see:** several minutes of scrolling text as Ubuntu and the compiler download and install. That is normal, leave it alone. It finishes with lines containing `naming to docker.io/library/waxcdt` or `Successfully tagged waxcdt:latest`.

### 6c — Check it worked

Same terminal, type:

```powershell
docker run --rm waxcdt cdt-cpp --version
```

This starts a throwaway copy of your image and asks the WAX compiler inside it to print its version. You should see something like `cdt-cpp version 4.1.0`.

If you do, Step 6 is finished. **Wherever the steps below say `IMAGE_NAME`, type `waxcdt`.**

**If something goes wrong:**
- `failed to read dockerfile` or `Dockerfile: no such file` — you are in the wrong folder, or the file is named `Dockerfile.txt`. Run `dir` and check that `Dockerfile` is listed with no extension.
- The build stops on the `wget` line with a 404 — AntelopeIO published a newer version and removed that URL. Open https://github.com/AntelopeIO/cdt/releases in your browser, find the newest file ending in `_amd64.deb`, and replace `4.1.0` with that version number in **both** places in the Dockerfile. Save, and run `docker build -t waxcdt .` again.
- `failed to connect to the docker API` — Docker Desktop is closed. Open it, wait for "Engine running", retry.



## Step 7 — Compile
Do this: in the terminal, move into your project folder first. Type `cd` then a space, then drag the `ram.cheese` folder from your file manager onto the terminal window (that pastes the path), then Enter.

Now run the command for your system, replacing `IMAGE_NAME` with the image from Step 6.

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

What you just typed:
- `--rm` — throw the container away when it finishes, so nothing piles up on your machine.
- `-v "$(pwd)":/project` — share your current folder with the container as `/project`, so it can read your code and write the results back into your real folder.
- `-w /project` — start inside that shared folder.
- `mkdir -p build && cd build` — keep generated junk in a `build` folder instead of mixing it with your code.
- `cmake ..` — read `CMakeLists.txt` in the folder above and generate the real build commands.
- `make` — run them. This is where compiling actually happens.

You know it worked when a `build` folder appears containing:
- `ramcheese.wasm` — the compiled contract
- `ramcheese.abi` — the interface file wallets and explorers read

You need both to deploy. If it fails and names a file and a line number, that is a mistake in your C++, not in Docker. If it says it cannot find package `cdt`, you ran the build outside the container — recheck the `IMAGE_NAME`.

## Step 8 (optional) — Stop typing the long docker command
Do this: right-click empty space in the VS Code panel -> New Folder -> `.devcontainer`. Inside it create `devcontainer.json` and paste:

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

Replace `IMAGE_NAME` with your image, save, press F1, type `Reopen in Container`, and pick "Dev Containers: Reopen in Container". VS Code now runs inside the WAX toolchain, so in its built-in terminal you can simply run:

```bash
mkdir -p build && cd build && cmake .. && make
```

## Step 9 — Deploy to WAX testnet first. Do not skip this.
A broken contract on mainnet costs real WAX and can lock funds.

Do this:
1. Create a free testnet account at a faucet such as https://waxsweden.org/testnet/ and save the keys it gives you.
2. Deploy there using Step 10 or Step 11, but point at a testnet endpoint: `https://testnet.waxsweden.org`.
3. Call each action once and look at the tables in the explorer. For `ram.cheese`, send a mock CHEESE transfer to test a buy and a `ramtransfer` to test a sell.
4. Only when both work, repeat on mainnet.

## Step 10 — Deploy option A: the block explorer (easiest, you never type a private key)
This is the route the person you quoted used.

Do this:
1. Go to https://waxblock.io (or https://wax.bloks.io) and open the `ram.cheese` account, then its contract deploy tool.
2. Click Login, choose your wallet (Anchor, Wombat, or WAX Cloud Wallet) and log in as `ram.cheese`.
3. Upload `build/ramcheese.wasm` in the WASM field and `build/ramcheese.abi` in the ABI field.
4. Read the transaction preview. It should contain two actions: `eosio::setcode` and `eosio::setabi`. If it does not, you uploaded the wrong files.
5. Click Sign / Submit and approve it in your wallet.
6. Copy the transaction ID and open `https://waxblock.io/transaction/<txid>` to confirm it executed.

If it fails with a RAM error, buy more RAM on `ram.cheese` and retry.

## Step 11 — Deploy option B: command line with cleos
Use this once you are deploying repeatedly.

Do this:
1. Pull the image that contains `cleos`:
   ```bash
   docker pull antelopeio/leap:latest
   ```
2. From your project folder, start it:
   ```bash
   docker run --rm -it -v "$(pwd)":/project -w /project antelopeio/leap:latest bash
   ```
   You are now typing inside the container.
3. Create a wallet and load your key:
   ```bash
   keosd &
   cleos wallet create --to-console
   cleos wallet import
   ```
   `cleos wallet create --to-console` prints a password — copy it somewhere safe, you need it to unlock the wallet later. `cleos wallet import` then prompts for your private key, so it never appears in your shell history. Never paste a private key directly on a command line.
4. Deploy:
   ```bash
   cleos -u https://wax.greymass.com set contract ram.cheese ./build ramcheese.wasm ramcheese.abi
   ```
5. Check it landed:
   ```bash
   cleos -u https://wax.greymass.com get code ram.cheese
   ```
   The code hash it prints must not be all zeros. All zeros means nothing deployed.

If an endpoint is rate-limited, swap `-u` for `https://wax.eosphere.io`, `https://api.wax.alohaeos.com`, or `https://wax.pink.gg`.

## Step 12 — Set the contract up after deploying
A freshly deployed contract does nothing until you configure it. Do this, in this order:

1. Add `eosio.code` to the `active` permission of `ram.cheese`. In waxblock.io: open the account -> Permissions -> edit `active` -> add `ram.cheese@eosio.code` as an authority -> sign. Without this, every inline action (`buyram`, `sellram`, CHEESE transfers) fails with a missing-authority error.
2. Call `setconfig` once, with the CHEESE/WAX Alcor pool id, min and max CHEESE per purchase, the reference rate, the max deviation percent, and the liquid WAX reserve floor.
3. Call `setsellcfg` once, with the sell on/off switch, min and max sell bytes, and the CHEESE pool floor.
4. Fund it: send WAX to `ram.cheese` for the buy reserve (no memo needed), and send CHEESE with the memo `deposit` to fill the sell payout pool.
5. Confirm on waxblock.io that the `config` and `stats` tables now show your values.

## Step 13 — Safety, before real money touches it
- Create a dedicated permission on `ram.cheese` called `deployer`, with parent `active`, linked only to `eosio::setcode` and `eosio::setabi`. Deploy with that key from then on, not your full `active` key.
- Never commit private keys. Add any `.key` files and wallet passwords to `.gitignore`.
- Once the contract holds real value, move control to a multisig so no single key can silently replace the code.

## Quick reference
| What | Where to get it | Why |
| --- | --- | --- |
| Docker Desktop | docker.com/products/docker-desktop | Runs the WAX compiler without installing one |
| VS Code | code.visualstudio.com | Writing the C++ contract |
| CDT Docker image | `docker pull` in Step 6 | Turns `.cpp` into `.wasm` and `.abi` |
| Leap Docker image | `docker pull antelopeio/leap` | Gives you `cleos` for CLI deployment |
| `ram.cheese` account with RAM | Any WAX wallet or Anchor | Holds and pays for the contract |
| Testnet account | A WAX testnet faucet | Safe place to break things first |
| waxblock.io / bloks.io | Browser | Upload without the CLI, and verify transactions |

## Later, if the contract should live in the CHEESEHub repo
Not part of this task. It would be a `contracts/ramcheese/` folder with the C++ source and `CMakeLists.txt`, a `contracts/build.sh` wrapper around the Docker command, and a GitHub Actions workflow that compiles on every push so the `.wasm` and `.abi` are always reproducible.