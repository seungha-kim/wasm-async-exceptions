#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p build

emcc \
  -std=c++17 \
  -O1 \
  -sASYNCIFY=1 \
  -sASYNCIFY_IMPORTS=['jsAwaitControlledPromise'] \
  -fwasm-exceptions \
  -sMODULARIZE=1 \
  -sEXPORT_NAME=createModule \
  -sEXPORT_ES6=1 \
  -sEXPORTED_FUNCTIONS=['_main'] \
  -sEXPORTED_RUNTIME_METHODS=['HEAP8'] \
  -sALLOW_MEMORY_GROWTH=1 \
  -I ../../../src \
  ../../../src/runtime_helpers.cpp \
  ../../../src/scenarios/S4.cpp \
  -o build/main.js

cp ../../../src/page_template.html build/index.html
cp ../../../src/test_harness.js   build/test_harness.js
echo "built: $(pwd)/build/main.js"