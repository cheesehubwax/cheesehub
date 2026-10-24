#!/usr/bin/env bash
# Builds cheesecrypt.wasm + cheesecrypt.abi with the Antelope CDT (cdt-cpp, v4+).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p build
cdt-cpp -abigen -I include -R ricardian -contract cheesecrypt -o build/cheesecrypt.wasm src/cheesecrypt.cpp
echo "Built build/cheesecrypt.wasm and build/cheesecrypt.abi"
