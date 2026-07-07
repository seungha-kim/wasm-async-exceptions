# Blog Draft Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite `docs/presentation.md` into a blog-style technical draft that foregrounds the final rejected-Promise boundary and Asyncify + Wasm EH exception-state findings.

**Architecture:** Keep the change documentation-only. Replace the current presentation-note structure with a readable article structure, then adjust README wording only if the old "presentation" label becomes misleading. Preserve links to findings, matrix, and examples as the source of detailed evidence.

**Tech Stack:** Markdown documentation, existing project findings and snapshot references, Git.

---

### Task 1: Rewrite the Blog Draft

**Files:**
- Modify: `docs/presentation.md`

- [ ] **Step 1: Replace the current presentation-note body**

Replace `docs/presentation.md` with a blog-style draft using this structure:

```markdown
# Asyncify, JSPI, Wasm EH, and C++ Exceptions Across an Async Boundary

## Thesis

Rejected JavaScript Promises do not automatically become C++ exceptions at the
Wasm boundary. If C++ `catch` semantics matter after JS async work, the
settlement needs to cross the boundary as data, and C++ needs to decide whether
to throw after it resumes.

The later stress tests add a second, more specific migration finding:
`Asyncify + Wasm EH` is not a safe halfway path. It passes ordinary
multi-yield-then-throw paths, but fails when live or captured Wasm EH exception
state crosses an Asyncify suspend boundary.

## Why this is tricky in Wasm

Wasm did not originally provide the two runtime behaviors that this project
intentionally mixes:

- saving and restoring a suspended stack while JavaScript async work completes;
- carrying C++ exception semantics through generated Wasm and JS support.

Emscripten can emulate those behaviors. Asyncify rewrites code so a Wasm stack
can be unwound and rewound. JS exception emulation represents C++ exception
state with generated JavaScript support. JSPI and Wasm exception handling move
parts of that work into standardized runtime mechanisms.

That gives us several plausible migration paths. The question is not simply
"does C++ throw still work?" It does, in many cases. The interesting boundary is
what happens when JavaScript async settlement and C++ exception semantics meet.

## Experiment setup

The first matrix tests six targets:

| Target | Stack/async axis | Exception axis |
|---|---|---|
| A | Asyncify | JS exception emulation |
| B | Asyncify | Wasm EH |
| C | JSPI | JS exception emulation |
| D | JSPI | Wasm EH |
| E | C++20 coroutine glue | JS exception emulation |
| E' | C++20 coroutine glue | Wasm EH |

Each target runs four basic scenarios:

- S1: synchronous C++ throw baseline
- S2: suspend, resolve, resume, then throw from C++
- S3: suspended async operation rejects
- S4: catch a failed async operation, then await again

The detailed result matrix lives in [`docs/matrix.md`](matrix.md). The
phase-by-phase evidence lives in [`docs/findings.md`](findings.md).

## First finding: a rejected Promise is not a C++ exception

S2 passes on A, B, and D. After the controlled Promise resolves, C++ resumes
and throws from C++ code. That throw is handled by C++ exception machinery.

S3 and S4 fail on A, B, and D for a different reason. The failure originates as
a rejected JavaScript Promise while Wasm is suspended. That rejection surfaces
as a JavaScript page error instead of entering the C++ `catch`.

That distinction is the first practical rule:

> A C++ throw after a successful async resume is not the same thing as a
> rejected Promise crossing into C++ as an exception.

Switching from Asyncify to JSPI, from JS exception emulation to Wasm EH, or to
both standardized axes does not by itself define that semantic bridge.

## The explicit-settlement pattern

Targets E and E' use a different shape. Instead of relying on an imported
Promise rejection to become a C++ exception, JavaScript records async settlement
as data and resumes a C++20 coroutine. The coroutine's `await_resume()` then
decides whether to return a value or throw from C++.

Conceptually, the bridge looks like this:

```text
JS async work settles
  -> JS stores { status, value_or_error }
  -> JS resumes C++ coroutine
  -> C++ await_resume() inspects status
  -> C++ throws if C++ catch semantics are required
```

That pattern passes S1-S4 on both E and E'. The important part is not merely
"use C++20 coroutines." The important part is ownership of the boundary: JS
settlement is data, and C++ exception control flow starts from C++ code.

## Second finding: Asyncify + Wasm EH is a fragile halfway path

The first matrix did not produce the originally hoped-for story that
`Asyncify + JS EH` fails while `JSPI + Wasm EH` simply fixes the problem. A
more interesting issue appeared after removing JS Promise rejection from the
experiment entirely.

The resolution-only stress scenarios S5-S10/S12/S14 run only on A, B, and D.
Every controlled Promise resolves. Every exception originates in C++. This
isolates C++ exception state interacting with suspend/resume.

The result is:

- A (`Asyncify + JS EH`) passes S5-S10/S12/S14.
- D (`JSPI + Wasm EH`) passes S5-S10/S12/S14.
- B (`Asyncify + Wasm EH`) fails S5-S7/S9/S10/S12 with `null function` and
  `unreachable`, but passes S8/S14.

So the unsafe migration path is specifically "turn on Wasm EH while keeping
Asyncify" for code that mixes exceptions with suspension.

## The boundary: live versus captured exception state

B passing S8 and S14 is just as important as B failing S5-S7/S9/S10/S12.

S8 and S14 suspend and resume through ordinary call frames first, then throw a
new C++ exception later. B handles those paths. That rules out the broad claim
that "many yields before a throw" is enough to break Asyncify + Wasm EH.

The failing scenarios carry exception state across the suspend boundary:

- S5 and S9 keep catch state live while a suspend happens.
- S6 and S10 suspend during C++ unwinding from a destructor path.
- S7 suspends from a catch path that later rethrows.
- S12 carries a saved `std::exception_ptr` across suspend and reactivates it
  later.

The narrower rule is:

> B fails when live or captured Wasm EH exception state must survive an
> Asyncify suspend/resume boundary.

## Why S12 matters

S12 is the edge case that makes the conclusion sharper.

```cpp
std::exception_ptr saved;

try {
  await_controlled_promise("s12-1");
  throw std::runtime_error("S12");
} catch (...) {
  saved = std::current_exception();
}

await_controlled_promise("s12-2");

try {
  std::rethrow_exception(saved);
} catch (const std::exception& e) {
  ...
}
```

The second suspend does not happen inside a catch block. It does not happen
during active stack unwinding. The catch has already ended.

But `std::exception_ptr` is not just a copied message. It is a handle to a
captured exception that the C++ runtime can later reactivate with
`std::rethrow_exception`. On B, the trace reaches `S12:after-second-resume` and
then fails with `null function` / `unreachable` before `PASS:s12-done`.

That means the unsafe state is broader than an active catch frame crossing the
boundary. Captured Wasm EH exception state can also become unusable after an
Asyncify suspend/resume.

## What to take away

There are two separate lessons.

First, JavaScript async failure and C++ exception handling are not the same
control-flow system. Treat JS Promise settlement as data at the boundary, then
throw from C++ if C++ `catch` is the desired abstraction.

Second, Wasm EH is not a drop-in safety upgrade if the stack-switching axis
remains Asyncify. In this harness, `Asyncify + Wasm EH` is worse than either
`Asyncify + JS EH` or `JSPI + Wasm EH` for the C++-initiated stress cases where
exception state crosses suspend.

JSPI and Wasm EH are still valuable. They reduce emulation and generated-code
costs. But the migration path needs to move the exception axis and the
stack-switching axis with care, and the async/exception boundary still needs to
be explicit.

## Reproducing the observations

Run the full suite:

```sh
source ./emsdk/emsdk_env.sh
npm test
```

Run size metrics:

```sh
scripts/collect-size-metrics.sh
```

Representative rejected-Promise pitfall:

```sh
cd examples/A/s3
./run.sh
```

Expected takeaway: A/S3 logs `S3:before-suspend`, then the rejected Promise
escapes as a page error instead of reaching the C++ catch.

Representative explicit-settlement counterexample:

```sh
cd examples/E/s3
./run.sh
```

Expected takeaway: E/S3 reaches `PASS:s3-catch-reached` because C++ throws
after coroutine resume.

Representative migration stress case:

```sh
cd examples/B/s12
./run.sh

cd ../../D/s12
./run.sh
```

Expected takeaway: B/S12 resumes from the second suspend and then fails while
reactivating the saved exception; D/S12 reaches `PASS:s12-done`.
```

- [ ] **Step 2: Scan for stale presentation-only headings**

Run:

```bash
rg -n "10-minute outline|Presentation Notes|Closing line|Demo commands" docs/presentation.md
```

Expected: no output.

### Task 2: Adjust README Label If Needed

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the document list label**

If `README.md` still labels `docs/presentation.md` as only a presentation draft,
change:

```markdown
4. 발표/글 초안: [`docs/presentation.md`](docs/presentation.md)
```

to:

```markdown
4. 글 초안: [`docs/presentation.md`](docs/presentation.md)
```

- [ ] **Step 2: Check the README reference**

Run:

```bash
rg -n "presentation|발표/글|글 초안" README.md docs/presentation.md
```

Expected: README should say `글 초안`; `docs/presentation.md` may still have the
file name but should not read as slide-only notes.

### Task 3: Verification and Commit

**Files:**
- Verify: `docs/presentation.md`
- Verify: `README.md`

- [ ] **Step 1: Check documentation diff**

Run:

```bash
git diff -- docs/presentation.md README.md
```

Expected: only blog-draft wording changes.

- [ ] **Step 2: Check whitespace**

Run:

```bash
git diff --check
```

Expected: no output.

- [ ] **Step 3: Check status**

Run:

```bash
git status --short
```

Expected: modified docs only, plus the pre-existing untracked `.cache/` and
`compile_commands.json`.

- [ ] **Step 4: Commit**

Run:

```bash
git add docs/presentation.md README.md
git commit -m "docs: polish blog draft"
```

Expected: commit succeeds with only documentation changes.

## Self-Review

- Spec coverage: implements the approved blog-draft structure and keeps scope
  documentation-only.
- Placeholder scan: no TBD/TODO placeholders.
- Type consistency: file paths and scenario names match the repository.
