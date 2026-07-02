# Metrics — Phase 3.5

This document records cost and error-surface evidence for the completed 6×4
correctness matrix. The numbers below are a sample run on 2026-07-02 with
stable Chrome through Playwright. Timing values are comparative signals, not
portable benchmark claims.

## Reproduction

```sh
source ./emsdk/emsdk_env.sh
for target in A B C D E Ep; do
  for scenario in s1 s2 s3 s4; do
    ./examples/$target/$scenario/build.sh
  done
done
scripts/collect-size-metrics.sh
npx playwright test tests/_metrics.spec.ts --workers=1
```

`Ep` is the filesystem-safe directory name for matrix target `E'`.

## Build Artifact Size

| Target | Scenario | main.wasm bytes | main.js bytes |
|---|---:|---:|---:|
| A | 1 | 26893 | 43705 |
| A | 2 | 27342 | 43764 |
| A | 3 | 21884 | 42838 |
| A | 4 | 21724 | 42675 |
| B | 1 | 34303 | 36824 |
| B | 2 | 34615 | 36883 |
| B | 3 | 28465 | 36806 |
| B | 4 | 28426 | 36806 |
| C | 1 | 17173 | 36103 |
| C | 2 | 17379 | 36214 |
| C | 3 | 7893 | 31881 |
| C | 4 | 7840 | 31718 |
| D | 1 | 19610 | 29202 |
| D | 2 | 19723 | 29313 |
| D | 3 | 10056 | 25761 |
| D | 4 | 10019 | 25761 |
| E | 1 | 21607 | 33129 |
| E | 2 | 23758 | 33340 |
| E | 3 | 23770 | 33085 |
| E | 4 | 23968 | 33085 |
| E' | 1 | 23952 | 26360 |
| E' | 2 | 25482 | 26408 |
| E' | 3 | 25509 | 26408 |
| E' | 4 | 25567 | 26408 |

Size interpretation:

- Asyncify rows A/B carry the largest combined artifact footprint in the
  suspend scenarios.
- JSPI rows C/D reduce JS glue and Wasm size substantially, but correctness
  still depends on the exception boundary behavior captured in
  `docs/matrix.md`.
- C++20 coroutine rows E/E' move work into developer-owned glue. E' has a
  larger Wasm file than D in these examples, but its generated JS is smaller
  than E because Wasm EH avoids JS exception-emulation support.

## Load-To-Completion Timing

| Target | Scenario | Elapsed ms | Outcome | Error surface |
|---|---:|---:|---|---|
| A | 1 | 41 | done | - |
| A | 2 | 48 | done | - |
| A | 3 | 2056 | observed failure/timeout | S3 |
| A | 4 | 4043 | observed failure/timeout | S4 |
| B | 1 | 42 | done | - |
| B | 2 | 46 | done | - |
| B | 3 | 2041 | observed failure/timeout | S3 |
| B | 4 | 4053 | observed failure/timeout | S4 |
| C | 1 | 2028 | observed failure/timeout | trying to suspend JS frames |
| C | 2 | 2040 | observed failure/timeout | trying to suspend JS frames |
| C | 3 | 2043 | observed failure/timeout | trying to suspend JS frames |
| C | 4 | 4041 | observed failure/timeout | trying to suspend JS frames |
| D | 1 | 32 | done | - |
| D | 2 | 38 | done | - |
| D | 3 | 2038 | observed failure/timeout | S3 |
| D | 4 | 4039 | observed failure/timeout | S4 |
| E | 1 | 39 | done | - |
| E | 2 | 44 | done | - |
| E | 3 | 38 | done | - |
| E | 4 | 44 | done | - |
| E' | 1 | 37 | done | - |
| E' | 2 | 37 | done | - |
| E' | 3 | 36 | done | - |
| E' | 4 | 37 | done | - |

Timing interpretation:

- Failure rows take roughly the configured observation timeout. These numbers
  measure the test-visible failure surface, not runtime slowness.
- Passing rows complete in tens of milliseconds in this harness. The C++20
  coroutine rows E/E' avoid the long timeout path for S3/S4 because rejected
  settlement is converted into C++ control flow by `await_resume()`.

## Representative Error Surfaces

| Case | Stable leading surface | Class |
|---|---|---|
| A/S3 | `S3` | rejected async operation escapes as page error |
| C/S1 | `trying to suspend JS frames` | JSPI cannot suspend through this JS frame shape |
| D/S3 | `S3` | rejected JS Promise still does not become C++ catchable |
| D/S4 | `S4` | first rejected await escapes before second await can be driven |

The exact browser stack trace is intentionally not recorded here; only the
stable leading message and class are used for comparison.
