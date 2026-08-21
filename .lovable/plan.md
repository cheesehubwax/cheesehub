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
 && wget -q https://github.com/AntelopeIO/cdt/releases/download/v4.1.1/cdt_4.1.1-1_amd64.deb \
 && apt-get install -y ./cdt_4.1.1-1_amd64.deb \
 && rm cdt_4.1.1-1_amd64.deb
```

Note the filename: `cdt_4.1.1-1_amd64.deb`. That trailing `-1` is part of the real name of the file AntelopeIO published (it is the Debian package revision number). Leaving it out is what produces the `exit code: 8` build failure — that is `wget` reporting "the server said no such file", i.e. a 404. Copy the block above verbatim; do not tidy the `-1` away.

6. Press **Ctrl+S** to save. The white dot next to the filename in its tab disappears when it is saved. If it is still there, the file is unsaved and `docker build` will not see your text.

**What you just pasted, in plain English:**
- `FROM ubuntu:22.04` — begin with a clean Ubuntu Linux 22.04 system. Docker downloads this part for you.
- `RUN apt-get update && apt-get install -y build-essential cmake wget` — inside that Ubuntu, install a C++ compiler toolchain, CMake, and `wget` (a downloader). `-y` means "answer yes to prompts", because nobody is sitting there to press y.
- the `wget -q https://...cdt_4.1.1-1_amd64.deb` line — download the official WAX/Antelope CDT installer package from AntelopeIO's GitHub releases.
- `apt-get install -y ./cdt_4.1.1-1_amd64.deb` — install it. This is the step that gives you the actual WAX compiler.
- `rm cdt_4.1.1-1_amd64.deb` — delete the installer file afterwards, so the image stays small.

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




### 6d — Paste the contract code (this is why your last build failed)

Read your last output again: the toolchain part now works perfectly.

```text
-- Setting up CDT Wasm Toolchain 4.1.1 at /usr
-- The CXX compiler identification is Clang 9.0.1
```

That is the fix from Step 7 doing its job. Docker, CDT, CMake and the toolchain flag are all correct now. The two lines that stopped it are:

```text
Warning, contract is empty and ABI is not generated
wasm-ld: error: fatal failure: contract with no actions and trying to create dispatcher
```

In plain English: your `src/ramcheese.cpp` and `include/ramcheese.hpp` are still the empty files you created in Step 4. The compiler compiled nothing, found no actions, and refused to produce a contract that can never be called. Nothing is broken — you just have not written the contract yet. (`--- failed` on the two "compiler ABI info" lines is normal for a Wasm compiler and is not an error.)

`ramcheese.hpp` — the declarations. Click it in the VS Code panel, paste all of this, Ctrl+S:

```cpp
#pragma once

#include <eosio/eosio.hpp>
#include <eosio/asset.hpp>
#include <eosio/singleton.hpp>
#include <eosio/system.hpp>
#include <string>

using namespace eosio;

// Read-only view of any eosio.token-style contract's balance table.
namespace tokenview {
   struct account {
      asset balance;
      uint64_t primary_key() const { return balance.symbol.code().raw(); }
   };
   typedef multi_index<name("accounts"), account> accounts;
}

CONTRACT ramcheese : public contract {
public:
   using contract::contract;

   static constexpr symbol WAX_SYM      = symbol("WAX", 8);
   static constexpr symbol CHEESE_SYM   = symbol("CHEESE", 4);
   static constexpr name   WAX_TOKEN    = name("eosio.token");
   static constexpr name   CHEESE_TOKEN = name("cheeseburger");
   static constexpr name   NULL_ACCT    = name("eosio.null");
   static constexpr name   SYSTEM_ACCT  = name("eosio");

   ACTION setconfig(name owner, name oracle, asset min_buy, asset max_buy,
                    uint16_t buy_fee_bps, uint16_t sell_fee_bps,
                    asset wax_reserve_floor, asset cheese_pool_floor,
                    int64_t min_sell_bytes, int64_t max_sell_bytes);

   ACTION setrates(asset cheese_per_wax, asset wax_per_kb, uint16_t max_deviation_bps);

   ACTION setpause(bool buy_paused, bool sell_paused);

   ACTION withdraw(name token_contract, name to, asset quantity, std::string memo);

   [[eosio::on_notify("cheeseburger::transfer")]]
   void on_cheese(name from, name to, asset quantity, std::string memo);

   [[eosio::on_notify("eosio::ramtransfer")]]
   void on_ram(name from, name to, int64_t bytes, std::string memo);

   TABLE config_row {
      name           owner;
      name           oracle;
      asset          min_buy;
      asset          max_buy;
      uint16_t       buy_fee_bps       = 0;
      uint16_t       sell_fee_bps      = 0;
      asset          wax_reserve_floor;
      asset          cheese_pool_floor;
      int64_t        min_sell_bytes    = 0;
      int64_t        max_sell_bytes    = 0;
      asset          cheese_per_wax;
      asset          wax_per_kb;
      uint16_t       max_deviation_bps = 1000;
      bool           buy_paused        = false;
      bool           sell_paused       = false;
      time_point_sec rates_updated;
   };
   typedef singleton<name("config"), config_row> config_tbl;

   TABLE stats_row {
      asset    cheese_nulled;
      asset    wax_spent;
      asset    cheese_paid;
      int64_t  bytes_bought = 0;
      int64_t  bytes_sold   = 0;
      uint64_t buys         = 0;
      uint64_t sells        = 0;
   };
   typedef singleton<name("stats"), stats_row> stats_tbl;

private:
   config_row load_config();
   stats_row  load_stats();
   asset      balance_of(name token_contract, symbol sym);
   void       pay(name token_contract, name to, asset quantity, const std::string& memo);
};
```

`ramcheese.cpp` — the logic. Click it, paste all of this, Ctrl+S:

```cpp
#include "ramcheese.hpp"

using std::string;

ramcheese::config_row ramcheese::load_config() {
   config_tbl cfg(get_self(), get_self().value);
   check(cfg.exists(), "ram.cheese is not configured yet: call setconfig first");
   return cfg.get();
}

ramcheese::stats_row ramcheese::load_stats() {
   stats_tbl st(get_self(), get_self().value);
   if (st.exists()) return st.get();
   stats_row row;
   row.cheese_nulled = asset(0, CHEESE_SYM);
   row.wax_spent     = asset(0, WAX_SYM);
   row.cheese_paid   = asset(0, CHEESE_SYM);
   return row;
}

asset ramcheese::balance_of(name token_contract, symbol sym) {
   tokenview::accounts acc(token_contract, get_self().value);
   auto it = acc.find(sym.code().raw());
   return it == acc.end() ? asset(0, sym) : it->balance;
}

void ramcheese::pay(name token_contract, name to, asset quantity, const string& memo) {
   action(
      permission_level{get_self(), name("active")},
      token_contract, name("transfer"),
      std::make_tuple(get_self(), to, quantity, memo)
   ).send();
}

void ramcheese::setconfig(name owner, name oracle, asset min_buy, asset max_buy,
                          uint16_t buy_fee_bps, uint16_t sell_fee_bps,
                          asset wax_reserve_floor, asset cheese_pool_floor,
                          int64_t min_sell_bytes, int64_t max_sell_bytes) {
   config_tbl cfg(get_self(), get_self().value);
   config_row row;
   if (cfg.exists()) {
      row = cfg.get();
      require_auth(row.owner);
   } else {
      require_auth(get_self());
      row.cheese_per_wax    = asset(0, CHEESE_SYM);
      row.wax_per_kb        = asset(0, WAX_SYM);
      row.max_deviation_bps = 1000;
      row.buy_paused        = false;
      row.sell_paused       = false;
      row.rates_updated     = time_point_sec(0);
   }

   check(is_account(owner),  "owner account does not exist");
   check(is_account(oracle), "oracle account does not exist");
   check(min_buy.symbol == CHEESE_SYM && max_buy.symbol == CHEESE_SYM, "buy limits must be CHEESE");
   check(min_buy.amount > 0 && max_buy.amount >= min_buy.amount, "bad buy limits");
   check(wax_reserve_floor.symbol == WAX_SYM && wax_reserve_floor.amount >= 0, "wax_reserve_floor must be WAX");
   check(cheese_pool_floor.symbol == CHEESE_SYM && cheese_pool_floor.amount >= 0, "cheese_pool_floor must be CHEESE");
   check(buy_fee_bps <= 2000 && sell_fee_bps <= 2000, "fees are capped at 20%");
   check(min_sell_bytes > 0 && max_sell_bytes >= min_sell_bytes, "bad sell size limits");

   row.owner             = owner;
   row.oracle            = oracle;
   row.min_buy           = min_buy;
   row.max_buy           = max_buy;
   row.buy_fee_bps       = buy_fee_bps;
   row.sell_fee_bps      = sell_fee_bps;
   row.wax_reserve_floor = wax_reserve_floor;
   row.cheese_pool_floor = cheese_pool_floor;
   row.min_sell_bytes    = min_sell_bytes;
   row.max_sell_bytes    = max_sell_bytes;
   cfg.set(row, get_self());
}

void ramcheese::setrates(asset cheese_per_wax, asset wax_per_kb, uint16_t max_deviation_bps) {
   config_tbl cfg(get_self(), get_self().value);
   check(cfg.exists(), "call setconfig first");
   config_row row = cfg.get();
   check(has_auth(row.oracle) || has_auth(row.owner), "only the oracle or the owner can set rates");

   check(cheese_per_wax.symbol == CHEESE_SYM && cheese_per_wax.amount > 0, "cheese_per_wax must be positive CHEESE");
   check(wax_per_kb.symbol == WAX_SYM && wax_per_kb.amount > 0, "wax_per_kb must be positive WAX");
   check(max_deviation_bps > 0 && max_deviation_bps <= 5000, "max_deviation_bps out of range");

   if (row.cheese_per_wax.amount > 0 && !has_auth(row.owner)) {
      int128_t old_v = row.cheese_per_wax.amount;
      int128_t new_v = cheese_per_wax.amount;
      int128_t diff  = new_v > old_v ? new_v - old_v : old_v - new_v;
      check(diff * 10000 <= old_v * (int128_t)row.max_deviation_bps,
            "new rate deviates too far from the stored rate; the owner must confirm it");
   }

   row.cheese_per_wax    = cheese_per_wax;
   row.wax_per_kb        = wax_per_kb;
   row.max_deviation_bps = max_deviation_bps;
   row.rates_updated     = time_point_sec(current_time_point());
   cfg.set(row, get_self());
}

void ramcheese::setpause(bool buy_paused, bool sell_paused) {
   config_tbl cfg(get_self(), get_self().value);
   check(cfg.exists(), "call setconfig first");
   config_row row = cfg.get();
   require_auth(row.owner);
   row.buy_paused  = buy_paused;
   row.sell_paused = sell_paused;
   cfg.set(row, get_self());
}

void ramcheese::withdraw(name token_contract, name to, asset quantity, string memo) {
   config_row row = load_config();
   require_auth(row.owner);
   check(quantity.amount > 0, "quantity must be positive");
   check(is_account(to), "destination account does not exist");
   pay(token_contract, to, quantity, memo);
}

// BUY RAM: someone sends CHEESE, contract spends its own liquid WAX on RAM for them,
// and the CHEESE it received is nulled.
void ramcheese::on_cheese(name from, name to, asset quantity, string memo) {
   if (to != get_self() || from == get_self()) return;   // outgoing or not for us
   if (memo == "deposit") return;                        // owner funding the CHEESE payout pool

   config_row row = load_config();
   check(!row.buy_paused, "RAM buying is paused");
   check(quantity.symbol == CHEESE_SYM, "only CHEESE is accepted here");
   check(row.cheese_per_wax.amount > 0, "no CHEESE/WAX rate is set yet");
   check(quantity >= row.min_buy, "below the minimum purchase");
   check(quantity <= row.max_buy, "above the maximum purchase");

   name receiver = from;
   if (!memo.empty()) {
      check(memo.size() <= 12, "memo must be empty or a WAX account name");
      receiver = name(memo);
      check(is_account(receiver), "the account in the memo does not exist");
   }

   // CHEESE -> WAX using the stored rate, then take the buy fee.
   int128_t gross = (int128_t)quantity.amount * 100000000 / (int128_t)row.cheese_per_wax.amount;
   int128_t net   = gross * (10000 - (int128_t)row.buy_fee_bps) / 10000;
   check(net > 0, "amount too small to buy any RAM");
   asset wax_spend = asset((int64_t)net, WAX_SYM);

   asset liquid = balance_of(WAX_TOKEN, WAX_SYM);
   check(liquid >= wax_spend + row.wax_reserve_floor,
         "not enough liquid WAX in the contract right now; try a smaller amount");

   action(permission_level{get_self(), name("active")}, SYSTEM_ACCT, name("buyram"),
          std::make_tuple(get_self(), receiver, wax_spend)).send();

   pay(CHEESE_TOKEN, NULL_ACCT, quantity, "ram.cheese: CHEESE nulled for a RAM purchase");

   stats_tbl st(get_self(), get_self().value);
   stats_row s = load_stats();
   s.cheese_nulled += quantity;
   s.wax_spent     += wax_spend;
   s.buys          += 1;
   st.set(s, get_self());
}

// SELL RAM: someone transfers RAM bytes to the contract, the contract sells them
// for WAX (which it keeps) and pays the seller CHEESE out of its pool.
void ramcheese::on_ram(name from, name to, int64_t bytes, string memo) {
   if (to != get_self() || from == get_self()) return;
   if (memo == "deposit") return;                        // owner topping up contract RAM

   config_row row = load_config();
   check(!row.sell_paused, "RAM selling is paused");
   check(row.cheese_per_wax.amount > 0 && row.wax_per_kb.amount > 0, "no rates are set yet");
   check(bytes >= row.min_sell_bytes, "below the minimum sell size");
   check(bytes <= row.max_sell_bytes, "above the maximum sell size");

   int128_t wax_units    = (int128_t)bytes * (int128_t)row.wax_per_kb.amount / 1024;
   int128_t cheese_units = wax_units * (int128_t)row.cheese_per_wax.amount / 100000000;
   cheese_units          = cheese_units * (10000 - (int128_t)row.sell_fee_bps) / 10000;
   check(cheese_units > 0, "amount too small to pay out");
   asset payout = asset((int64_t)cheese_units, CHEESE_SYM);

   asset pool = balance_of(CHEESE_TOKEN, CHEESE_SYM);
   check(pool >= payout + row.cheese_pool_floor, "the CHEESE payout pool is too low right now");

   action(permission_level{get_self(), name("active")}, SYSTEM_ACCT, name("sellram"),
          std::make_tuple(get_self(), bytes)).send();

   pay(CHEESE_TOKEN, from, payout, "ram.cheese: CHEESE for RAM sold");

   stats_tbl st(get_self(), get_self().value);
   stats_row s = load_stats();
   s.cheese_paid += payout;
   s.bytes_sold  += bytes;
   s.sells       += 1;
   st.set(s, get_self());
}
```

Then re-run the Step 7 compile command. You are looking for `ramcheese.wasm` **and** `ramcheese.abi` in the `build` folder, with no `wasm-ld` error.

**Two things about this code you should know before deploying it.**

1. **Pricing comes from a rate you push in, not from Alcor on-chain.** Alcor's pools store price as a 128-bit square-root value that needs heavy maths a contract should not be doing, so this version keeps `cheese_per_wax` and `wax_per_kb` in the `config` table. The `oracle` account (which can be a small script, or you) calls `setrates` on a schedule; `max_deviation_bps` rejects any jump bigger than you allow unless the owner signs it. Every buy and sell uses the stored rate, so a stale rate is the main risk — keep the updater running and keep the deviation guard tight.
2. **The sell flow depends on `eosio::ramtransfer` existing on WAX.** Before deploying, open `eosio` on waxblock.io -> Contract -> ABI and search for `ramtransfer`. If it is there, the sell flow works as written. If it is not, WAX's system contract predates that feature and the sell side needs a different design — tell me and I will rework it; the buy side is unaffected either way.





## Step 7 — Compile
Do this: in the terminal, move into your project folder first. Type `cd` then a space, then drag the `ram.cheese` folder from your file manager onto the terminal window (that pastes the path), then Enter. (Or just use VS Code's built-in terminal with Ctrl+`, which already starts there.)

One important extra piece: plain `cmake ..` is not enough. Inside the container there are **two** C++ compilers — Ubuntu's ordinary `c++`, which builds programs for Linux, and CDT's `cdt-cpp`, which builds WebAssembly for WAX. CMake picks Ubuntu's by default, and Ubuntu's compiler has never heard of WAX-only options like `-abigen`, which is exactly the `unrecognized command-line option '-abigen'` error. CDT ships a small file that tells CMake "use my compiler, not the system one" — a **toolchain file** — and you point CMake at it with `-DCMAKE_TOOLCHAIN_FILE=...`. Get that one flag in and the error disappears.

**First, delete the failed build folder.** It has the wrong compiler choice cached inside it, and CMake will keep reusing that choice no matter what flags you add. In PowerShell, from your `ram.cheese` folder:

```powershell
Remove-Item -Recurse -Force build
```

(macOS/Linux: `rm -rf build`.)

Now run the command for your system. `waxcdt` is the image you built in Step 6 — if you named it something else, use that name instead.

Windows PowerShell:
```powershell
docker run --rm -v "${PWD}:/project" -w /project waxcdt `
  bash -c "mkdir -p build && cd build && cmake -DCMAKE_TOOLCHAIN_FILE=/usr/lib/cmake/cdt/CDTWasmToolchain.cmake .. && make"
```

macOS / Linux:
```bash
docker run --rm -v "$(pwd)":/project -w /project waxcdt \
  bash -c "mkdir -p build && cd build && cmake -DCMAKE_TOOLCHAIN_FILE=/usr/lib/cmake/cdt/CDTWasmToolchain.cmake .. && make"
```

What you just typed:
- `--rm` — throw the container away when it finishes, so nothing piles up on your machine.
- `-v "${PWD}:/project"` — share your current folder with the container as `/project`, so it can read your code and write the results back into your real folder.
- `-w /project` — start inside that shared folder.
- `mkdir -p build && cd build` — keep generated junk in a `build` folder instead of mixing it with your code.
- `cmake -DCMAKE_TOOLCHAIN_FILE=/usr/lib/cmake/cdt/CDTWasmToolchain.cmake ..` — read `CMakeLists.txt` in the folder above and generate the real build commands, **using the WAX compiler**. `-D` means "define a setting for CMake"; that path is where CDT installs its toolchain file inside the image.
- `make` — run them. This is where compiling actually happens.

**How you know it is now using the right compiler.** In the output near the top you should see:

```text
-- Setting up CDT Wasm Toolchain 4.1.1 at /usr
-- The CXX compiler identification is Clang ...
```

If you still see `The CXX compiler identification is GNU 11.4.0`, the toolchain flag did not take effect — almost always because the old `build` folder still exists. Delete it and run again.

You know the whole thing worked when a `build` folder appears containing:
- `ramcheese.wasm` — the compiled contract
- `ramcheese.abi` — the interface file wallets and explorers read

You need both to deploy.

**Troubleshooting Step 7:**
- `contract with no actions and trying to create dispatcher` / `Warning, contract is empty` — your `.cpp` and `.hpp` are still empty. Go back to Step 6d and paste the contract code, save both files, then run this command again.
- `unrecognized command-line option '-abigen'` — the toolchain flag is missing, or a stale `build` folder is being reused. Delete `build`, re-run the full command above.
- An error naming one of your own files with a line number (e.g. `src/ramcheese.cpp:42`) — that is a mistake in your C++, not in Docker. Fix the line it names.
- `Could not find a package configuration file provided by cdt` — you ran `cmake` on your Windows machine instead of inside the container. Use the `docker run ...` command exactly as written.


## Step 8 (optional) — Stop typing the long docker command
Do this: right-click empty space in the VS Code panel -> New Folder -> `.devcontainer`. Inside it create `devcontainer.json` and paste:

```json
{
  "name": "WAX Contract Dev",
  "image": "waxcdt",
  "customizations": {
    "vscode": {
      "extensions": ["ms-vscode.cpptools", "ms-vscode.cmake-tools"]
    }
  }
}
```

Save, press F1, type `Reopen in Container`, and pick "Dev Containers: Reopen in Container". VS Code now runs inside the WAX toolchain, so in its built-in terminal you can simply run:

```bash
mkdir -p build && cd build && cmake -DCMAKE_TOOLCHAIN_FILE=/usr/lib/cmake/cdt/CDTWasmToolchain.cmake .. && make
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
2. Call `setconfig` once, with: `owner` (your account), `oracle` (the account that will push rates), `min_buy` / `max_buy` in CHEESE, `buy_fee_bps` / `sell_fee_bps` (100 = 1%), `wax_reserve_floor` in WAX, `cheese_pool_floor` in CHEESE, and `min_sell_bytes` / `max_sell_bytes`.
3. Call `setrates` once, with the current `cheese_per_wax` (CHEESE), `wax_per_kb` (WAX per 1024 bytes of RAM), and `max_deviation_bps` (1000 = 10%). Repeat this on a schedule from the oracle account.
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