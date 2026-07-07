#!/usr/bin/env sh
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
BUILD_DIR="$ROOT_DIR/cmake-build-emscripten"

. "$ROOT_DIR/scripts/emsdk-env.sh"
emcmake cmake -S "$ROOT_DIR" -B "$BUILD_DIR" -DCMAKE_EXPORT_COMPILE_COMMANDS=ON
cmake --build "$BUILD_DIR" --target example_B_s8
