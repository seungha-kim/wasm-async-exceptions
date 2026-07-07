#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
ROOT="$(cd ../../.. && pwd)"
BUILD_DIR="${BUILD_DIR:-$ROOT/cmake-build-emscripten}"

emcmake cmake -S "$ROOT" -B "$BUILD_DIR"
cmake --build "$BUILD_DIR" --target example_D_s4
echo "built: $(pwd)/build/main.js"
