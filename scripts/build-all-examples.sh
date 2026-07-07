#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="${BUILD_DIR:-$ROOT/cmake-build-emscripten}"

emcmake cmake -S "$ROOT" -B "$BUILD_DIR"
cmake --build "$BUILD_DIR"
