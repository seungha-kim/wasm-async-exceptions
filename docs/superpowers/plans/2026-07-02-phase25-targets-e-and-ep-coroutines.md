# Phase 2.5 — Targets E and E' C++20 Coroutine Fallback

## Goal

Complete the remaining coroutine fallback row in the experiment matrix:

- **E**: C++20 coroutine glue + JS exception emulation.
- **E'**: C++20 coroutine glue + Wasm EH.

The central question is whether removing Asyncify/JSPI from the coroutine axis avoids the suspend/resume exception-control-flow collisions observed in A-D, while still preserving C++ catch semantics through developer-owned coroutine glue.

## Implementation Plan

1. Add shared C++20 coroutine glue under `src/coro_glue.{h,cpp}` and JS resume/settlement helpers under `src/coro_glue.js`.
2. Add coroutine-specific scenarios under `src/scenarios_coro/S{1,2,3,4}.cpp`.
3. Add `examples/E/s{1,2,3,4}` and `examples/Ep/s{1,2,3,4}` build/run/expectation files.
   - `Ep` is the filesystem-safe directory name for matrix label `E'`.
4. Add Playwright specs and snapshots under `tests/E` and `tests/Ep`.
5. Update `docs/matrix.md`, `docs/findings.md`, and `README.md` with observed results.

## Expected Result

All E/E' scenarios should pass:

- S1 validates synchronous throw/catch still works.
- S2 validates a coroutine can resume after an async settlement and throw into a C++ catch.
- S3 validates rejected async settlement is converted into a C++ exception by `await_resume()`.
- S4 validates catch recovery can register and resume a second await.

If E and E' differ, record the EH-axis difference in `docs/findings.md`. If they match, record that the decisive repair is the explicit coroutine settlement protocol rather than the exception mechanism.

## Verification

Run:

```sh
source ./emsdk/emsdk_env.sh
npx playwright test --workers=1
```

The full suite should include A-D plus E/Ep tests and pass without relying on `test-results/` artifacts.
