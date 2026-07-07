#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
ROOT="$(cd ../../.. && pwd)"
BUILD_DIR="${BUILD_DIR:-$ROOT/cmake-build-emscripten}"

emcmake cmake -S "$ROOT" -B "$BUILD_DIR" -DCMAKE_EXPORT_COMPILE_COMMANDS=ON
cmake --build "$BUILD_DIR" --target example_B_s3
echo "built: $(pwd)/build/main.js"
