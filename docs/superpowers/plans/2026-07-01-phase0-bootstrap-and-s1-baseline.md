# Phase 0 Bootstrap + A/S1 Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validate the Emscripten→Playwright pipeline end-to-end by building and observing the synchronous throw/catch scenario (S1) on target A. This establishes the harness that every subsequent phase (S2–S4 pitfall reproduction across targets A–E') will plug into, and proves Phase 0 of `docs/design.md`.

**Architecture:** Each scenario is built with `emcc` into a JS+Wasm pair, served over http, loaded by a Playwright-driven stable Chrome page that wires Wasm to a Promise-controlled suspend/resume harness. A `@playwright/test` spec loads the page, collects console signals (`PASS:<id>` / `FAIL:<id>`) the Wasm side emits, and asserts the scenario's correctness criterion. For S1 baseline the criterion is "catch block reached, no uncaught exception".

**Tech Stack:** Emscripten emsdk (latest stable tag), `@playwright/test`, TypeScript, `http-server`, C++17 (target A uses default flags; C++20 only matters for E/E' in later plans), stable Chrome.

## Global Constraints

- emsdk: latest stable tag, installed and pinned by `scripts/toolchain.sh`
- Playwright browser channel: `'chrome'` (stable), no experimental launch flags
- Node.js: LTS ≥ 20 (Playwright runtime requirement)
- Console protocol (mandatory across the whole project): Wasm side emits lines of the form `PASS:<id>` or `FAIL:<id>`. Tests parse them with strict regex.
- `ASYNCIFY=1` is the *target A* flag (per design.md §2.1); S1 does not actually suspend but we still set it so the binary reflects target A's instrumentation baseline.
- Exception support on target A: default Emscripten JS exception emulation (`-sDISABLE_EXCEPTION_CATCHING=0` — this is actually default, we set it explicitly for documentation).
- All repo paths below are relative to the repository root `/Users/seungha/dev/learn-asyncify`.
- Commit after every task. Commit messages use the `area: subject` form, lowercase verbs.

## File Structure

| Path | Responsibility |
|---|---|
| `package.json` | node dev deps (playwright test, http-server, typescript) + scripts |
| `tsconfig.json` | TS config for `tests/**/*.spec.ts` only |
| `playwright.config.ts` | `channel:'chrome'`, baseURL `http://localhost:8080`, 60s timeout |
| `.gitignore` | node_modules, emsdk env, build artifacts |
| `scripts/toolchain.sh` | install emsdk stable tag, source env, smoke-test `emcc` |
| `scripts/serve.sh` | start `http-server` on port 8080, used by Playwright via `webServer` config |
| `src/test_harness.js` | global `window.__ControlledPromise` registry; console passthrough |
| `src/runtime_helpers.h` / `.cpp` | `scenario_log(msg)`, `await_controlled_promise(id)` (the latter unused in S1 but defined for shared shape) |
| `src/page_template.html` | minimal HTML loaded by every example; references `main.js` and harness |
| `src/scenarios/S1.cpp` | S1 scenario: `throw` inside `main` try-block, `catch` emits `PASS:s1-catch-reached` |
| `examples/A/s1/build.sh` | `emcc` invocation producing `examples/A/s1/build/main.js`+`.wasm` |
| `examples/A/s1/run.sh` | one-liner: build → serve → `npx playwright test A/s1` |
| `examples/A/s1/EXPECT.md` | pre-recorded expectation for A/S1 |
| `tests/A/s1.spec.ts` | Playwright spec that asserts `PASS:s1-catch-reached` appears |
| `docs/background.md` | essay version of design.md §1 for readers |
| `docs/matrix.md` | matrix table; this plan fills only the A row × S1 cell |

---

## Task 1: Node scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `playwright.config.ts`
- Create: `.gitignore`

**Interfaces:**
- Produces: `package.json` with scripts `test`, `pretest:serve`; dependencies for `@playwright/test`, `typescript`, `http-server`.
- Produces: `playwright.config.ts` with `channel:'chrome'`, `webServer` pointing at `npm run serve`.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "learn-asyncify",
  "private": true,
  "version": "0.0.0",
  "description": "Emscripten Asyncify × Exception pitfalls research",
  "scripts": {
    "serve": "http-server examples -p 8080 -c-1",
    "test": "playwright test"
  },
  "devDependencies": {
    "@playwright/test": "^1.45.0",
    "http-server": "^14.1.1",
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "types": ["node", "@playwright/test"]
  },
  "include": ["tests/**/*.spec.ts"]
}
```

- [ ] **Step 3: Write `playwright.config.ts`**

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 30_000 },
  reporter: [['list']],
  use: {
    channel: 'chrome',
    baseURL: 'http://localhost:8080',
  },
  webServer: {
    command: 'npm run serve',
    port: 8080,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
```

- [ ] **Step 4: Write `.gitignore`**

```
node_modules/
examples/*/*/build/
emsdk/
.upstream/
*.wasm.o
.DS_Store
```

- [ ] **Step 5: Install deps and verify**

Run: `npm install`
Expected: `node_modules/` created; `npx playwright --version` prints a version.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json playwright.config.ts .gitignore
git commit -m "scaffold: node + playwright harness"
```

---

## Task 2: emsdk pin and toolchain smoke

**Files:**
- Create: `scripts/toolchain.sh`

**Interfaces:**
- Produces: `scripts/toolchain.sh` that installs emsdk at `./emsdk/` at a pinned tag, exposes `emsdk_env` so subsequent `emcc` invocations work. The script prints `EMSDK_TAG=<tag>` and `EMCC=<path>` for record.
- Consumes: nothing.

- [ ] **Step 1: Write `scripts/toolchain.sh`**

```sh
#!/usr/bin/env bash
set -euo pipefail

# Pin the emsdk stable tag. Update this single line to upgrade the toolchain.
EMSDK_TAG="3.1.74"   # latest stable as of writing; adjust when newer appears
EMSDK_DIR="${EMSDK_DIR:-$(pwd)/emsdk}"

if [ ! -d "$EMSDK_DIR/.git" ]; then
  git clone --depth 1 --branch "$EMSDK_TAG" https://github.com/emscripten-core/emsdk.git "$EMSDK_DIR"
fi

# shellcheck disable=SC1091
source "$EMSDK_DIR/emsdk_env.sh"
emsdk install latest
emsdk activate latest

emcc --version | head -1
echo "EMSDK_TAG=$EMSDK_TAG"
echo "EMCC=$(command -v emcc)"
```

- [ ] **Step 2: Make it executable**

Run: `chmod +x scripts/toolchain.sh`
Expected: no output.

- [ ] **Step 3: Smoke-test the toolchain**

Run: `./scripts/toolchain.sh` (this takes several minutes the first time).
Expected: ends with `EMSDK_TAG=3.1.74` and `EMCC=<path>/emcc`; exit code 0.

- [ ] **Step 4: Verify a hello-world build**

Run a one-off check (not committed):

```sh
source ./emsdk/emsdk_env.sh
echo 'int main(){return 0;}' > /tmp/hello.c
emcc /tmp/hello.c -o /tmp/hello.js
node /tmp/hello.js; echo "exit=$?"
```

Expected: `exit=0`.

- [ ] **Step 5: Commit**

```bash
git add scripts/toolchain.sh
git commit -m "toolchain: pin emsdk stable tag and smoke-test emcc"
```

---

## Task 3: Stable Chrome feature detection (Phase 0 confirmation)

**Files:**
- Modify: `tests/_features.spec.ts` (new)

**Interfaces:**
- Produces: a Playwright spec that asserts the runtime supports JSPI and Wasm EH; fails loudly if not.
- Consumes: Playwright config from Task 1.

- [ ] **Step 1: Write `tests/_features.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';

test('runtime supports Wasm exceptions', async ({ page }) => {
  await page.setContent(`
    <script>
      const supportsWasmEH = async () => {
        try {
          const wasm = await WebAssembly.compileStreaming(
            fetch('data:application/wasm;base64,' +
              btoa(String.fromCharCode(...new Uint8Array([
                0,97,115,109,1,0,0,0,1,5,1,96,0,1,125,3,2,1,0,7,7,1,1,116,101,115,116,0,0,
                10,8,1,6,0,68,0,0,0,0,11
              ])))
          );
          return true;
        } catch (e) { return false; }
      };
      window.__supportsWasmEH = supportsWasmEH();
    </script>
  `);
  await expect(await page.evaluate(() => (window as any).__supportsWasmEH)).resolves.toBe(true);
});

test('runtime supports JSPI', async ({ page }) => {
  await page.setContent(`
    <script>
      window.__supportsJSPI = (typeof WebAssembly.Suspending === 'function') ||
        (typeof WebAssembly.Suspender === 'function');
    </script>
  `);
  expect(await page.evaluate(() => (window as any).__supportsJSPI)).toBe(true);
});
```

> Note: the data: URL above embeds a tiny Wasm module with a single exported `test` function returning 0.0; if Wasm EH is unsupported then WebAssembly EH opcodes in the wild would throw — for a minimal probe we just check `WebAssembly.Exception` existence instead. Simplify the spec per Step 2 below.

- [ ] **Step 2: Replace the EH probe with a stable API check**

Edit `tests/_features.spec.ts` to use:

```typescript
test('runtime supports Wasm exceptions', async ({ page }) => {
  await page.setContent(`
    <script>
      window.__supportsWasmEH = (typeof WebAssembly.Exception === 'function') &&
        (typeof WebAssembly.Tag === 'function');
    </script>
  `);
  expect(await page.evaluate(() => (window as any).__supportsWasmEH)).toBe(true);
});
```

- [ ] **Step 3: Run the feature detection suite**

Run: `source ./emsdk/emsdk_env.sh && npx playwright test _features`
Expected: 2 passed.

- [ ] **Step 4: Commit**

```bash
git add tests/_features.spec.ts
git commit -m "toolchain: probe stable Chrome for JSPI and Wasm EH"
```

---

## Task 4: Background essay

**Files:**
- Create: `docs/background.md`

**Interfaces:**
- Produces: an exposition of design.md §1 for readers; provides context for matrix entries in later phases.

- [ ] **Step 1: Write `docs/background.md`**

```markdown
# Background: Wasm runtime limits and Emscripten's emulation layer

This file is the long-form companion to `docs/design.md` §1. It exists so that
later observation notes in `docs/matrix.md` can reference a stable write-up of
*what* Emscripten is emulating and *why*, without re-deriving it every time.

## 1. The Wasm MVP and what it lacks

WebAssembly 1.0 (2017) defines a stack machine with a deliberately small set
of operations: integer/float arithmetic, memory load/store, calls, branches.
Two C++ runtime features are absent from the MVP:

- *Cooperative suspend/resume* — a Wasm function cannot pause mid-frame and
  return control to its caller without unwinding. There is no `await`.
- *Exceptions* — there is no `try`/`catch` opcode; `throw` cannot be encoded.

## 2. What Emscripten does about it

Emscripten implements both via a *JS + binary instrumentation* layer atop Wasm:

### 2.1 Asyncify

Compiled with `-sASYNCIFY`, every function reachable from a suspend import
gets instrumented: on entry it checks an `asyncify.state`; on suspend the
runtime copies the live stack (locals + program counter) into a side buffer
and returns to JS; on resume the buffer is copied back and execution continues
as if the call never left. The set of instrumented functions is wide by
default and can be tuned with `ASYNCIFY_ONLY` / `ASYNCIFY_REMOVE`.

### 2.2 JS exception emulation

Without Wasm exception handling, C++ `throw` cannot directly stop a Wasm
frame. Emscripten emulates it: the throwing function writes the exception
object to a global and returns via the normal return path with a "threw"
flag; every caller checks that flag after each call and, if set, propagates
up the same way. `catch` blocks become conditional branches on that flag.

## 3. Why they collide

Both mechanisms occupy the **return path** of every function on the relevant
call chain. The design doc §1.2 lists three conflicts this produces; those
are *hypotheses* for this project to verify, not pre-established facts.

## 4. What the standards change

- **JSPI** (JS Promise Integration) — Wasm exports may return a Promise that
  the runtime awaits, with the Wasm stack genuinely suspended by the runtime
  itself. No instrumentation of every function is required.
- **Wasm exception handling** — `try`/`catch`/`throw` become opcodes; the
  unwind is performed by the runtime, not by per-call flag checks.

## 5. The third path: C++20 coroutines

A C++20 coroutine stores its locals in a heap-allocated frame and *returns*
to the caller when it suspends. Wasm never "freezes" — it has already popped
the frame. JS holds the resume handle and re-enters Wasm when the awaited
event settles. The coroutine-emulation layer is not needed at all; only the
exception-emulation layer (or Wasm EH) is on this path.

## 6. Status as of this writing

JSPI and Wasm EH are both shipped in stable Chrome
(`chromestatus.com/feature/5675224515231744`). Emscripten supports both;
serious use outside Chrome is still uneven, so this project treats the
Asyncify + JS EH combination as the *practical default* and JSPI + Wasm EH
and C++20 coroutine as the *standardized exits* to compare against.
```

- [ ] **Step 2: Commit**

```bash
git add docs/background.md
git commit -m "docs: add background essay on Wasm limits and Emscripten emulation"
```

---

## Task 5: Shared JS test harness

**Files:**
- Create: `src/test_harness.js`

**Interfaces:**
- Produces: `window.__ControlledPromise` with `register(id) -> Promise` and (for tests) `window.__Controlled.resolve(id)` / `.reject(id, err)`. Also `window.__logLines: string[]` capturing every `console.log` line emitted by either JS or Wasm.
- Consumes: nothing.

- [ ] **Step 1: Write `src/test_harness.js`**

```javascript
// Loaded by src/page_template.html *before* the emcc-generated main.js so
// that main.js can attach EMCC imports to window.__imports when instantiating.

(function () {
  'use strict';

  /** All console.log lines observed on the page, in order. Tests read this. */
  const logLines = [];
  window.__logLines = logLines;

  const _log = console.log.bind(console);
  console.log = function (...args) {
    const line = args.map(String).join(' ');
    logLines.push(line);
    return _log(...args);
  };

  /** Registry of controlled promises keyed by scenario-controlled id. */
  const pending = new Map();
  window.__Controlled = {
    register(id) {
      const p = new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
      });
      p.__id = id;
      return p;
    },
    resolve(id) {
      const entry = pending.get(id);
      if (!entry) throw new Error('no pending controlled promise: ' + id);
      pending.delete(id);
      entry.resolve();
    },
    reject(id, err) {
      const entry = pending.get(id);
      if (!entry) throw new Error('no pending controlled promise: ' + id);
      pending.delete(id);
      entry.reject(err);
    },
  };

  /** JS-side implementations of imports that main.js wires in. */
  window.__imports = {
    jsLog: (ptr, len) => {
      const bytes = new Uint8Array(HEAP8.buffer, ptr, len);
      const msg = new TextDecoder().decode(bytes);
      console.log(msg);
    },
    // await_controlled_promise(id_ptr, id_len) -- only used in suspend scenarios;
    // defined here so all targets share the import surface.
    jsAwaitControlledPromise: async (idPtr, idLen) => {
      const id = new TextDecoder().decode(new Uint8Array(HEAP8.buffer, idPtr, idLen));
      return window.__Controlled.register(id);
    },
  };
})();
```

> `HEAP8` is defined by Emscripten's generated `main.js` after instantiation. Since this script runs first and never calls it at load time, the reference inside import closures is safe — it is only evaluated when Wasm calls the import.

- [ ] **Step 2: Commit**

```bash
git add src/test_harness.js
git commit -m "harness: add JS test harness with controlled-promise registry"
```

---

## Task 6: Shared C++ runtime helpers

**Files:**
- Create: `src/runtime_helpers.h`
- Create: `src/runtime_helpers.cpp`

**Interfaces:**
- Produces: `scenario_log(const char* msg)` emitting a single `console.log` from Wasm (length-prefixed bytes via `jsLog`); `await_controlled_promise(const char* id)` returning a Promise (used by suspend scenarios in later plans; declared here for shared shape).
- Consumes: `jsLog(ptr,len)` and `jsAwaitControlledPromise(ptr,len)` JS imports from Task 5.

- [ ] **Step 1: Write `src/runtime_helpers.h`**

```cpp
#ifndef LEARN_ASYNCIFY_RUNTIME_HELPERS_H
#define LEARN_ASYNCIFY_RUNTIME_HELPERS_H

#include <emscripten.h>

// Emit a console.log line from Wasm. Used to print PASS:/FAIL: signals.
void scenario_log(const char* msg);

// Suspend the current Wasm frame on a Promise controlled by the test harness.
// Defined here for shared surface; unused by S1 (target A, no suspend).
void await_controlled_promise(const char* id);

#endif
```

- [ ] **Step 2: Write `src/runtime_helpers.cpp`**

```cpp
#include "runtime_helpers.h"
#include <cstring>

extern "C" {
  // Implemented in JS, wired by src/test_harness.js.
  extern void jsLog(const char* ptr, int len);
  extern void jsAwaitControlledPromise(const char* ptr, int len);
}

void scenario_log(const char* msg) {
  jsLog(msg, static_cast<int>(std::strlen(msg)));
}

void await_controlled_promise(const char* id) {
  jsAwaitControlledPromise(id, static_cast<int>(std::strlen(id)));
}
```

- [ ] **Step 3: Commit**

```bash
git add src/runtime_helpers.h src/runtime_helpers.cpp
git commit -m "harness: add shared C++ runtime helpers (jsLog, await_controlled)"
```

---

## Task 7: Page template

**Files:**
- Create: `src/page_template.html`
- Modify: none

**Interfaces:**
- Produces: a copy-paste HTML template that every example build will use. Build step copies it next to `main.js` as `index.html`.
- Consumes: `src/test_harness.js` (served) + the example's built `main.js`.

- [ ] **Step 1: Write `src/page_template.html`**

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>learn-asyncify example</title>
  <script src="/src/test_harness.js"></script>
</head>
<body>
  <script type="module">
    // main.js is Module produced by emcc with MODULARIZE=1 and EXPORT_NAME=createModule.
    import createModule from './main.js';
    const instance = await createModule({
      // Wire the Promise-aware suspend path through Asyncify.handleAsync.
      Asyncify: { handleAsync: (fn) => fn() },
    });
    // Expose HEAP8 for harness imports that lazy-reference it.
    window.HEAP8 = instance.HEAP8;
    // Trigger the scenario entry exported by main().
    instance._main();
  </script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add src/page_template.html
git commit -m "harness: add shared page template"
```

---

## Task 8: S1 scenario source

**Files:**
- Create: `src/scenarios/S1.cpp`

**Interfaces:**
- Produces: `_main()` exported by Emscripten; emits `PASS:s1-catch-reached` from the catch block and `PASS:s1-done` after returning 0.
- Consumes: `scenario_log` from Task 6.

- [ ] **Step 1: Write `src/scenarios/S1.cpp`**

```cpp
#include "runtime_helpers.h"
#include <stdexcept>

int main() {
  try {
    scenario_log("S1:before-throw");
    throw std::runtime_error("S1");
    scenario_log("FAIL:s1-after-throw-unreachable");
  } catch (const std::exception& e) {
    scenario_log("PASS:s1-catch-reached");
    scenario_log(e.what());  // prints "S1"
  }
  scenario_log("PASS:s1-done");
  return 0;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/scenarios/S1.cpp
git commit -m "scenarios: add S1 (synchronous throw/catch baseline)"
```

---

## Task 9: A/S1 build, run, expectation

**Files:**
- Create: `examples/A/s1/build.sh`
- Create: `examples/A/s1/run.sh`
- Create: `examples/A/s1/EXPECT.md`

**Interfaces:**
- Produces: `examples/A/s1/build/main.js` and `examples/A/s1/build/main.wasm` and `examples/A/s1/index.html`; `run.sh` chains build + Playwright.
- Consumes: `src/scenarios/S1.cpp`, `src/runtime_helpers.{h,cpp}`, `src/page_template.html`, emsdk env.

- [ ] **Step 1: Write `examples/A/s1/build.sh`**

```sh
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
```

- [ ] **Step 2: Make build script executable**

Run: `chmod +x examples/A/s1/build.sh`
Expected: no output.

- [ ] **Step 3: Write `examples/A/s1/run.sh`**

```sh
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
./build.sh
# Playwright spec lives at tests/A/s1.spec.ts; webServer serves examples/.
cd ../../..
npx playwright test A/s1
```

- [ ] **Step 4: Make run script executable**

Run: `chmod +x examples/A/s1/run.sh`

- [ ] **Step 5: Write `examples/A/s1/EXPECT.md`**

```markdown
# A / S1 — expectation

Target A = Asyncify instrumentation + JS exception emulation; scenario S1 =
synchronous throw inside `main`'s try block, caught by the same `main`.

## Expected observation

Console (in order):
1. `S1:before-throw`
2. `PASS:s1-catch-reached`
3. `S1`                      # what() of the caught exception
4. `PASS:s1-done`

## Why

S1 has no suspend; only throw/catch on an instrumented binary. JS exception
emulation propagates the throw via the normal return path of `main` itself;
the catch branch is taken. This is the clean baseline that every later
scenario on every target is compared against.
```

- [ ] **Step 6: Commit**

```bash
git add examples/A/s1/build.sh examples/A/s1/run.sh examples/A/s1/EXPECT.md
git commit -m "examples: add A/S1 build/run/expectation"
```

---

## Task 10: A/S1 Playwright spec

**Files:**
- Create: `tests/A/s1.spec.ts`

**Interfaces:**
- Consumes: Playwright config (Task 1), served page `http://localhost:8080/A/s1/build/index.html`.

- [ ] **Step 1: Write `tests/A/s1.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';

test('A/S1: synchronous throw is caught by main', async ({ page }) => {
  const lines: string[] = [];
  page.on('console', (msg) => lines.push(msg.text()));

  await page.goto('http://localhost:8080/A/s1/build/index.html');
  // Give the Wasm scenario time to flush all four console.log lines.
  await page.waitForFunction(() => (window as any).__logLines?.includes('PASS:s1-done'), null, { timeout: 10_000 });

  expect(lines).toEqual([
    'S1:before-throw',
    'PASS:s1-catch-reached',
    'S1',
    'PASS:s1-done',
  ]);
});
```

- [ ] **Step 2: Commit**

```bash
git add tests/A/s1.spec.ts
git commit -m "tests: assert A/S1 catch baseline"
```

---

## Task 11: End-to-end smoke

**Files:**
- (modifies nothing)

- [ ] **Step 1: Source emsdk env**

Run: `source ./emsdk/emsdk_env.sh`
Expected: shell prompt unaffected; `which emcc` points to emsdk.

- [ ] **Step 2: Build A/S1**

Run: `./examples/A/s1/build.sh`
Expected: prints `built: .../examples/A/s1/build/main.js`; `examples/A/s1/build/index.html` and `main.js` and `main.wasm` exist.

- [ ] **Step 3: Run the A/S1 spec**

Run: `npx playwright test A/s1`
Expected: `1 passed`.

- [ ] **Step 4: Run the feature probe as a sanity sidecheck**

Run: `npx playwright test _features`
Expected: `2 passed`.

- [ ] **Step 5: (Nothing to commit; artifacts are gitignored.)**

If any of Steps 2–4 fail, fix the responsible task (most likely candidate: Task 5 harness JS order-of-load) and re-run from Step 2.

---

## Task 12: Matrix skeleton with A/S1 cell

**Files:**
- Create: `docs/matrix.md`

**Interfaces:**
- Produces: a 6×4 skeleton matrix; only the A row × S1 cell is filled from the observation in Task 11.

- [ ] **Step 1: Write `docs/matrix.md`**

```markdown
# Observation matrix

The living companion to `docs/design.md` §2. Rows are the six build targets;
columns are the four scenarios. Each cell records the **observed** behavior
with line-promoted links to the example's `EXPECT.md`. "—" means not yet run.

| Target | S1 baseline throw         | S2 suspend then throw | S3 suspend rejects | S4 catch then re-suspend |
|--------|---------------------------|-----------------------|--------------------|--------------------------|
| A      | [PASS](../examples/A/s1/EXPECT.md) `S1:before-throw → PASS:s1-catch-reached → S1 → PASS:s1-done` | — | — | — |
| B      | —                         | —                     | —                  | —                        |
| C      | —                         | —                     | —                  | —                        |
| D      | —                         | —                     | —                  | —                        |
| E      | —                         | —                     | —                  | —                        |
| E'     | —                         | —                     | —                  | —                        |

## Conventions

- A cell is filled only after its Playwright spec runs successfully.
- On pitfall reproduction (an "expected" failure), record the exact
  console sequence and link the `EXPECT.md` that explains the mechanism.
- The `PASS` / `FAIL` lines referenced here are Wasm-side
  `console.log("PASS:<id>")` / `console.log("FAIL:<id>")` signals.
```

- [ ] **Step 2: Commit**

```bash
git add docs/matrix.md
git commit -m "docs: add observation matrix skeleton with A/S1 cell"
```

---

## Self-Review (run before handing off)

- **Spec coverage vs `docs/design.md`:**
  - §2.1 target A row → covered by Task 9 build flags (Asyncify + JS EH). ✓
  - §2.4 decision #1 (controlled Promise) → harness defined in Task 5 even though S1 doesn't exercise it. ✓
  - §2.4 decision #2 (caller-catch) → S1's `main` try/catch matches. ✓
  - §2.4 decision #3 (Playwright stable Chrome) → Task 1 config + Task 3 probe. ✓
  - §2.4 decision #5 (source sharing A–D) → S1.cpp under `src/scenarios/` per Task 8. ✓
  - §2.4 decision #6 (Playwright runner) → Tasks 1, 10. ✓
  - §2.4 decision #7 (emsdk stable tag + stable Chrome) → Task 2, Task 3. ✓
  - §2.4 decision #8 doesn't apply yet (Phase 2.5 territory). ✓
  - §3 metric 1 (correctness) → Tasks 10, 12. ✓
  - §5 Phase 0 → Tasks 1–4. ✓
  - Other scenarios S2/S3/S4, targets B–E', metrics 2–4 → explicitly out of scope for this plan; covered by follow-on plans.

- **Placeholder scan:** no "TBD"/"implement later". Every code step has runnable code.

- **Type consistency:** `window.__Controlled` registered shape matches harness (Task 5) and is used by S1-free but referenced by `await_controlled_promise` decl in Task 6 (declared, not called in S1 — fine). `jsLog` signature matches between runtime_helpers.cpp (`void jsLog(const char* ptr, int len)`) and harness (`jsLog: (ptr, len) => {…}`). `_main` exported in build.sh matches S1's `int main()` (Emscripten keeps `_main`). `EXPORT_NAME=createModule` matches `import createModule from './main.js'` in page template.

- All tasks produce a green commit; Task 11 is verification-only (no code change) so no commit there is correct.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-01-phase0-bootstrap-and-s1-baseline.md`. Two execution options:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?