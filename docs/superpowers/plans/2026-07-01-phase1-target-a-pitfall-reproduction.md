# Phase 1 — Target A Pitfall Reproduction (S2/S3/S4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reproduce the three Asyncify × JS-exception-handling conflicts hypothesized in `docs/design.md` §1.2 by running scenarios S2/S3/S4 on target A (Asyncify + default JS exception emulation), capturing exactly what breaks (catch miss, uncaught rethrow, double-suspend corruption, or `unreachable` trap), and recording each observation in `docs/matrix.md`'s row A.

**Architecture:** Each scenario calls `await_controlled_promise(id)` (now upgraded to `EM_ASYNC_JS` so Emscripten's Asyncify handler suspends the Wasm frame on the returned Promise). The Playwright spec uses `page.evaluate` to drive `window.__Controlled.resolve(id)` / `.reject(id, err)` at deterministic points, then asserts the resulting console sequence. Where the catch is missed or the Asyncify state corrupts, the scenario logs `FAIL:<reason>` to make the failure legible; the spec asserts the actual lines, whatever they are.

**Tech Stack:** Emscripten 6.0.1 (emsdk pinned), `@playwright/test` against stable Chrome (channel `'chrome'`).

## Global Constraints

- All paths relative to repo root `/Users/seungha/dev/learn-asyncify`.
- emsdk env must be active before invoking `emcc`: `source ./emsdk/emsdk_env.sh`.
- Every build script hardcodes `-sASYNCIFY=1 -sASYNCIFY_IMPORTS=['jsAwaitControlledPromise'] -sDISABLE_EXCEPTION_CATCHING=0 -sEXPORT_ES6=1 -sMODULARIZE=1 -sEXPORT_NAME=createModule -sEXPORTED_FUNCTIONS=['_main'] -sEXPORTED_RUNTIME_METHODS=['HEAP8'] -sALLOW_MEMORY_GROWTH=1 -std=c++17 -O1 -I ../../../src`.
- Test harness protocol: Wasm emits `console.log` lines of form `PASS:<id>`, `FAIL:<id>`, or unprefixed descriptive strings. Specs filter `msg.type() === 'log'` to discard favicon/source-map noise.
- All new example directories copy `src/page_template.html` and `src/test_harness.js` into `build/` (page_template references them via relative `./`).
- Commit after every task. Conventional commit messages, lowercase verb (`scenario:`, `test:`, `docs:`, `chore:`).

## File Structure

| Path | Purpose |
|---|---|
| `src/runtime_helpers.h` | forward-declare `await_controlled_promise` (no signature change) |
| `src/runtime_helpers.cpp` | replace `EM_JS` with `EM_ASYNC_JS` for the await import; return the harness Promise so Asyncify suspends |
| `src/scenarios/S2.cpp` | new — suspend→resolve→throw; tests catch-after-resume |
| `src/scenarios/S3.cpp` | new — suspend→reject so the import itself rejects; tests catch-via-reject |
| `src/scenarios/S4.cpp` | new — suspend→catch→second suspend→resume; tests double-suspend inside catch |
| `examples/A/s2/{build.sh,run.sh,EXPECT.md}` | new — build/run/expectation for A/S2 |
| `examples/A/s3/{build.sh,run.sh,EXPECT.md}` | new — build/run/expectation for A/S3 |
| `examples/A/s4/{build.sh,run.sh,EXPECT.md}` | new — build/run/expectation for A/S4 |
| `tests/A/s2.spec.ts` | new — Playwright spec for A/S2 |
| `tests/A/s3.spec.ts` | new — Playwright spec for A/S3 |
| `tests/A/s4.spec.ts` | new — Playwright spec for A/S4 |
| `docs/matrix.md` | edit — fill row A × columns S2/S3/S4 with what was observed |
| `docs/findings.md` | new — generalizing why each pitfall manifested (which of the §1.2 three conflicts each scenario hit) |

## Scenario ↔ Promise contract

All three scenarios reuse the same `await_controlled_promise(id)` call. The harness's controlled-promise registry holds one entry per id; resolving/rejecting it from JS unpauses the suspended Wasm frame.

| Scenario | Promise id | Wasm-side sequence | JS-side action |
|---|---|---|---|
| S2 | `"s2-1"` | `await_controlled_promise("s2-1")` then `throw std::runtime_error("S2");` (inside main's try) | spec calls `__Controlled.resolve("s2-1")` after page settled |
| S3 | `"s3-1"` | `await_controlled_promise("s3-1")` (throw lives on the JS side via reject) | spec calls `__Controlled.reject("s3-1", new Error("S3"))` |
| S4 | `"s4-1"`, `"s4-2"` | try → await `s4-1` → catch → await `s4-2` → finish | spec resolves `s4-1`, then `s4-2` (rejects `s4-1` so the first catch fires) |

---

## Task 1: Upgrade `await_controlled_promise` to EM_ASYNC_JS (harness works for real suspend)

**Files:**
- Modify: `src/runtime_helpers.cpp`

**Interfaces:**
- Consumes: `window.__Controlled.register(id) -> Promise<void>` from `src/test_harness.js` (already in place from the previous plan).
- Produces: `void await_controlled_promise(const char* id)` whose JS side returns the harness Promise so Emscripten's Asyncify `Asyncify.handleAsync` wrapper suspends the Wasm frame waiting for it.

**Why this needs changing:** the current `EM_JS` returns `void` and JS-side never returns a Promise. For Asyncify instrumentation to work, the import must return a Promise that Emscripten can `await`; `EM_ASYNC_JS` declares such an import and is auto-listed under `ASYNCIFY_IMPORTS`.

- [ ] **Step 1: Replace the EM_JS thunk with EM_ASYNC_JS**

Open `src/runtime_helpers.cpp` and replace the entire `EM_JS(void, js_await_controlled_promise, …)` block with:

```cpp
EM_ASYNC_JS(void, js_await_controlled_promise, (const char* ptr, int len), {
  const id = new TextDecoder().decode(new Uint8Array(HEAP8.buffer, ptr, len));
  await window.__Controlled.register(id);
});
```

- [ ] **Step 2: Verify S1 still builds and passes (regression check)**

```bash
source ./emsdk/emsdk_env.sh
./examples/A/s1/build.sh
npx playwright test A/s1
```
Expected: `1 passed`.

- [ ] **Step 3: Commit**

```bash
git add src/runtime_helpers.cpp
git commit -m "harness: switch await_controlled_promise to EM_ASYNC_JS for real suspend"
```

---

## Task 2: S2 scenario — suspend then throw

**Files:**
- Create: `src/scenarios/S2.cpp`

**Interfaces:**
- Consumes: `scenario_log(const char*)` and `await_controlled_promise(const char*)` from `src/runtime_helpers.h`.
- Produces: `_main()` that prints `S2:before-suspend`, suspends on `"s2-1"`, then logs `S2:after-resume`, then throws, then (if catch is reached) prints `PASS:s2-catch-reached` and finally `PASS:s2-done`.

- [ ] **Step 1: Write `src/scenarios/S2.cpp`**

```cpp
#include "runtime_helpers.h"
#include <stdexcept>

int main() {
  try {
    scenario_log("S2:before-suspend");
    await_controlled_promise("s2-1");
    scenario_log("S2:after-resume");          // only printed if resume succeeded
    throw std::runtime_error("S2");
    scenario_log("FAIL:s2-after-throw-unreachable");
  } catch (const std::exception& e) {
    scenario_log("PASS:s2-catch-reached");
    scenario_log(e.what());                    // prints "S2"
  }
  scenario_log("PASS:s2-done");
  return 0;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/scenarios/S2.cpp
git commit -m "scenarios: add S2 (suspend then throw)"
```

---

## Task 3: A/S2 build, run script, expectation

**Files:**
- Create: `examples/A/s2/build.sh`
- Create: `examples/A/s2/run.sh`
- Create: `examples/A/s2/EXPECT.md`

**Interfaces:**
- Consumes: `src/scenarios/S2.cpp`, `src/runtime_helpers.{h,cpp}`, emsdk env.

- [ ] **Step 1: Write `examples/A/s2/build.sh`**

```sh
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p build

emcc \
  -std=c++17 \
  -O1 \
  -sASYNCIFY=1 \
  -sASYNCIFY_IMPORTS=['jsAwaitControlledPromise'] \
  -sDISABLE_EXCEPTION_CATCHING=0 \
  -sMODULARIZE=1 \
  -sEXPORT_NAME=createModule \
  -sEXPORT_ES6=1 \
  -sEXPORTED_FUNCTIONS=['_main'] \
  -sEXPORTED_RUNTIME_METHODS=['HEAP8'] \
  -sALLOW_MEMORY_GROWTH=1 \
  -I ../../../src \
  ../../../src/runtime_helpers.cpp \
  ../../../src/scenarios/S2.cpp \
  -o build/main.js

cp ../../../src/page_template.html build/index.html
cp ../../../src/test_harness.js   build/test_harness.js
echo "built: $(pwd)/build/main.js"
```

- [ ] **Step 2: chmod +x and write `run.sh`**

```sh
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
./build.sh
cd ../../..
npx playwright test A/s2
```

Run: `chmod +x examples/A/s2/build.sh examples/A/s2/run.sh`

- [ ] **Step 3: Write `examples/A/s2/EXPECT.md`**

This is the **pre-recording** of the *expected* outcome *only if* the §1.2 pitfall hypothesis mechanism conflicts do NOT manifest (i.e. the "happy path"). The actual observed outcome will overwrite this expectation in `docs/matrix.md` once Task 4 runs.

```markdown
# A / S2 — expectation

Target A = Asyncify instrumentation + JS exception emulation; scenario S2 =
suspend on a controlled Promise, then after resume throw inside main's try
block, with the catch-of-main expectation.

## If Asyncify × JS EH do not conflict (ideal/happy path)

Console (in order):
1. `S2:before-suspend`
2. `S2:after-resume`
3. `PASS:s2-catch-reached`
4. `S2`
5. `PASS:s2-done`

## Hypothesis under test (design.md §1.2 conflict #2 + #3)

On Asyncify resume, the in-flight Wasm frame is reconstructed from the
save buffer; the JS exception emulation's "threw flag" propagation traverses
the *reconstructed* return path. We expect either:
- the catch is missed and the throw escapes to JS (`uncaught`); or
- the `unreachable` trap fires on re-entering the suspended frame while
  exception state still has `threw=true`; or
- the program hangs (Asyncify state never unwinds past the catch).

The spec records whatever actually happens so `docs/matrix.md` can document
the exact failure.
```

- [ ] **Step 4: Build once to verify the flags compile**

Run: `source ./emsdk/emsdk_env.sh && ./examples/A/s2/build.sh`
Expected: ends with `built: .../examples/A/s2/build/main.js` and exit 0.

- [ ] **Step 5: Commit**

```bash
git add examples/A/s2/build.sh examples/A/s2/run.sh examples/A/s2/EXPECT.md
git commit -m "examples: add A/S2 build/run/expectation"
```

---

## Task 4: A/S2 Playwright spec — drive Promise, capture actual behavior

**Files:**
- Create: `tests/A/s2.spec.ts`

**Interfaces:**
- Consumes: served page at `http://localhost:8080/examples/A/s2/build/index.html`, `window.__Controlled.resolve("s2-1")`.

- [ ] **Step 1: Write `tests/A/s2.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';

test('A/S2: suspend then throw — observed console sequence', async ({ page }) => {
  const lines: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'log') lines.push(msg.text());
  });

  await page.goto('http://localhost:8080/examples/A/s2/build/index.html');
  // Wasm suspends at await_controlled_promise("s2-1"). Give it a moment to
  // print the "before-suspend" line and reach the suspend point.
  await page.waitForFunction(
    () => (window as any).__logLines?.includes('S2:before-suspend'),
    null,
    { timeout: 10_000 }
  );
  // Let the Wasm frame actually suspend first (Asyncify yields back to JS).
  await page.waitForTimeout(50);
  // Drive the Promise resolution; this unpauses Wasm.
  await page.evaluate(() => (window as any).__Controlled.resolve('s2-1'));
  // Wait for either the "done" sentinel or an uncaught JS page error.
  await Promise.race([
    page.waitForFunction(
      () => (window as any).__logLines?.includes('PASS:s2-done'),
      null,
      { timeout: 10_000 }
    ),
    page.waitForEvent('pageerror', { timeout: 10_000 }).then((e) => {
      lines.push(`[pageerror] ${e.message}`);
    }),
    page.waitForTimeout(10_000).then(() => lines.push('[timeout] no s2-done')),
  ]);

  // Snapshot for matrix.md. We do NOT assert an exact sequence here because
  // this scenario is exactly where we expect a pitfall to manifest; the
  // matrix will record whatever this turns out to be.
  expect(lines.length).toBeGreaterThan(0);
  // Persist as a fixture for findings to cite verbatim.
  expect(lines.join('\n')).toMatchSnapshot('A-S2-console.txt');
});
```

> `toMatchSnapshot` writes the first run's output as the baseline; subsequent runs will surface any change. The directories Playwright uses for snapshot storage are auto-managed; we just need to make sure the snapshot file is committed.

- [ ] **Step 2: Append `.snapshot` storage consideration to `.gitignore`?**

Playwright stores raw snapshot files next to the spec as `.snapshots/` directories by default (older versions) or as `<specname>.spec.ts-snapshots/` (newer). We want these committed so the observation is reusable.

Make sure `.gitignore` does **not** exclude snapshots. Verify:

Run: `grep -i snapshot .gitignore || echo "none — good"`
Expected: `none — good`.

- [ ] **Step 3: Run the spec — first run creates the snapshot**

Run: `npx playwright test A/s2`
Expected: `1 passed`. First run writes `tests/A/s2.spec.ts-snapshots/A-S2-console.txt` (exact directory name may vary by Playwright version; check the file tree after running).

- [ ] **Step 4: Inspect the snapshot — record actual observation**

Run: `cat tests/A/s2.spec.ts-snapshots/*.txt`
Note the content. Copy the line-by-line content into `docs/matrix.md` cell `A × S2` and into `docs/findings.md` during Task 11.

- [ ] **Step 5: Commit**

```bash
git add tests/A/s2.spec.ts tests/A/s2.spec.ts-snapshots/
git commit -m "test: drive and snapshot A/S2 behavior"
```

---

## Task 5: S3 scenario — suspend that rejects

**Files:**
- Create: `src/scenarios/S3.cpp`

**Interfaces:**
- Consumes: `await_controlled_promise(const char*)`; JS side rejects the underlying Promise so the `EM_ASYNC_JS` import rethrows in C++.
- Produces: `_main()` whose try block logs `S3:before-suspend`, awaits `"s3-1"`, and (if caught) logs `PASS:s3-catch-reached`; if the await reraises as a JS exception, the catch block may not be reached.

- [ ] **Step 1: Write `src/scenarios/S3.cpp`**

```cpp
#include "runtime_helpers.h"
#include <stdexcept>

int main() {
  try {
    scenario_log("S3:before-suspend");
    await_controlled_promise("s3-1");
    // If control returns here it means the rejected Promise was NOT propagated
    // as a throw on resume — itself an observation worth logging.
    scenario_log("FAIL:s3-after-resume-non-throw");
  } catch (const std::exception& e) {
    scenario_log("PASS:s3-catch-reached");
    scenario_log(e.what());
  } catch (...) {
    scenario_log("PASS:s3-catch-reached-ellipsis");
  }
  scenario_log("PASS:s3-done");
  return 0;
}
```

> We do **not** use `throw std::runtime_error` from C++ here; per design.md S3 the throw is *initiated on the JS side* by `__Controlled.reject("s3-1", new Error("S3"))`. The `EM_ASYNC_JS` await will rethrow the JS exception into the Wasm frame on resume. Whether the resulting thing lands in the `catch(const std::exception&)` branch is exactly what the test observes.

- [ ] **Step 2: Commit**

```bash
git add src/scenarios/S3.cpp
git commit -m "scenarios: add S3 (suspend that rejects)"
```

---

## Task 6: A/S3 build, run, expectation

**Files:**
- Create: `examples/A/s3/build.sh`
- Create: `examples/A/s3/run.sh`
- Create: `examples/A/s3/EXPECT.md`

- [ ] **Step 1: Write `examples/A/s3/build.sh`** (same as S2 except source path and scenario)

```sh
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p build

emcc \
  -std=c++17 \
  -O1 \
  -sASYNCIFY=1 \
  -sASYNCIFY_IMPORTS=['jsAwaitControlledPromise'] \
  -sDISABLE_EXCEPTION_CATCHING=0 \
  -sMODULARIZE=1 \
  -sEXPORT_NAME=createModule \
  -sEXPORT_ES6=1 \
  -sEXPORTED_FUNCTIONS=['_main'] \
  -sEXPORTED_RUNTIME_METHODS=['HEAP8'] \
  -sALLOW_MEMORY_GROWTH=1 \
  -I ../../../src \
  ../../../src/runtime_helpers.cpp \
  ../../../src/scenarios/S3.cpp \
  -o build/main.js

cp ../../../src/page_template.html build/index.html
cp ../../../src/test_harness.js   build/test_harness.js
echo "built: $(pwd)/build/main.js"
```

- [ ] **Step 2: Write `examples/A/s3/run.sh`**

```sh
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
./build.sh
cd ../../..
npx playwright test A/s3
```

Run: `chmod +x examples/A/s3/build.sh examples/A/s3/run.sh`

- [ ] **Step 3: Write `examples/A/s3/EXPECT.md`**

```markdown
# A / S3 — expectation

Target A = Asyncify + JS exception emulation; scenario S3 = the suspending
Promise is *rejected* on the JS side, so the Wasm resume path must rethrow
into the suspended Wasm frame.

## Hypothesis under test (design.md §1.2 conflicts #1 + #3)

- JS exception emulation writes "threw=true" into the global. When the
  Asyncify instrumentation tries to *resume* the saved Wasm frame, the
  interceptor wants to load PC/locals from the buffer and re-enter Wasm at
  the suspend-resume point — but the threw-flag means the runtime wants to
  propagate upwards via the *caller's* return path instead. These two
  "where do I return to" assertions collide.
- Candidate observed outcomes:
  - `unreachable` trap during resume (`abort: unreachable`);
  - the catch is missed entirely and a JS `Error("S3")` arrives in
    `pageerror`;
  - the Wasm frame prints `S3:before-suspend` only and then hangs;
  - or — pathological — the `PASS:s3-after-resume-non-throw` path fires
    (the rejection was silently swallowed by Asyncify resume), showing
    the exception was lost.

## What this scenario does NOT expect

A clean catch of `Error("S3")` by `catch(const std::exception&)`. JS Errors
do not derive from `std::exception`; if any catch fires, expect the
ellipsis branch `PASS:s3-catch-reached-ellipsis`.
```

- [ ] **Step 4: Build to verify flags compile**

Run: `source ./emsdk/emsdk_env.sh && ./examples/A/s3/build.sh`
Expected: ends with `built: ...` and exit 0.

- [ ] **Step 5: Commit**

```bash
git add examples/A/s3/build.sh examples/A/s3/run.sh examples/A/s3/EXPECT.md
git commit -m "examples: add A/S3 build/run/expectation"
```

---

## Task 7: A/S3 Playwright spec

**Files:**
- Create: `tests/A/s3.spec.ts`

- [ ] **Step 1: Write `tests/A/s3.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';

test('A/S3: suspended Promise rejects — observed console sequence', async ({ page }) => {
  const lines: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'log') lines.push(msg.text());
  });

  await page.goto('http://localhost:8080/examples/A/s3/build/index.html');
  await page.waitForFunction(
    () => (window as any).__logLines?.includes('S3:before-suspend'),
    null,
    { timeout: 10_000 }
  );
  await page.waitForTimeout(50);
  await page.evaluate(() => (window as any).__Controlled.reject('s3-1', new Error('S3')));
  await Promise.race([
    page.waitForFunction(
      () => (window as any).__logLines?.includes('PASS:s3-done') ||
             (window as any).__logLines?.includes('PASS:s3-catch-reached-ellipsis'),
      null,
      { timeout: 10_000 }
    ),
    page.waitForEvent('pageerror', { timeout: 10_000 }).then((e) => {
      lines.push(`[pageerror] ${e.message}`);
    }),
    page.waitForTimeout(10_000).then(() => lines.push('[timeout] no s3-done')),
  ]);

  expect(lines.length).toBeGreaterThan(0);
  expect(lines.join('\n')).toMatchSnapshot('A-S3-console.txt');
});
```

- [ ] **Step 2: Run the spec**

Run: `npx playwright test A/s3`
Expected: `1 passed`. First run writes `tests/A/s3.spec.ts-snapshots/A-S3-console.txt`.

- [ ] **Step 3: Inspect the snapshot**

Run: `cat tests/A/s3.spec.ts-snapshots/*.txt`

- [ ] **Step 4: Commit**

```bash
git add tests/A/s3.spec.ts tests/A/s3.spec.ts-snapshots/
git commit -m "test: drive and snapshot A/S3 behavior"
```

---

## Task 8: S4 scenario — catch then re-suspend

**Files:**
- Create: `src/scenarios/S4.cpp`

**Interfaces:**
- Consumes: `await_controlled_promise(const char*)` twice — first time the Promise will reject (so the catch fires), second time the Promise will resolve so execution proceeds normally to the end.

- [ ] **Step 1: Write `src/scenarios/S4.cpp`**

```cpp
#include "runtime_helpers.h"
#include <stdexcept>

int main() {
  try {
    scenario_log("S4:before-suspend");
    await_controlled_promise("s4-1");           // will be rejected
    scenario_log("FAIL:s4-after-resume-not-thrown");
  } catch (const std::exception& e) {
    scenario_log("PASS:s4-catch-reached");
    scenario_log(e.what());
    // Re-suspend from inside the catch handler — does Asyncify's state
    // machine tolerate a second suspend-point share the same catch frame?
    await_controlled_promise("s4-2");
    scenario_log("PASS:s4-after-second-resume");
  }
  scenario_log("PASS:s4-done");
  return 0;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/scenarios/S4.cpp
git commit -m "scenarios: add S4 (catch then re-suspend)"
```

---

## Task 9: A/S4 build, run, expectation

**Files:**
- Create: `examples/A/s4/build.sh`
- Create: `examples/A/s4/run.sh`
- Create: `examples/A/s4/EXPECT.md`

- [ ] **Step 1: Write `examples/A/s4/build.sh`** (same template)

```sh
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p build

emcc \
  -std=c++17 \
  -O1 \
  -sASYNCIFY=1 \
  -sASYNCIFY_IMPORTS=['jsAwaitControlledPromise'] \
  -sDISABLE_EXCEPTION_CATCHING=0 \
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
```

- [ ] **Step 2: Write `examples/A/s4/run.sh` and chmod**

```sh
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
./build.sh
cd ../../..
npx playwright test A/s4
```

Run: `chmod +x examples/A/s4/build.sh examples/A/s4/run.sh`

- [ ] **Step 3: Write `examples/A/s4/EXPECT.md`**

```markdown
# A / S4 — expectation

Target A = Asyncify + JS exception emulation; S4 = the catch handler
*itself* contains a second suspend point.

## Hypothesis under test (design.md §1.2 conflict #2)

Asyncify's resume state machine expects to restore the frame so execution
continues immediately after the await — but when an exception unwind
restored the frame to the catch-block entry, the "where do I go next"
table has two equally valid targets:

- "just past `await_controlled_promise("s4-1")`" (Asyncify resume),
- "into the catch handler body" (exception unwind).

We expect either:
- the second suspend never completes (`FAIL:s4-after-resume-not-thrown`
  appears, or `uncaught`);
- the catch fires but the second `await_controlled_promise("s4-2")`
  crashes or traps because Asyncify's state was not properly reset
  after the catch unwind;
- in the worst case a "double unwind" causes a `unreachable` trap.

## Happy-path sequence (NOT expected)

1. `S4:before-suspend`
2. `PASS:s4-catch-reached`, some exception text, `PASS:s4-after-second-resume`, `PASS:s4-done`
```

- [ ] **Step 4: Build to verify flags**

Run: `source ./emsdk/emsdk_env.sh && ./examples/A/s4/build.sh`
Expected: ends with `built: ...` and exit 0.

- [ ] **Step 5: Commit**

```bash
git add examples/A/s4/build.sh examples/A/s4/run.sh examples/A/s4/EXPECT.md
git commit -m "examples: add A/S4 build/run/expectation"
```

---

## Task 10: A/S4 Playwright spec

**Files:**
- Create: `tests/A/s4.spec.ts`

- [ ] **Step 1: Write `tests/A/s4.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';

test('A/S4: catch then re-suspend — observed console sequence', async ({ page }) => {
  const lines: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'log') lines.push(msg.text());
  });

  await page.goto('http://localhost:8080/examples/A/s4/build/index.html');
  await page.waitForFunction(
    () => (window as any).__logLines?.includes('S4:before-suspend'),
    null,
    { timeout: 10_000 }
  );
  await page.waitForTimeout(50);

  // First the suspended s4-1 is rejected — this should drive control into
  // the catch handler.
  await page.evaluate(() => (window as any).__Controlled.reject('s4-1', new Error('S4')));
  await page.waitForFunction(
    () => (window as any).__logLines?.includes('PASS:s4-catch-reached'),
    null,
    { timeout: 10_000 }
  ).catch(() => {/* if catch isn't reached, the snapshot will show it */});

  // Drive the second await, if the catch handler ever reaches it.
  await page.evaluate(() => (window as any).__Controlled.resolve('s4-2'));

  await Promise.race([
    page.waitForFunction(
      () => (window as any).__logLines?.includes('PASS:s4-done'),
      null,
      { timeout: 10_000 }
    ),
    page.waitForEvent('pageerror', { timeout: 10_000 }).then((e) => {
      lines.push(`[pageerror] ${e.message}`);
    }),
    page.waitForTimeout(10_000).then(() => lines.push('[timeout] no s4-done')),
  ]);

  expect(lines.length).toBeGreaterThan(0);
  expect(lines.join('\n')).toMatchSnapshot('A-S4-console.txt');
});
```

- [ ] **Step 2: Run the spec**

Run: `npx playwright test A/s4`
Expected: `1 passed`. First run writes `tests/A/s4.spec.ts-snapshots/A-S4-console.txt`.

- [ ] **Step 3: Inspect the snapshot**

Run: `cat tests/A/s4.spec.ts-snapshots/*.txt`

- [ ] **Step 4: Commit**

```bash
git add tests/A/s4.spec.ts tests/A/s4.spec.ts-snapshots/
git commit -m "test: drive and snapshot A/S4 behavior"
```

---

## Task 11: Record observations in `docs/matrix.md` and `docs/findings.md`

**Files:**
- Modify: `docs/matrix.md`
- Create: `docs/findings.md`

**Interfaces:**
- Consumes: contents of `tests/A/s2.spec.ts-snapshots/A-S2-console.txt`, `tests/A/s3.spec.ts-snapshots/A-S3-console.txt`, `tests/A/s4.spec.ts-snapshots/A-S4-console.txt` (path names may vary slightly — check actual paths with `find tests -name 'A-S*-console.txt'`).
- Produces: filled cells `A×S2`, `A×S3`, `A×S4` in `docs/matrix.md`; `docs/findings.md` with one section per scenario explaining which of the three §1.2 conflicts the observed failure maps to (or "happy path — conflict did not manifest" if so).

- [ ] **Step 1: Read the three snapshots**

Run: `find tests -name 'A-S*-console.txt' -print -exec cat {} \;`

Copy each into the corresponding matrix cell (Task 11 Step 2) and the findings section (Task 11 Step 3). Keep them verbatim.

- [ ] **Step 2: Update `docs/matrix.md` row A**

Edit `docs/matrix.md`. Replace the three `—` cells in row A with `[obs](path-to-snapshot)` links and a one-line summary of what was actually printed. The exact phrasing depends on the snapshots, so do this literally:

For S2: cell becomes `[obs](../tests/A/s2.spec.ts-snapshots/A-S2-console.txt)` followed by the observed sequence on the same line, in backticks — e.g. `` `S2:before-suspend → …` ``.

For S3 and S4: same pattern with their snapshot paths.

If a scenario produced a `[pageerror] …` line or `[timeout] …` line, that is part of the observation — include it.

- [ ] **Step 3: Write `docs/findings.md`**

```markdown
# Findings — Phase 1 (target A pitfall reproduction)

This file is updated as each phase's observations are recorded. Phase 1
covers the Asyncify + JS exception emulation path (target A). References
to design.md §1.2 below are to the three conflicts hypothesized there.

## A / S2 — suspend then throw

Observed:
```
<paste the A-S2-console.txt content verbatim here>
```

Mapping to §1.2 conflicts:
- #N (which one — #1, #2, or #3, or "none"): <one sentence on why>

## A / S3 — suspend that rejects

Observed:
```
<paste A-S3-console.txt content here>
```

Mapping:
- ...

## A / S4 — catch then re-suspend

Observed:
```
<paste A-S4-console.txt content here>
```

Mapping:
- ...

## Cross-scenario summary

<2-4 sentences on what target A's pitfall landscape looks like: which
of the three hypothesized conflicts actually reproduced, which did not,
and any unexpected behaviors outside the original three.>
```

Fill the placeholders with actual content from the snapshots, naming the design.md §1.2 conflicts explicitly.

- [ ] **Step 4: Commit**

```bash
git add docs/matrix.md docs/findings.md
git commit -m "docs: record Phase 1 target A pitfall observations in matrix and findings"
```

---

## Task 12: Full-suite regression and DoD check

**Files:**
- (modifies nothing)

- [ ] **Step 1: Run every spec end to end**

Run:
```bash
source ./emsdk/emsdk_env.sh
npx playwright test
```
Expected: `4 passed` (`_features` runs 2 — JSPI + Wasm EH — plus A/s1, A/s2, A/s3, A/s4 = 6, but features counts as `2 passed` and the four scenarios as `4 passed`; the suite total is `6 passed`).

> Clarifying count: `_features.spec.ts` declares two `test(...)` blocks (Wasm EH probe, JSPI probe). Together with `A/s1`, `A/s2`, `A/s3`, `A/s4` (one test each), the total is six. Expected output: `6 passed`.

- [ ] **Step 2: Definition of Done (design.md §8) check against Phase 1**

The DoD item "`target A`'s S2/S3/S4 must reproduce at least one 'unexpected behavior (corruption / uncaught / hang)'" — was this satisfied? Confirm by looking at `docs/findings.md`: if any of the three scenarios produced `[pageerror]`, `[timeout]`, or a `FAIL:*` line in its snapshot, the DoD is met.

If **none** of S2/S3/S4 produced a pitfall (i.e. all three happily caught and finished), document that surprising *negative* finding in `docs/findings.md`'s cross-scenario summary — that itself is the research output. Otherwise leave the summary as already written.

- [ ] **Step 3: (No commit — verification only.)**

If any spec failed in Step 1, return to the responsible failing task and fix before claiming completion.

---

## Self-Review (run before handing off)

- **Spec coverage vs design.md:**
  - §2.4 decision #1 (controlled Promise) — Tasks 4, 7, 10 drive `__Controlled.resolve/reject` from `page.evaluate`. ✓
  - §2.4 decision #2 (caller-catch) — every S2/S3/S4 scenario's try/catch lives in `main`. ✓
  - §2.4 decision #3 (Playwright stable Chrome) — committed in earlier plan, unchanged here. ✓
  - §2.4 scenario-Promise mapping (S2: resolve then C++ throw; S3: reject; S4: reject first then resolve second) — Tasks 2, 5, 8 + spec Tasks 4, 7, 10. ✓
  - §1.2 hypothesis framing — `EXPECT.md` files explicitly label which conflict is hypothesized per scenario; `findings.md` records which reproduced. ✓
  - §5 Phase 1 ("S2/S3/S4 on target A … matrix.md A row …") — Tasks 11 and 12. ✓
  - §3 metric 1 (correctness) — snapshot assertions record exact line sequence + pageerror + timeout. ✓
  - §8 DoD — Task 12 Step 2 explicitly checks. ✓

- **Placeholder scan:** No "TBD" / "implement later". The `EXPECT.md` files label outcomes as hypotheses (which is the *point* of this phase). `docs/findings.md` instructs literal paste of snapshot content — not a placeholder, that is the task's data-gathering step.

- **Type consistency:**
  - `await_controlled_promise(const char*)` — declared in `runtime_helpers.h` (unchanged), re-implemented in `runtime_helpers.cpp` Task 1 via `EM_ASYNC_JS`. ✓
  - `jsAwaitControlledPromise` — referenced in `ASYNCIFY_IMPORTS` of every build script; matches the symbol Emscripten generates from `EM_ASYNC_JS(js_await_controlled_promise, …)` (snake → camel by Emscripten convention). ✓
  - Snapshot paths `tests/A/s2.spec.ts-snapshots/A-S2-console.txt` etc. — Playwright 1.45+ uses `<spec>.snapshots/` directory by default; if the installed version differs, the actual path may be `<spec>.spec.ts-snapshots/`. Task 11 Step 1 runs `find tests -name 'A-S*-console.txt'` to discover the exact path. ✓
  - `window.__Controlled.resolve/reject` signatures — match `src/test_harness.js` (already committed by previous plan). ✓

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-01-phase1-target-a-pitfall-reproduction.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?