#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

printf '| Target | Scenario | main.wasm bytes | main.js bytes |\n'
printf '|---|---:|---:|---:|\n'

for target in A B C D E Ep; do
  for scenario in s1 s2 s3 s4; do
    dir="$ROOT/examples/$target/$scenario/build"
    wasm="$dir/main.wasm"
    js="$dir/main.js"

    if [[ ! -f "$wasm" ]]; then
      printf 'missing expected artifact: %s\n' "$wasm" >&2
      exit 1
    fi
    if [[ ! -f "$js" ]]; then
      printf 'missing expected artifact: %s\n' "$js" >&2
      exit 1
    fi

    wasm_bytes="$(wc -c < "$wasm" | tr -d ' ')"
    js_bytes="$(wc -c < "$js" | tr -d ' ')"
    label="$target"
    if [[ "$target" == "Ep" ]]; then
      label="E'"
    fi

    printf '| %s | %s | %s | %s |\n' "$label" "${scenario#s}" "$wasm_bytes" "$js_bytes"
  done
done
