#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p build

emcc \
  -std=c++20 \
  -O1 \
  -fwasm-exceptions \
  -sMODULARIZE=1 \
  -sEXPORT_NAME=createModule \
  -sEXPORT_ES6=1 \
  -sEXPORTED_FUNCTIONS=['_main','_coro_settle','_coro_resume'] \
  -sEXPORTED_RUNTIME_METHODS=['HEAP8'] \
  -sALLOW_MEMORY_GROWTH=1 \
  -I ../../../src \
  ../../../src/coro_glue.cpp \
  ../../../src/scenarios_coro/S3.cpp \
  -o build/main.js

cp ../../../src/page_template_coro.html build/index.html
cp ../../../src/test_harness_coro.js   build/test_harness_coro.js
cp ../../../src/coro_glue.js           build/coro_glue.js
echo "built: $(pwd)/build/main.js"
