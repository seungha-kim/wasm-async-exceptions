#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

for target in A B C D E Ep; do
  for scenario in s1 s2 s3 s4; do
    "$ROOT/examples/$target/$scenario/build.sh"
  done
done
