#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
bin="$(mktemp /tmp/cheesecrypt-rules.XXXXXX)"
trap 'rm -f "$bin"' EXIT
"${CXX:-c++}" -std=c++17 -Wall -Wextra -Werror "$root/tests/router_rules_test.cpp" -o "$bin"
"$bin"