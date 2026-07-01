#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# examples/A/s1/build.sh -- builds target A (Asyncify + JS EH emulation) scenario S1.
# Flags mirror design.md §2.1 row A.

emcc \
  -std=c++17 \
  -O1 \
  -sASYNCIFY=1 \
  -sASYNCIFY_IMPORTS=['jsAwaitControlledPromise'] \
  -sDISABLE_EXCEPTION_CATCHING=0 \
  -sMODULARIZE=1 \
  -sEXPORT_NAME=createModule \
  -sEXPORTED_FUNCTIONS=['_main'] \
  -sEXPORTED_RUNTIME_METHODS=['HEAP8'] \
  -sALLOW_MEMORY_GROWTH=1 \
  -I ../../../src \
  ../../../src/runtime_helpers.cpp \
  ../../../src/scenarios/S1.cpp \
  -o build/main.js

cp ../../../src/page_template.html build/index.html
echo "built: $(pwd)/build/main.js"