# Phase 2 — Targets B and C partial-improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and observe target B (Asyncify + Wasm exception handling) and target C (JSPI + JS exception emulation) on all four scenarios S1–S4, capturing for each whether the A-row pitfall (catch missed on JS-initiated reject) is fixed by upgrading just *one* of the two emulation axes, and record the partial-improvement result in `docs/matrix.md` rows B and C and in `docs/findings.md`.

**Architecture:** The shared C++ scenario sources (`src/scenarios/S{1..4}.cpp`), the harness JS (`src/test_harness.js`), runtime helpers (now using `EM_ASYNC_JS`), and the page template are reused as-is. Each `examples/B/s<n>` directory only differs in the `emcc` flags; each `examples/C/s<n>` directory likewise. The Playwright specs are the same shape as the A-row specs but point at the new build product URLs and snapshot under new names. After all observations land, `docs/matrix.md` rows B and C are filled and `docs/findings.md` is extended with the partial-improvement analysis: which axis substitution fixes which of the §1.2 conflicts, and which one still leaves another conflict visible.

**Tech Stack:** Emscripten 6.0.1 (emsdk pinned at 6.0.1), `-fwasm-exceptions` for target B, `-sASYNCIFY=2` for target C, `@playwright/test` against stable Chrome.

## Global Constraints

- All paths relative to repo root `/Users/seungha/dev/learn-asyncify`.
- emsdk env must be active before invoking `emcc`: `source ./emsdk/emsdk_env.sh`.
- C++ scenario sources `src/scenarios/S{1..4}.cpp` shared by all targets A–D — do **not** edit them (unless the source-level smoke fails and an emergency fix is required; either way, fix the shared file only and rebuild every target so cross-target comparison stays meaningful).
- Test harness protocol unchanged: Wasm emits `PASS:<id>` / `FAIL:<id>` / descriptive `console.log`; specs filter `msg.type() === 'log'` and collect `pageerror` separately where the spec's scenario may throw to JS.
- Commit after every task. Conventional commit message prefixes: `examples:`, `test:`, `docs:`, `chore:`.
- Snapshot omission policy: first-run snapshot creation is expected; subsequent regressions surface real drift, so all snapshot files (`tests/<t>/<s>.spec.ts-snapshots/<name>-darwin.txt`) must be committed.

## File Structure

| Path | Purpose |
|---|---|
| `examples/B/s{1,2,3,4}/{build.sh,run.sh,EXPECT.md}` | new — target B build/run/expectation, S1–S4 |
| `examples/C/s{1,2,3,4}/{build.sh,run.sh,EXPECT.md}` | new — target C build/run/expectation, S1–S4 |
| `tests/B/s{1,2,3,4}.spec.ts` (+ `.spec.ts-snapshots/`) | new — Playwright specs and snapshots for B |
| `tests/C/s{1,2,3,4}.spec.ts` (+ `.spec.ts-snapshots/`) | new — Playwright specs and snapshots for C |
| `docs/matrix.md` | edit — fill rows B and C across S1–S4 |
| `docs/findings.md` | edit — append "Phase 2" section analysing partial improvement |

## Target-specific flag deltas (from design.md §2.1)

The shared flag kernel (call it `$SHARED_FLAGS`) is:

```text
-std=c++17 -O1 -sMODULARIZE=1 -sEXPORT_NAME=createModule -sEXPORT_ES6=1 \
-sEXPORTED_FUNCTIONS=['_main'] -sEXPORTED_RUNTIME_METHODS=['HEAP8'] \
-sALLOW_MEMORY_GROWTH=1 -I ../../../src
```

| Target | + Coroutine axis flag | + Exception axis flag |
|---|---|---|
| A (refs) | `-sASYNCIFY=1 -sASYNCIFY_IMPORTS=['jsAwaitControlledPromise']` | `-sDISABLE_EXCEPTION_CATCHING=0` |
| **B** | `-sASYNCIFY=1 -sASYNCIFY_IMPORTS=['jsAwaitControlledPromise']` | `-fwasm-exceptions` |
| **C** | `-sASYNCIFY=2 -sASYNCIFY_IMPORTS=['jsAwaitControlledPromise']` | `-sDISABLE_EXCEPTION_CATCHING=0` |

> **Note on JSPI and Asyncify imports list.** Although JSPI in Emscripten 6 expects imports returning Promises to be flagged via `WebAssembly.Suspending`, the `EM_ASYNC_JS` macro emits the `async` attribute on the embedded JS function and that auto-propagates the suspending-ness — `ASYNCIFY_IMPORTS` is still the registry of names the instrumentation will consider. Keeping it for target C is the minimum-disruption option and matches what Phase 2 needs: change *only* the `[12]` and observe.

## Scenario-Promise contract (unchanged from Phase 1)

| Scenario | Promise id(s) | Wasm-side action | JS-side action |
|---|---|---|---|
| S1 | (none) | `throw` synchronously | none |
| S2 | `s2-1` | await then `throw` | resolve |
| S3 | `s3-1` | await only | reject `Error("S3")` |
| S4 | `s4-1`, `s4-2` | await, catch, await | reject `s4-1`; resolve `s4-2` |

---

## Task 1: Target B build and example scaffolding (S1–S4)

**Files:**
- Create: `examples/B/s1/build.sh`, `examples/B/s1/run.sh`, `examples/B/s1/EXPECT.md`
- Create: `examples/B/s2/...`, `examples/B/s3/...`, `examples/B/s4/...`

**Interfaces:**
- Consumes: scenarios + runtime helpers from earlier plans.
- Produces: per-scenario target-B build artefacts and runnable `run.sh` that triggers the corresponding Playwright spec.

- [ ] **Step 1: Write `examples/B/s1/build.sh`**

```sh
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p build

# examples/B/s1/build.sh -- target B (Asyncify + Wasm EH), scenario S1.
# Flag delta vs A/s1: -fwasm-exceptions replaces -sDISABLE_EXCEPTION_CATCHING=0.

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
  ../../../src/scenarios/S1.cpp \
  -o build/main.js

cp ../../../src/page_template.html build/index.html
cp ../../../src/test_harness.js   build/test_harness.js
echo "built: $(pwd)/build/main.js"
```

- [ ] **Step 2: Write `examples/B/s1/run.sh`**

```sh
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
./build.sh
cd ../../..
npx playwright test B/s1
```

- [ ] **Step 3: Write `examples/B/s1/EXPECT.md`**

```markdown
# B / S1 — expectation

Target B = Asyncify + Wasm exception handling. Scenario S1 is the
synchronous throw/catch baseline (no suspend) — used to confirm the Wasm
EH toolchain flag compiles and runs on its own.

## Expected observation

Console (in order):
1. `S1:before-throw`
2. `PASS:s1-catch-reached`
3. `S1`
4. `PASS:s1-done`

Same as A/S1 — Wasm EH should make no observable difference when no suspend
is involved.
```

- [ ] **Step 4: chmod and make scripts executable**

Run:
```bash
chmod +x examples/B/s1/build.sh examples/B/s1/run.sh
```

- [ ] **Step 5: Build B/S1 to verify the flag combination compiles**

Run:
```bash
source ./emsdk/emsdk_env.sh
./examples/B/s1/build.sh
```
Expected: exits 0 and prints `built: .../examples/B/s1/build/main.js`. If `emcc` rejects `-fwasm-exceptions`, stop and read `emcc --help | grep -i wasm-exceptions` to find the correct flag spelling for this emsdk version; record the correct flag in `docs/findings.md` Phase 2 section when it lands.

- [ ] **Step 6: Repeat for B/S2, B/S3, B/S4**

For each of `s2`, `s3`, `s4`, create `build.sh`, `run.sh`, `EXPECT.md` by copying the B/S1 pattern and changing the scenario source path (`src/scenarios/S<n>.cpp`) and the `EXPECT.md` content. The `EXPECT.md` for each carries the *hypothesis-under-test* framing lifted from the A-row expectation files (see `examples/A/s{2,3,4}/EXPECT.md`), but with this addition to every S2/S3/S4 expectation:

```
## Hypothesis under test (this row)

Wasm exception handling opcodes own the throw/catch dispatch (not per-call
flag checking), so even when Asyncify instrumentation restores the saved
frame, a throw initiated on JS side via Promise reject should propagate into
the Wasm `try`/`catch` handler instead of escaping to JS.
```

The actual `build.sh`/`run.sh` for B/S2..S4 is identical to B/S1 except for the scenario file in the `emcc` command:

```sh
  ../../../src/scenarios/S2.cpp \   # for s2
  ../../../src/scenarios/S3.cpp \   # for s3
  ../../../src/scenarios/S4.cpp \   # for s4
```

Run:
```bash
chmod +x examples/B/s2/build.sh examples/B/s2/run.sh \
         examples/B/s3/build.sh examples/B/s3/run.sh \
         examples/B/s4/build.sh examples/B/s4/run.sh
```

- [ ] **Step 7: Build all B scenarios to verify they compile**

```bash
source ./emsdk/emsdk_env.sh
./examples/B/s2/build.sh
./examples/B/s3/build.sh
./examples/B/s4/build.sh
```
Expected: each prints `built: .../examples/B/s<n>/build/main.js` and exits 0.

- [ ] **Step 8: Commit**

```bash
git add examples/B/
git commit -m "examples: add target B build/run/expectation for S1..S4"
```

---

## Task 2: Target B Playwright specs (S1–S4)

**Files:**
- Create: `tests/B/s1.spec.ts`, `tests/B/s2.spec.ts`, `tests/B/s3.spec.ts`, `tests/B/s4.spec.ts`

**Interfaces:**
- Consumes: served pages at `http://localhost:8080/examples/<target>/s<n>/build/index.html` and `window.__Controlled.{resolve,reject}`.

- [ ] **Step 1: Write `tests/B/s1.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';

test('B/S1: synchronous throw is caught by main (Wasm EH baseline)', async ({ page }) => {
  const lines: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'log') lines.push(msg.text());
  });

  await page.goto('http://localhost:8080/examples/B/s1/build/index.html');
  await page.waitForFunction(
    () => (window as any).__logLines?.includes('PASS:s1-done'),
    null,
    { timeout: 10_000 }
  );

  expect(lines).toEqual([
    'S1:before-throw',
    'PASS:s1-catch-reached',
    'S1',
    'PASS:s1-done',
  ]);
});
```

- [ ] **Step 2: Write `tests/B/s2.spec.ts`**

Same as `tests/A/s2.spec.ts` but URL `examples/B/s2/...` and snapshot name `B-S2-console.txt`. Full content below.

```typescript
import { test, expect } from '@playwright/test';

test('B/S2: suspend then throw — observed console sequence', async ({ page }) => {
  const lines: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'log') lines.push(msg.text());
  });

  await page.goto('http://localhost:8080/examples/B/s2/build/index.html');
  await page.waitForFunction(
    () => (window as any).__logLines?.includes('S2:before-suspend'),
    null,
    { timeout: 10_000 }
  );
  await page.waitForTimeout(50);
  await page.evaluate(() => (window as any).__Controlled.resolve('s2-1'));
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

  expect(lines.length).toBeGreaterThan(0);
  expect(lines.join('\n')).toMatchSnapshot('B-S2-console.txt');
});
```

- [ ] **Step 3: Write `tests/B/s3.spec.ts`**

Hardcode the same pattern as A/S3, but URL `examples/B/s3/...` and snapshot name `B-S3-console.txt`.

```typescript
import { test, expect } from '@playwright/test';

test('B/S3: suspended Promise rejects — observed console sequence', async ({ page }) => {
  const lines: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'log') lines.push(msg.text());
  });
  page.on('pageerror', (e) => lines.push(`[pageerror] ${e.message}`));

  await page.goto('http://localhost:8080/examples/B/s3/build/index.html');
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
    page.waitForTimeout(10_000).then(() => lines.push('[timeout] no s3-done')),
  ]);

  expect(lines.length).toBeGreaterThan(0);
  expect(lines.join('\n')).toMatchSnapshot('B-S3-console.txt');
});
```

- [ ] **Step 4: Write `tests/B/s4.spec.ts`**

Same pattern as A/S4 (`pageerror` collected from start; tolerant `s4-2` resolution; 2-second upper bound after first reject):

```typescript
import { test, expect } from '@playwright/test';

test('B/S4: catch then re-suspend — observed console sequence', async ({ page }) => {
  const lines: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'log') lines.push(msg.text());
  });
  page.on('pageerror', (e) => lines.push(`[pageerror] ${e.message}`));

  await page.goto('http://localhost:8080/examples/B/s4/build/index.html');
  await page.waitForFunction(
    () => (window as any).__logLines?.includes('S4:before-suspend'),
    null,
    { timeout: 10_000 }
  );
  await page.waitForTimeout(50);

  await page.evaluate(() => (window as any).__Controlled.reject('s4-1', new Error('S4')));
  await page.waitForFunction(
    () => (window as any).__logLines?.includes('PASS:s4-catch-reached'),
    null,
    { timeout: 10_000 }
  ).catch(() => {/* catch-miss case will be visible in the snapshot */});

  await page.evaluate(() => {
    try {
      (window as any).__Controlled.resolve('s4-2');
      return 'resolved';
    } catch {
      return 'no-s4-2-registered';
    }
  });

  await Promise.race([
    page.waitForFunction(
      () => (window as any).__logLines?.includes('PASS:s4-done'),
      null,
      { timeout: 5_000 }
    ).catch(() => {/* not reached for this pitfall case */}),
    page.waitForTimeout(2_000),
  ]);

  expect(lines.length).toBeGreaterThan(0);
  expect(lines.join('\n')).toMatchSnapshot('B-S4-console.txt');
});
```

- [ ] **Step 5: Run all B specs — first run writes snapshots**

```bash
npx playwright test B/
```
Expected output: every spec runs once. Each of S2..S4 will report "snapshot doesn't exist — writing actual" which is what we *want* on first run; the test then exits `1 failed` for each. The S1 wild success case does an exact `toEqual` (no snapshot) so should report `1 passed`.

- [ ] **Step 6: Inspect the four snapshots**

Run:
```bash
find tests/B -name '*console*.txt' -print -exec cat {} \;
```

For each scenario, copy the contents into your working notes — they will be used in Task 5 to fill `docs/matrix.md`.

- [ ] **Step 7: Move actual snapshots into the snapshot directory and re-run**

Playwright writes "actual" into `test-results/<test-name>/<snap-name>-actual.txt`. The snapshot baseline lives at `tests/B/<s>.spec.ts-snapshots/<snap-name>-darwin.txt`. For each scenario S2/S3/S4, copy the actual into the snapshot path:

```bash
mkdir -p tests/B/s2.spec.ts-snapshots \
         tests/B/s3.spec.ts-snapshots \
         tests/B/s4.spec.ts-snapshots
# Replace the placeholders below with the actual test-results directory
# names that Playwright emitted (they differ per test name; use find).
find test-results -name 'B-S*-console-actual.txt' -print
# Then for each file produced:
#   cp test-results/<dir>/B-S*console-actual.txt tests/B/<s>.spec.ts-snapshots/B-S*console-darwin.txt
```

Re-run:

```bash
npx playwright test B/
npx playwright test tests/_features.spec.ts
```
Expected: `5 passed` (B/S1, B/S2, B/S3, B/S4, features=2 → actually 6 total counting the two in features; list reporter shows them separately).

- [ ] **Step 8: Commit**

```bash
git add tests/B/ tests/B/**/*.spec.ts-snapshots/
git commit -m "test: add target B Playwright specs and first-run snapshots for S1..S4"
```

---

## Task 3: Target C build and example scaffolding (S1–S4)

**Files:**
- Create: `examples/C/s1/...`, `examples/C/s2/...`, `examples/C/s3/...`, `examples/C/s4/...`

**Interfaces:**
- Consumes: scenarios + runtime helpers from earlier plans.

- [ ] **Step 1: Write `examples/C/s1/build.sh`**

```sh
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p build

# examples/C/s1/build.sh -- target C (JSPI + JS exception emulation), scenario S1.
# Flag delta vs A/s1: -sASYNCIFY=2 (JSPI) replaces -sASYNCIFY=1.

emcc \
  -std=c++17 \
  -O1 \
  -sASYNCIFY=2 \
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
  ../../../src/scenarios/S1.cpp \
  -o build/main.js

cp ../../../src/page_template.html build/index.html
cp ../../../src/test_harness.js   build/test_harness.js
echo "built: $(pwd)/build/main.js"
```

- [ ] **Step 2: Write `examples/C/s1/run.sh` and `EXPECT.md`**

```sh
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
./build.sh
cd ../../..
npx playwright test C/s1
```

`EXPECT.md`:

```markdown
# C / S1 — expectation

Target C = JSPI + JS exception emulation. Scenario S1 is the synchronous
throw/catch baseline (no suspend) — used to confirm the JSPI flag compiles
and runs on its own.

## Expected observation

Console (in order):
1. `S1:before-throw`
2. `PASS:s1-catch-reached`
3. `S1`
4. `PASS:s1-done`

Same as A/S1 and B/S1 — JSPI should make no observable difference when no
suspend is involved.
```

- [ ] **Step 3: chmod + build C/S1 to verify**

```bash
chmod +x examples/C/s1/build.sh examples/C/s1/run.sh
source ./emsdk/emsdk_env.sh
./examples/C/s1/build.sh
```
Expected: exits 0 and prints `built: .../examples/C/s1/build/main.js`. If `emcc` rejects `-sASYNCIFY=2`, stop; read `emcc --help | grep -i asyncify` for the current JSPI spelling on this emsdk version; record the correction in `docs/findings.md` Phase 2 section when it lands.

- [ ] **Step 4: Repeat for C/S2, C/S3, C/S4**

Same as B/S2..S4 pattern. The `EXPECT.md` for each carries the *hypothesis-under-test* framing lifted from the A-row expectations, with this addition to every S2/S3/S4 expectation:

```
## Hypothesis under test (this row)

JSPI switches stack-switching from binary instrumentation to the Wasm
runtime itself (no save/restore buffer), but JS exception emulation still
uses per-call flag propagation. The catch-return-target asymmetry described
in §1.2 conflict #2 should become probe-able here: a Wasm frame suspended
by JSPI remains a live frame, so a throw from JS should be deliverable to
the C++ catch *in the suspended function*.
```

Run:
```bash
chmod +x examples/C/s2/build.sh examples/C/s2/run.sh \
         examples/C/s3/build.sh examples/C/s3/run.sh \
         examples/C/s4/build.sh examples/C/s4/run.sh
```

- [ ] **Step 5: Build all C scenarios to verify**

```bash
source ./emsdk/emsdk_env.sh
./examples/C/s2/build.sh
./examples/C/s3/build.sh
./examples/C/s4/build.sh
```
Expected: each prints `built: ...` and exits 0.

- [ ] **Step 6: Commit**

```bash
git add examples/C/
git commit -m "examples: add target C build/run/expectation for S1..S4"
```

---

## Task 4: Target C Playwright specs (S1–S4)

**Files:**
- Create: `tests/C/s1.spec.ts`, `tests/C/s2.spec.ts`, `tests/C/s3.spec.ts`, `tests/C/s4.spec.ts`

- [ ] **Step 1: Write `tests/C/s1.spec.ts`**

Identical to `tests/B/s1.spec.ts` except URL points at `examples/C/s1/build/index.html`. Full contents:

```typescript
import { test, expect } from '@playwright/test';

test('C/S1: synchronous throw is caught by main (JSPI baseline)', async ({ page }) => {
  const lines: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'log') lines.push(msg.text());
  });

  await page.goto('http://localhost:8080/examples/C/s1/build/index.html');
  await page.waitForFunction(
    () => (window as any).__logLines?.includes('PASS:s1-done'),
    null,
    { timeout: 10_000 }
  );

  expect(lines).toEqual([
    'S1:before-throw',
    'PASS:s1-catch-reached',
    'S1',
    'PASS:s1-done',
  ]);
});
```

- [ ] **Step 2: Write `tests/C/s2.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';

test('C/S2: suspend then throw — observed console sequence', async ({ page }) => {
  const lines: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'log') lines.push(msg.text());
  });

  await page.goto('http://localhost:8080/examples/C/s2/build/index.html');
  await page.waitForFunction(
    () => (window as any).__logLines?.includes('S2:before-suspend'),
    null,
    { timeout: 10_000 }
  );
  await page.waitForTimeout(50);
  await page.evaluate(() => (window as any).__Controlled.resolve('s2-1'));
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

  expect(lines.length).toBeGreaterThan(0);
  expect(lines.join('\n')).toMatchSnapshot('C-S2-console.txt');
});
```

- [ ] **Step 3: Write `tests/C/s3.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';

test('C/S3: suspended Promise rejects — observed console sequence', async ({ page }) => {
  const lines: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'log') lines.push(msg.text());
  });
  page.on('pageerror', (e) => lines.push(`[pageerror] ${e.message}`));

  await page.goto('http://localhost:8080/examples/C/s3/build/index.html');
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
    page.waitForTimeout(10_000).then(() => lines.push('[timeout] no s3-done')),
  ]);

  expect(lines.length).toBeGreaterThan(0);
  expect(lines.join('\n')).toMatchSnapshot('C-S3-console.txt');
});
```

- [ ] **Step 4: Write `tests/C/s4.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';

test('C/S4: catch then re-suspend — observed console sequence', async ({ page }) => {
  const lines: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'log') lines.push(msg.text());
  });
  page.on('pageerror', (e) => lines.push(`[pageerror] ${e.message}`));

  await page.goto('http://localhost:8080/examples/C/s4/build/index.html');
  await page.waitForFunction(
    () => (window as any).__logLines?.includes('S4:before-suspend'),
    null,
    { timeout: 10_000 }
  );
  await page.waitForTimeout(50);

  await page.evaluate(() => (window as any).__Controlled.reject('s4-1', new Error('S4')));
  await page.waitForFunction(
    () => (window as any).__logLines?.includes('PASS:s4-catch-reached'),
    null,
    { timeout: 10_000 }
  ).catch(() => {/* catch-miss case visible in snapshot */});

  await page.evaluate(() => {
    try {
      (window as any).__Controlled.resolve('s4-2');
      return 'resolved';
    } catch {
      return 'no-s4-2-registered';
    }
  });

  await Promise.race([
    page.waitForFunction(
      () => (window as any).__logLines?.includes('PASS:s4-done'),
      null,
      { timeout: 5_000 }
    ).catch(() => {/* not reached for this pitfall case */}),
    page.waitForTimeout(2_000),
  ]);

  expect(lines.length).toBeGreaterThan(0);
  expect(lines.join('\n')).toMatchSnapshot('C-S4-console.txt');
});
```

- [ ] **Step 5: Run all C specs — initial snapshots written**

```bash
npx playwright test C/
```
Expected: S1 passes; S2/S3/S4 fail once (first-run snapshot creation), then need their snapshots promoted.

- [ ] **Step 6: Promote snapshots and re-run**

```bash
find test-results -name 'C-S*-console-actual.txt' -print
# For each, copy:
#   cp test-results/<dir>/C-S*-console-actual.txt tests/C/<s>.spec.ts-snapshots/C-S*-console-darwin.txt
# (Create the snapshot directories first.)
mkdir -p tests/C/s2.spec.ts-snapshots tests/C/s3.spec.ts-snapshots tests/C/s4.spec.ts-snapshots
# Then re-run:
npx playwright test C/
```
Expected: `4 passed` for C/ alone (`1` for features, `4` for C → but features is independent; total will be `5` if you only run C/ + features).

- [ ] **Step 7: Inspect snapshots**

```bash
find tests/C -name '*console*.txt' -print -exec cat {} \;
```

Note contents for Task 5.

- [ ] **Step 8: Commit**

```bash
git add tests/C/
git commit -m "test: add target C Playwright specs and first-run snapshots for S1..S4"
```

---

## Task 5: Update `docs/matrix.md` rows B and C and extend `docs/findings.md`

**Files:**
- Modify: `docs/matrix.md`
- Modify: `docs/findings.md`

**Interfaces:**
- Consumes: snapshot contents from Tasks 2 and 4.

- [ ] **Step 1: Read all B and C snapshots**

```bash
find tests/B tests/C -name '*console-darwin.txt' -print -exec cat {} \; -exec echo --- \;
```

- [ ] **Step 2: Update `docs/matrix.md` rows B and C**

Replace the four `—` cells in row B with `[obs](…)` links plus a one-line summary of the observed console sequence (use backticks for the sequence). Do the same for row C. Example cell content template:

```
[PASS](../examples/B/s1/EXPECT.md) `S1:before-throw → PASS:s1-catch-reached → S1 → PASS:s1-done`
```

Use these snapshot paths:
- B: `../tests/B/s<n>.spec.ts-snapshots/B-S<n>-console-darwin.txt`
- C: `../tests/C/s<n>.spec.ts-snapshots/C-S<n>-console-darwin.txt`

If a scenario produced `[pageerror] …` or `[timeout] …`, include that line in the cell — that *is* the observation.

- [ ] **Step 3: Append a "Phase 2" section to `docs/findings.md`**

Add this section at the end of `docs/findings.md`, filled in with the *actual* observed sequences:

```markdown
## Phase 2 — One axis at a time (targets B and C)

### B / S1 — synchronous throw (baseline)

Observed:
```
<paste B-S1 console verbatim>
```
Hypothesis check: <one sentence on whether B/S1 confirmed the Wasm EH baseline compiles cleanly>

### B / S2 — suspend then throw

Observed:
```
<paste B-S2 verbatim>
```
Mapping: <one sentence on whether B/S2 reproduced A/S2's happy path or deviated>

### B / S3 — suspend that rejects

Observed:
```
<paste B-S3 verbatim>
```
Mapping to §1.2: <one sentence on whether Wasm EH, on its own, recovered the catch that A/S3 missed. This is the row that tests whether Wasm EH alone fixes the §1.2 conflict #1 (suspend-side prop loss).>

### B / S4 — catch then re-suspend

Observed:
```
<paste B-S4 verbatim>
```
Mapping: <similar to B/S3, plus whether the catch-handler-internal await worked when the catch itself fired>

### C / S1 — synchronous throw (baseline)

Observed:
```
<paste C-S1 verbatim>
```
Hypothesis check: <one sentence>

### C / S2 — suspend then throw

Observed:
```
<paste C-S2 verbatim>
```
Mapping: <one sentence on whether JSPI, on its own, changed anything observable about C++ throw after resume vs A/S2>

### C / S3 — suspend that rejects

Observed:
```
<paste C-S3 verbatim>
```
Mapping to §1.2: <one sentence on whether JSPI, on its own, fixed §1.2 conflict #1 from A/S3. The §1.2 hypothesis was that "the Asyncify save-buffer return path traverses the wrong frame for JS exception emulation to propagate through" — does JSPI (no instrumentation) repair this?>

### C / S4 — catch then re-suspend

Observed:
```
<paste C-S4 verbatim>
```
Mapping: <one sentence on whether C reached the catch-handler-internal suspend that A/S4 could not reach>

### Cross-row summary (Phase 2)

<2-4 sentences comparing the four matrices across A/B/C:
- Is the §1.2 conflict #1 fixed everywhere we change a single axis, only on one, or nowhere?
- Is anything new pitfall-shaped visible that was not visible on row A?
- Which axis (coroutine vs exception) was more effective for fixing the A row's pits
  on target B and C — and was the difference what the design doc hypothesized?>

### Implications for Phase 3 (target D)

<2 sentences on whether D (the "both axes upgraded" target) is now expected to be a strict
union of B's and C's gains — and if not, what specifically is left to test on D>
```

Fill all `<placeholder>` markers with actual content from the snapshots. Do **not** leave any `<…>` placeholder in the committed file.

- [ ] **Step 4: Commit**

```bash
git add docs/matrix.md docs/findings.md
git commit -m "docs: record Phase 2 targets B/C partial-improvement observations"
```

---

## Task 6: Full-suite regression and DoD check

**Files:**
- (modifies nothing)

- [ ] **Step 1: Run every spec**

```bash
source ./emsdk/emsdk_env.sh
npx playwright test
```
Expected: `14 passed` — `_features` 2 + A 4 + B 4 + C 4 = 14. (Number may shift if feature probe is unit-split differently by the reporter, but every spec must end in `✓`.)

- [ ] **Step 2: Phase 2 DoD self-check**

Per design.md §5 Phase 2 and §8:
- Rows B and C of `docs/matrix.md` are fully filled (no `—`). ✓ if green.
- `docs/findings.md` "Phase 2" section ends with a "Cross-row summary" that takes a stance on which axis (coroutine, exception) did more to repair the A-row pits on B and C respectively. ✓ if present and not placeholder.
- design.md §8's "target B, C must observe partial-improvement and remaining limits" — done by the "Cross-row summary" considering both the successes and any remaining pitfall. ✓ if both are present.

If any of the above is missing or contains a placeholder, fix the responsible task before claiming completion.

- [ ] **Step 3: (No commit — verification only.)**

---

## Self-Review (run before handing off)

- **Spec coverage vs `docs/design.md`:**
  - §2.1 target B row (Asyncify + Wasm EH) — Task 1 build flags. ✓
  - §2.1 target C row (JSPI + JS EH) — Task 3 build flags. ✓
  - §1.4 conflict #2 (catch 복귀 지점의 비대칭) — explicitly probe-able on target C per findings.md Phase 1; covered by C/S4 EXPECT.md and spec. ✓
  - §1.2 conflict #1 (suspend-side prop loss) — covered by B/S3 and C/S3 spec observation. ✓
  - §3 metric 1 (correctness) — snapshot assertions + pageerror/timeout. ✓
  - §5 Phase 2 explicit statement ("에뮬레이션 한 쪽이 남아 있으면 구조적 불완전함이 남는다") — Phase 2 cross-row summary section. ✓
  - §8 DoD item ("target B, C에서 부분 개선/잔존 한계 관측") — Task 6 Step 2 explicit check. ✓

- **Placeholder scan:** No "TBD" / "implement later". `EXPECT.md` files use "hypothesis under test" framing (which is the point). `docs/findings.md` Step 3 has `<placeholder>` markers — these are explicitly filled in with actual snapshot content during execution; the plan instructs the implementer to "not leave any `<…>` placeholder in the committed file."

- **Type consistency:**
  - `async` flag delta: `ASYNCIFY=1` for B, `ASYNCIFY=2` for C — matches design.md §2.1. ✓
  - Wasm exception flag: `-fwasm-exceptions` (singular `wasm-exceptions`, not `wasm-exception-handling`). If `emcc` rejects this, Task 1 Step 5 and Task 3 Step 3 explicitly instruct recording the correct spelling in findings.md. ✓
  - Snapshot names: `B-S<n>-console.txt` and `C-S<n>-console.txt` — these become `B-S<n>-console-darwin.txt` (Playwright suffixes platform). Tasks 2/4 Step 7 instruct copying `*-actual.txt` to `*console-darwin.txt`. ✓
  - URL paths: `examples/<target>/s<n>/build/index.html` (lowercase) — Playwright baseURL unchanged from Phase 0. ✓

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-01-phase2-targets-b-and-c-partial-improvement.md`. Two execution options:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?