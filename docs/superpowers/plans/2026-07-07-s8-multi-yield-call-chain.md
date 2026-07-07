# S8 Multi-Yield Call Chain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add S8 for targets A/B/D to observe whether an outer C++ catch can catch an inner C++ throw after a multi-level call chain has yielded several times.

**Architecture:** Follow the existing S5-S7 resolution-only stress pattern. Add one shared `src/scenarios/S8.cpp`, build it only for A/B/D, drive all controlled Promises by resolving them from Playwright, and document actual observed outcomes.

**Tech Stack:** C++17, Emscripten Asyncify/JSPI, CMake, Playwright snapshots, Markdown docs.

---

### Task 1: RED Test Skeleton

**Files:**
- Create: `tests/A/s8.spec.ts`
- Create: `tests/B/s8.spec.ts`
- Create: `tests/D/s8.spec.ts`

- [ ] **Step 1: Add S8 specs before production code**

```ts
import { test } from '@playwright/test';
import { runResolveOnlyScenario } from '../_resolve_scenarios';

test('A/S8: multi-yield call chain throws to outer catch — observed console sequence', async ({ page }) => {
  await runResolveOnlyScenario(
    page,
    'A',
    's8',
    [
      { waitForLog: 'S8:l1-before-suspend', resolveId: 's8-l1' },
      { waitForLog: 'S8:l2-before-suspend', resolveId: 's8-l2' },
      { waitForLog: 'S8:l3-before-suspend', resolveId: 's8-l3' },
    ],
    'PASS:s8-done',
    'A-S8-console.txt'
  );
});
```

Repeat with target/snapshot names `B`/`B-S8-console.txt` and
`D`/`D-S8-console.txt`.

- [ ] **Step 2: Verify RED**

Run:

```bash
npx playwright test A/s8 B/s8 D/s8 --workers=1
```

Expected: fail because the `examples/<target>/s8/build/index.html` pages do
not exist yet.

### Task 2: Minimal S8 Build Surface

**Files:**
- Create: `src/scenarios/S8.cpp`
- Modify: `CMakeLists.txt`
- Create: `examples/A/s8/build.sh`
- Create: `examples/A/s8/run.sh`
- Create: `examples/B/s8/build.sh`
- Create: `examples/B/s8/run.sh`
- Create: `examples/D/s8/build.sh`
- Create: `examples/D/s8/run.sh`

- [ ] **Step 1: Add shared S8 source**

```cpp
#include "runtime_helpers.h"
#include <stdexcept>

namespace {

void level3() {
  scenario_log("S8:l3-before-suspend");
  await_controlled_promise("s8-l3");
  scenario_log("S8:l3-after-resume");
  throw std::runtime_error("S8");
}

void level2() {
  scenario_log("S8:l2-before-suspend");
  await_controlled_promise("s8-l2");
  scenario_log("S8:l2-after-resume");
  level3();
}

void level1() {
  scenario_log("S8:l1-before-suspend");
  await_controlled_promise("s8-l1");
  scenario_log("S8:l1-after-resume");
  level2();
}

}  // namespace

int main() {
  try {
    level1();
  } catch (const std::exception& e) {
    scenario_log("PASS:s8-outer-catch-reached");
    scenario_log(e.what());
  }
  scenario_log("PASS:s8-done");
  return 0;
}
```

- [ ] **Step 2: Register A/B/D CMake targets**

Add:

```cmake
add_experiment_example(A s8)
add_experiment_example(B s8)
add_experiment_example(D s8)
```

next to the existing A/B/D stress scenario registrations.

- [ ] **Step 3: Add wrapper scripts**

Each `build.sh` should invoke the matching CMake target:

```sh
#!/usr/bin/env sh
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
BUILD_DIR="$ROOT_DIR/cmake-build-emscripten"

. "$ROOT_DIR/scripts/emsdk-env.sh"
emcmake cmake -S "$ROOT_DIR" -B "$BUILD_DIR" -DCMAKE_EXPORT_COMPILE_COMMANDS=ON
cmake --build "$BUILD_DIR" --target example_A_s8
```

Use `example_B_s8` and `example_D_s8` in the B/D wrappers.

Each `run.sh` should match existing examples:

```sh
#!/usr/bin/env sh
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT_DIR"
npx http-server . -p 8080 -c-1
```

- [ ] **Step 4: Verify GREEN enough to produce snapshots**

Run:

```bash
npx playwright test A/s8 B/s8 D/s8 --workers=1 --update-snapshots
```

Expected: specs run and create stable snapshots. A/D are expected to reach
`PASS:s8-done`; B may record the known Asyncify+Wasm-EH runtime failure
surface.

### Task 3: Expectations and Matrix Docs

**Files:**
- Create: `examples/A/s8/EXPECT.md`
- Create: `examples/B/s8/EXPECT.md`
- Create: `examples/D/s8/EXPECT.md`
- Modify: `docs/matrix.md`
- Modify: `docs/findings.md`
- Modify: `docs/design.md`
- Modify: `README.md`

- [ ] **Step 1: Record target expectations**

Write A/D as pass observations if their snapshots reach `PASS:s8-done`. Write
B as the exact observed failure if it exposes `[pageerror] null function`,
`[pageerror] unreachable`, or another runtime surface.

- [ ] **Step 2: Extend the resolution-only stress matrix**

Add an S8 column to the A/B/D stress table in `docs/matrix.md`.

- [ ] **Step 3: Update findings and overview docs**

Record S8 as a multi-yield call-chain extension of S5-S7. Preserve the core
claim: B failures are resolution-only C++ exception/suspend failures, not JS
Promise rejection failures.

### Task 4: Full Verification and Commit

**Files:**
- All files touched above

- [ ] **Step 1: Run targeted tests**

```bash
npx playwright test A/s8 B/s8 D/s8 --workers=1
```

Expected: 3 passed, including expected-failure snapshots.

- [ ] **Step 2: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/scenarios/S8.cpp CMakeLists.txt examples/A/s8 examples/B/s8 examples/D/s8 tests/A/s8.spec.ts tests/B/s8.spec.ts tests/D/s8.spec.ts docs README.md
git commit -m "test: add S8 multi-yield call chain stress"
```

## Self-Review

- Spec coverage: S8 A/B/D only, resolve-only, multi-level call chain, outer
  catch, expected-failure observation testing are all covered.
- Placeholder scan: no TBD/TODO placeholders.
- Type consistency: test IDs use `s8-l1`, `s8-l2`, `s8-l3`, matching the C++
  source.
