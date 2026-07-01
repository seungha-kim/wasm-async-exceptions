#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
./build.sh
# Playwright spec lives at tests/A/s1.spec.ts; webServer serves examples/.
cd ../../..
npx playwright test A/s1