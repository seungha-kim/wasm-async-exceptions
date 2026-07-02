#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
./build.sh
cd ../../..
npx playwright test Ep/s1
