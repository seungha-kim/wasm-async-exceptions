# CMake Build Design

## Goal

Make CMake the source of truth for building all 24 experiment examples while keeping the current test and demo paths stable.

The existing output contract must remain unchanged:

- `examples/<target>/<scenario>/build/main.js`
- `examples/<target>/<scenario>/build/main.wasm`
- `examples/<target>/<scenario>/build/index.html`
- harness files copied into the same `build/` directory

This preserves all current Playwright URLs and manual demo URLs.

## Current State

Each example owns a handwritten `build.sh` that directly invokes `emcc`. There are 24 scripts across:

- targets: `A`, `B`, `C`, `D`, `E`, `Ep`
- scenarios: `s1`, `s2`, `s3`, `s4`

`scripts/build-all-examples.sh` loops over those scripts. `npm test` runs that script, then `playwright test --workers=1`.

The downside is that target flags, source selection, output settings, and asset-copy rules are duplicated across many files.

## Proposed Architecture

Add a root `CMakeLists.txt` that defines the full target/scenario matrix.

CMake will create one executable per example, with logical target names like:

- `example_A_s1`
- `example_D_s4`
- `example_Ep_s3`

Each executable writes to the existing per-example output directory by setting the target output name and runtime output directory to:

```text
examples/<target>/<scenario>/build/main.js
```

The top-level CMake file will provide helper functions for:

- selecting scenario source files
- selecting target-specific runtime helpers
- applying common Emscripten output flags
- applying target-specific Asyncify/JSPI/EH flags
- copying the right HTML and harness assets after build

## Target Rules

Targets `A` through `D` use the C++17 scenario sources:

- common source: `src/runtime_helpers.cpp`
- scenario source: `src/scenarios/S<n>.cpp`
- HTML template: `src/page_template.html` for `A` and `B`
- HTML template: `src/page_template_jspi.html` for `C` and `D`
- harness: `src/test_harness.js`

Target-specific flags:

| Target | C++ | Coroutine Mechanism | Exception Mechanism | Key Flags |
|---|---|---|---|---|
| A | C++17 | Asyncify | JS EH emulation | `-sASYNCIFY=1`, `-sDISABLE_EXCEPTION_CATCHING=0` |
| B | C++17 | Asyncify | Wasm EH | `-sASYNCIFY=1`, `-fwasm-exceptions` |
| C | C++17 | JSPI | JS EH emulation | `-sASYNCIFY=2`, `-sDISABLE_EXCEPTION_CATCHING=0` |
| D | C++17 | JSPI | Wasm EH | `-sASYNCIFY=2`, `-fwasm-exceptions` |

Targets `E` and `Ep` use the C++20 coroutine sources:

- common source: `src/coro_glue.cpp`
- scenario source: `src/scenarios_coro/S<n>.cpp`
- HTML template: `src/page_template_coro.html`
- harness: `src/test_harness_coro.js`
- additional JS asset: `src/coro_glue.js`

Target-specific flags:

| Target | C++ | Coroutine Mechanism | Exception Mechanism | Key Flags |
|---|---|---|---|---|
| E | C++20 | C++20 coroutine | JS EH emulation | `-sDISABLE_EXCEPTION_CATCHING=0` |
| Ep | C++20 | C++20 coroutine | Wasm EH | `-fwasm-exceptions` |

## Common Emscripten Flags

All examples should keep the existing module shape:

- `-O1`
- `-sMODULARIZE=1`
- `-sEXPORT_NAME=createModule`
- `-sEXPORT_ES6=1`
- `-sEXPORTED_RUNTIME_METHODS=['HEAP8']`
- `-sALLOW_MEMORY_GROWTH=1`

Exported functions differ by family:

- `A` through `D`: `['_main']`
- `E` and `Ep`: `['_main','_coro_settle','_coro_resume']`

`A` through `D` also keep:

- `-sASYNCIFY_IMPORTS=['jsAwaitControlledPromise']`

## Script Compatibility

Keep existing entrypoints working, but make them wrappers around CMake:

- `scripts/build-all-examples.sh` configures and builds the full matrix through CMake.
- `examples/<target>/<scenario>/build.sh` configures through the root project and builds only that logical CMake target.
- `examples/<target>/<scenario>/run.sh` can continue calling local `./build.sh`, then the existing Playwright spec.

The default CMake build directory should be:

```text
cmake-build-emscripten
```

This directory should be ignored by git.

## Testing Contract

The existing Playwright tests must continue to work without URL changes.

Add or update repo contract tests so they verify:

- `package.json` still runs `npm run build:examples && playwright test --workers=1`
- `scripts/build-all-examples.sh` uses CMake, not direct per-example loops
- representative `examples/A/s3/build.sh` and `examples/Ep/s3/build.sh` invoke `cmake --build`
- `CMakeLists.txt` defines the expected matrix targets

## Verification

Implementation is complete only when these commands pass:

```sh
git diff --check
npm test
```

For the CMake migration itself, also verify at least one single-example wrapper:

```sh
(cd examples/A/s3 && ./run.sh)
```

## Out of Scope

- Changing Playwright test URLs.
- Changing experiment behavior or expected snapshots.
- Reworking metrics collection.
- Removing `run.sh` files.
- Introducing a non-Emscripten native build.
