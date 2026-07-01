#!/usr/bin/env bash
set -euo pipefail

# Pin the emsdk stable tag. Update this single line to upgrade the toolchain.
EMSDK_TAG="6.0.1"
EMSDK_DIR="${EMSDK_DIR:-$(pwd)/emsdk}"

if [ ! -d "$EMSDK_DIR/.git" ]; then
  git clone --depth 1 --branch "$EMSDK_TAG" https://github.com/emscripten-core/emsdk.git "$EMSDK_DIR"
fi

# shellcheck disable=SC1091
source "$EMSDK_DIR/emsdk_env.sh"
"$EMSDK_DIR/emsdk" install latest
"$EMSDK_DIR/emsdk" activate latest

emcc --version | head -1
echo "EMSDK_TAG=$EMSDK_TAG"
echo "EMCC=$(command -v emcc)"